import { eq, and, desc } from 'drizzle-orm';
import {
  workspaces,
  contacts,
  agents,
  relationships,
  messages,
  actions,
  events,
  memberships,
} from '@/db/schema';
import type { Contact, Agent, Relationship, Message, Action } from '@/db/schema';
import {
  LLMProvider,
  DecisionContext,
  AgentDecision,
  AgentDecisionSchema,
  MessageDraft,
} from '@/providers/types';
import { ActionService } from '@/core/actions/service';
import { VoiceValidator } from '@/core/agents/voice';
import { AgentService } from '@/core/agents/service';
import { TelegramBotService } from '@/providers/telegram/bot';

export interface ProcessInboundParams {
  workspaceId: string;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  provider?: string;
  providerMessageId?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  threadKey?: string;
  headers?: Record<string, string>;
  receivedAt?: Date;
}

export interface DecisionEngineResult {
  message: Message;
  relationship: Relationship;
  decision?: AgentDecision;
  action?: Action;
  draft?: MessageDraft;
  cancelledFollowUpsCount: number;
}

export class DecisionEngine {
  private actionService: ActionService;

  constructor(
    private db: any,
    private llmProvider: LLMProvider
  ) {
    this.actionService = new ActionService(db);
  }

  /**
   * Orchestrates the entire relationship decision flow for an inbound message
   */
  async processInboundMessage(params: ProcessInboundParams): Promise<DecisionEngineResult> {
    const receivedAt = params.receivedAt || new Date();
    const emailNormalized = params.fromEmail.trim().toLowerCase();

    // 0. Deduplicate inbound message if providerMessageId is provided
    if (params.providerMessageId) {
      const [existing] = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, params.workspaceId),
            eq(messages.providerMessageId, params.providerMessageId)
          )
        )
        .limit(1);

      if (existing) {
        // Idempotent replay: return existing message and relationship
        const [rel] = await this.db
          .select()
          .from(relationships)
          .where(eq(relationships.id, existing.relationshipId))
          .limit(1);

        return {
          message: existing,
          relationship: rel,
          cancelledFollowUpsCount: 0,
        };
      }
    }

    // 1. Verify workspace exists
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, params.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error(`Workspace ${params.workspaceId} not found`);
    }

    // 2. Load or create contact
    let [contact] = await this.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, params.workspaceId),
          eq(contacts.emailNormalized, emailNormalized)
        )
      )
      .limit(1);

    if (!contact) {
      const [newContact] = await this.db
        .insert(contacts)
        .values({
          id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          name: params.fromName || emailNormalized.split('@')[0],
          emailNormalized,
          tagsJson: ['inbound-auto-created'],
          sourceJson: { channel: 'inbound_email', firstSubject: params.subject },
          status: 'ACTIVE',
          isSuppressed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      contact = newContact;
    }

    // 3. Find active agent for this workspace
    let [agent] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.workspaceId, params.workspaceId), eq(agents.isActive, true)))
      .limit(1);

    if (!agent) {
      const agentsList = await AgentService.listAgents(params.workspaceId, this.db);
      agent = agentsList.find((a: any) => a.isActive) || agentsList[0];
    }

    if (!agent) {
      throw new Error(`No active agent configured for workspace ${params.workspaceId}`);
    }

    // 4. Find or create relationship
    let [relationship] = await this.db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.workspaceId, params.workspaceId),
          eq(relationships.contactId, contact.id),
          eq(relationships.agentId, agent.id)
        )
      )
      .limit(1);

    if (!relationship) {
      const [newRel] = await this.db
        .insert(relationships)
        .values({
          id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          contactId: contact.id,
          agentId: agent.id,
          stage: 'NEW',
          summary: 'Inbound message received.',
          factsJson: [],
          openQuestionsJson: [],
          lastInboundAt: receivedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      relationship = newRel;
    }

    // 5. Ingest inbound message
    const [savedMessage] = await this.db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        relationshipId: relationship.id,
        direction: 'INBOUND',
        channel: 'EMAIL',
        subject: params.subject || null,
        bodyText: params.bodyText,
        bodyHtml: params.bodyHtml || null,
        provider: params.provider || 'mock',
        providerMessageId: params.providerMessageId || null,
        internetMessageId: params.internetMessageId || null,
        inReplyTo: params.inReplyTo || null,
        threadKey: params.threadKey || params.subject || 'default-thread',
        status: 'RECEIVED',
        receivedAt,
        createdAt: new Date(),
      })
      .returning();

    // Audit event for message ingestion
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      relationshipId: relationship.id,
      eventType: 'INBOUND_MESSAGE_RECEIVED',
      externalEventId: params.providerMessageId || null,
      payloadJson: {
        from: contact.emailNormalized,
        subject: params.subject,
      },
      createdAt: new Date(),
    });

    // 6. Stop pending generic follow-ups on substantive inbound reply
    const cancelledCount = await this.actionService.cancelPendingFollowUpsForRelationship({
      workspaceId: params.workspaceId,
      relationshipId: relationship.id,
      reason: 'Substantive inbound message received',
    });

    // 7. Check if contact is suppressed
    if (contact.isSuppressed) {
      // Suppressed contact cannot receive outbound emails
      const action = await this.actionService.createAction({
        workspaceId: params.workspaceId,
        relationshipId: relationship.id,
        agentId: agent.id,
        type: 'NO_ACTION',
        reason: 'Contact is suppressed; no automated outbound response allowed.',
        approvalRequired: false,
      });

      return {
        message: savedMessage,
        relationship,
        action,
        cancelledFollowUpsCount: cancelledCount,
      };
    }

    // 8. Load recent conversation history for decision context
    const recentMessages = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, params.workspaceId),
          eq(messages.relationshipId, relationship.id)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(10);

    const decisionContext: DecisionContext = {
      agent: {
        name: agent.name,
        goal: agent.goal,
        instructions: agent.instructions,
        knowledgeText: agent.knowledgeText,
        voiceProfile: agent.voiceJson as Record<string, any>,
        permissions: agent.permissionsJson as Record<string, any>,
      },
      contact: {
        name: contact.name,
        email: contact.emailNormalized,
        organisation: contact.organisation,
        country: contact.country,
        isSuppressed: contact.isSuppressed,
      },
      relationship: {
        stage: relationship.stage,
        summary: relationship.summary,
        facts: (relationship.factsJson as string[]) || [],
        openQuestions: (relationship.openQuestionsJson as string[]) || [],
      },
      recentMessages: recentMessages.map((m: Message) => ({
        direction: m.direction as 'INBOUND' | 'OUTBOUND',
        subject: m.subject,
        bodyText: m.bodyText,
        receivedAt: m.receivedAt,
        sentAt: m.sentAt,
      })),
      inboundMessage: {
        subject: params.subject,
        bodyText: params.bodyText,
        receivedAt,
      },
    };

    // 9. Ask LLM provider to classify intent and propose next action
    let decision: AgentDecision;
    try {
      const rawDecision = await this.llmProvider.decide(decisionContext);
      decision = AgentDecisionSchema.parse(rawDecision);
    } catch (err: any) {
      // Malformed LLM response must NOT crash or emit rogue actions
      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        relationshipId: relationship.id,
        eventType: 'LLM_DECISION_FAILED',
        payloadJson: {
          error: err.message || 'Malformed LLM JSON',
        },
        createdAt: new Date(),
      });

      // Safe fallback: escalate or no-action
      const fallbackAction = await this.actionService.createAction({
        workspaceId: params.workspaceId,
        relationshipId: relationship.id,
        agentId: agent.id,
        type: 'ESCALATE',
        reason: `LLM decision failed validation: ${err.message}`,
        approvalRequired: true,
      });

      return {
        message: savedMessage,
        relationship,
        action: fallbackAction,
        cancelledFollowUpsCount: cancelledCount,
      };
    }

    // 10. Server-Side Safety Invariant Enforcement
    // Check for commercial terms/pricing keywords in message or intent
    const lowerBody = params.bodyText.toLowerCase();
    const isCommercial =
      decision.intent.includes('pricing') ||
      lowerBody.includes('pricing') ||
      lowerBody.includes('cost') ||
      lowerBody.includes('quote') ||
      lowerBody.includes('contract');

    if (isCommercial) {
      decision.approval_required = true;
      decision.next_action = 'REQUEST_APPROVAL';
    }

    // Handle Opt-Out intent
    if (decision.intent === 'opt_out' || decision.stage === 'OPTED_OUT') {
      await this.db
        .update(contacts)
        .set({
          isSuppressed: true,
          suppressionReason: 'Contact requested opt-out in message',
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contact.id));

      decision.next_action = 'MARK_COMPLETE';
      decision.draft_required = false;
      decision.approval_required = false;
    }

    // 11. Generate draft if required
    let draft: MessageDraft | undefined;
    if (decision.draft_required && decision.next_action !== 'NO_ACTION' && decision.next_action !== 'MARK_COMPLETE') {
      try {
        draft = await this.llmProvider.draft({
          decision,
          decisionContext,
        });

        // Validate draft voice and factual/permission invariants
        if (draft) {
          const voiceCheck = VoiceValidator.validateDraft(
            draft,
            (agent.voiceJson as Record<string, any>) || {},
            (agent.permissionsJson as Record<string, any>) || {}
          );

          if (!voiceCheck.isValid) {
            decision.approval_required = true;
            decision.next_action = 'REQUEST_APPROVAL';
            decision.reason = `Draft contains voice or permission violations (${voiceCheck.violations.map((v) => v.rule).join(', ')}); human approval required.`;
          }
        }
      } catch (err: any) {
        // Drafting failed: escalate for human intervention
        decision.approval_required = true;
        decision.next_action = 'ESCALATE';
      }
    }

    // 12. Persist Action
    const scheduledAt =
      decision.schedule_after_minutes > 0
        ? new Date(Date.now() + decision.schedule_after_minutes * 60 * 1000)
        : null;

    const action = await this.actionService.createAction({
      workspaceId: params.workspaceId,
      relationshipId: relationship.id,
      agentId: agent.id,
      type: decision.next_action,
      reason: decision.reason,
      scheduledAt,
      approvalRequired: decision.approval_required,
      draftVersion: draft?.draft_version ?? 1,
      payload: {
        decision,
        draft: draft
          ? {
              subject: draft.subject,
              body_text: draft.body_text,
              draft_version: draft.draft_version,
            }
          : undefined,
        draft_version: draft?.draft_version ?? 1,
      },
    });

    // 13. Update relationship summary, facts, stage & current action
    const existingFacts = (relationship.factsJson as string[]) || [];
    const updatedFacts = Array.from(new Set([...existingFacts, ...(decision.new_facts || [])]));

    const [updatedRel] = await this.db
      .update(relationships)
      .set({
        stage: decision.stage,
        summary: decision.summary_update,
        factsJson: updatedFacts,
        openQuestionsJson: decision.open_questions || [],
        currentActionId: action.id,
        lastInboundAt: receivedAt,
        updatedAt: new Date(),
      })
      .where(eq(relationships.id, relationship.id))
      .returning();

    // 14. Telegram Alerts for Inbound & Approvals
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const botService = new TelegramBotService({ botToken }, this.db);
        const allMembers = await this.db
          .select()
          .from(memberships)
          .where(eq(memberships.workspaceId, params.workspaceId));

        const linkedMember = allMembers.find((m: any) => {
          const rawPerms = m.permissionsJson ?? m.permissions_json ?? {};
          const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
          return !!perms.telegram?.chatId;
        });

        if (linkedMember) {
          const rawPerms = linkedMember.permissionsJson ?? linkedMember.permissions_json ?? {};
          const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
          const chatId = perms.telegram.chatId;

          await botService.sendInboundAlert(chatId, {
            fromName: contact.name,
            fromEmail: contact.emailNormalized,
            subject: params.subject || 'Inbound Reply',
            summary: decision.summary_update || params.bodyText.substring(0, 200),
          });

          if (decision.approval_required && draft) {
            await botService.sendApprovalAlert(chatId, {
              actionId: action.id,
              draftVersion: draft.draft_version || 1,
              contactName: contact.name,
              recipientEmail: contact.emailNormalized,
              subject: draft.subject,
              bodyText: draft.body_text,
              reason: decision.reason || 'Human approval required',
            });
          }
        }
      }
    } catch (err) {
      console.error('Error dispatching telegram inbound alert:', err);
    }

    return {
      message: savedMessage,
      relationship: updatedRel,
      decision,
      action,
      draft,
      cancelledFollowUpsCount: cancelledCount,
    };
  }
}

import { eq, and, inArray } from 'drizzle-orm';
import { contacts, relationships, actions, agents } from '@/db/schema';
import { ActionService } from '@/core/actions/service';

export interface CampaignLaunchParams {
  workspaceId: string;
  agentId: string;
  contactIds: string[];
  initialTemplate: {
    subject: string;
    bodyText: string;
  };
  followUpRule?: {
    delayDays: number;
    subject: string;
    bodyText: string;
  };
}

export interface CampaignLaunchResult {
  eligibleContactsCount: number;
  suppressedSkippedCount: number;
  initialActionsCreated: number;
  followUpActionsScheduled: number;
}

export class CampaignSequenceEngine {
  private actionService: ActionService;

  constructor(private db: any) {
    this.actionService = new ActionService(db);
  }

  /**
   * Enqueues an initial outreach action and optional follow-up for eligible contacts
   */
  async launchCampaign(params: CampaignLaunchParams): Promise<CampaignLaunchResult> {
    const targetContacts = await this.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, params.workspaceId),
          inArray(contacts.id, params.contactIds)
        )
      );

    let eligibleCount = 0;
    let suppressedSkipped = 0;
    let initialCount = 0;
    let followUpCount = 0;

    for (const contact of targetContacts) {
      // 1. Check global suppression
      if (contact.isSuppressed) {
        suppressedSkipped++;
        continue;
      }

      eligibleCount++;

      // 2. Find or create relationship
      let [rel] = await this.db
        .select()
        .from(relationships)
        .where(
          and(
            eq(relationships.workspaceId, params.workspaceId),
            eq(relationships.contactId, contact.id),
            eq(relationships.agentId, params.agentId)
          )
        )
        .limit(1);

      if (!rel) {
        const [newRel] = await this.db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            workspaceId: params.workspaceId,
            contactId: contact.id,
            agentId: params.agentId,
            stage: 'OUTREACH',
            summary: 'Campaign outreach queued.',
            factsJson: [],
            openQuestionsJson: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        rel = newRel;
      }

      // Personalize initial template
      const personalizedBody = params.initialTemplate.bodyText
        .replace(/{{name}}/g, contact.name)
        .replace(/{{company}}/g, contact.organisation || 'your team');

      // 3. Create initial outreach action (AWAITING_APPROVAL by default for safety)
      const initialAction = await this.actionService.createAction({
        workspaceId: params.workspaceId,
        relationshipId: rel.id,
        agentId: params.agentId,
        type: 'SEND_EMAIL',
        reason: 'Campaign initial outreach message',
        approvalRequired: true, // Safe by default: requires operator approval before send
        payload: {
          draft: {
            subject: params.initialTemplate.subject,
            body_text: personalizedBody,
            draft_version: 1,
          },
          campaign: true,
        },
      });

      initialCount++;

      // 4. Create scheduled follow-up action if configured
      if (params.followUpRule) {
        const followUpScheduledAt = new Date(
          Date.now() + params.followUpRule.delayDays * 24 * 60 * 60 * 1000
        );

        const followUpBody = params.followUpRule.bodyText
          .replace(/{{name}}/g, contact.name)
          .replace(/{{company}}/g, contact.organisation || 'your team');

        await this.actionService.createAction({
          workspaceId: params.workspaceId,
          relationshipId: rel.id,
          agentId: params.agentId,
          type: 'SEND_EMAIL',
          reason: `Automated campaign follow-up (day ${params.followUpRule.delayDays})`,
          scheduledAt: followUpScheduledAt,
          approvalRequired: false,
          payload: {
            draft: {
              subject: params.followUpRule.subject,
              body_text: followUpBody,
              draft_version: 1,
            },
            campaign: true,
            isFollowUp: true,
          },
        });

        followUpCount++;
      }
    }

    return {
      eligibleContactsCount: eligibleCount,
      suppressedSkippedCount: suppressedSkipped,
      initialActionsCreated: initialCount,
      followUpActionsScheduled: followUpCount,
    };
  }
}

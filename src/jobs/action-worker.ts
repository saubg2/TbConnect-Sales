import { eq, and, or, lte, isNull, inArray, sql } from 'drizzle-orm';
import { actions, relationships, contacts, messages, events, Action } from '@/db/schema';
import { EmailSender, OutboundMessage } from '@/providers/types';
import { EmergencyStopService } from '@/core/actions/emergency';

export interface ActionWorkerOptions {
  emailSender: EmailSender;
  maxAttempts?: number;
  baseBackoffMs?: number;
}

export interface WorkerCycleResult {
  claimedCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  retriedCount: number;
}

export class ActionWorker {
  private emergencyService: EmergencyStopService;
  private maxAttempts: number;
  private baseBackoffMs: number;
  private emailSender: EmailSender;

  constructor(private db: any, options: ActionWorkerOptions) {
    this.emergencyService = new EmergencyStopService(db);
    this.emailSender = options.emailSender;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 2000;
  }

  /**
   * Atomically claims the next eligible due action for processing
   */
  async claimNextAction(workspaceId: string): Promise<Action | null> {
    const now = new Date();

    // Query candidate action IDs that are ready
    const candidates = await this.db
      .select({ id: actions.id })
      .from(actions)
      .where(
        and(
          eq(actions.workspaceId, workspaceId),
          inArray(actions.status, ['PENDING', 'APPROVED']),
          or(isNull(actions.scheduledAt), lte(actions.scheduledAt, now))
        )
      )
      .limit(1);

    if (candidates.length === 0) {
      return null;
    }

    const targetId = candidates[0].id;

    // Atomic update claim to ensure single execution across parallel workers
    const [claimed] = await this.db
      .update(actions)
      .set({
        status: 'PROCESSING',
        attemptCount: sql`${actions.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(actions.id, targetId),
          inArray(actions.status, ['PENDING', 'APPROVED'])
        )
      )
      .returning();

    return claimed || null;
  }

  /**
   * Executes a single claimed action with idempotency, pre-send suppression and backoff
   */
  async processAction(action: Action): Promise<{ status: string; error?: string }> {
    const workspaceId = action.workspaceId;

    // 1. Emergency Stop Check
    const isEmergency = await this.emergencyService.isEmergencyStopActive(workspaceId);
    if (isEmergency) {
      await this.db
        .update(actions)
        .set({
          status: 'CANCELLED',
          reason: 'Execution blocked by active workspace emergency stop',
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));

      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId,
        relationshipId: action.relationshipId,
        actionId: action.id,
        eventType: 'ACTION_BLOCKED_EMERGENCY_STOP',
        createdAt: new Date(),
      });

      return { status: 'CANCELLED', error: 'Emergency stop active' };
    }

    // 2. Load Relationship and Contact for Invariant Verification
    const [rel] = await this.db
      .select()
      .from(relationships)
      .where(eq(relationships.id, action.relationshipId))
      .limit(1);

    if (!rel) {
      await this.db
        .update(actions)
        .set({ status: 'FAILED', lastError: 'Relationship record missing', updatedAt: new Date() })
        .where(eq(actions.id, action.id));
      return { status: 'FAILED', error: 'Relationship missing' };
    }

    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, rel.contactId))
      .limit(1);

    // 3. Pre-Send Global Suppression Check (Foundational Safety Invariant)
    if (contact && contact.isSuppressed) {
      await this.db
        .update(actions)
        .set({
          status: 'CANCELLED',
          reason: `Contact ${contact.emailNormalized} is suppressed; send blocked immediately before dispatch.`,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));

      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId,
        relationshipId: action.relationshipId,
        actionId: action.id,
        eventType: 'ACTION_BLOCKED_BY_SUPPRESSION',
        payloadJson: {
          email: contact.emailNormalized,
          suppressionReason: contact.suppressionReason,
        },
        createdAt: new Date(),
      });

      return { status: 'CANCELLED', error: 'Contact is suppressed' };
    }

    // 4. Handle Execution by Action Type
    const rawPayload = action.payloadJson;
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : (rawPayload || {});
    const draft = payload.draft || payload;
    const bodyText = draft.body_text || draft.bodyText || draft.body;
    const subject = draft.subject || payload.subject || 'Digital TST measurement with TBConnect & SmartPatch';

    const isEmailAction = action.type === 'SEND_EMAIL' || action.type === 'REQUEST_APPROVAL' || !!bodyText;

    if (isEmailAction) {
      if (!bodyText) {
        await this.db
          .update(actions)
          .set({ status: 'FAILED', lastError: 'No email draft payload found on action', updatedAt: new Date() })
          .where(eq(actions.id, action.id));
        return { status: 'FAILED', error: 'Missing draft payload' };
      }

      const outboundMsg: OutboundMessage = {
        workspaceId,
        relationshipId: rel.id,
        toEmail: contact.emailNormalized,
        toName: contact.name,
        fromEmail: process.env.RESEND_DEFAULT_FROM || 'contact@tbconnect.in',
        fromName: process.env.SENDER_NAME || 'Dr. Mahek Aneja',
        subject,
        bodyText,
        threadKey: action.relationshipId,
      };

      try {
        // Randomized warmup jitter before dispatching to protect new domain reputation
        if (process.env.NODE_ENV === 'production') {
          const jitterSleepMs = Math.floor(Math.random() * 5000 + 3000); // 3s to 8s
          await new Promise((resolve) => setTimeout(resolve, jitterSleepMs));
        }

        const sendResult = await this.emailSender.send(outboundMsg, action.idempotencyKey);

        if (sendResult.status === 'ACCEPTED') {
          // Success: complete action, save outbound message, update relationship
          await this.db
            .update(actions)
            .set({
              status: 'COMPLETED',
              providerReference: sendResult.providerMessageId || null,
              updatedAt: new Date(),
            })
            .where(eq(actions.id, action.id));

          await this.db.insert(messages).values({
            id: crypto.randomUUID(),
            workspaceId,
            relationshipId: rel.id,
            direction: 'OUTBOUND',
            channel: 'EMAIL',
            subject: outboundMsg.subject,
            bodyText: outboundMsg.bodyText,
            status: 'SENT',
            provider: this.emailSender.name,
            providerMessageId: sendResult.providerMessageId || null,
            sentAt: new Date(),
            createdAt: new Date(),
          });

          await this.db
            .update(relationships)
            .set({
              lastOutboundAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(relationships.id, rel.id));

          await this.db.insert(events).values({
            id: crypto.randomUUID(),
            workspaceId,
            relationshipId: rel.id,
            actionId: action.id,
            eventType: 'ACTION_COMPLETED',
            payloadJson: {
              providerMessageId: sendResult.providerMessageId,
            },
            createdAt: new Date(),
          });

          return { status: 'COMPLETED' };
        } else {
          throw new Error(sendResult.error || 'Email provider rejected send');
        }
      } catch (err: any) {
        // Provider or network error: calculate backoff retry
        const currentAttempt = action.attemptCount;
        const errorMessage = err.message || 'Unknown send failure';

        if (currentAttempt < this.maxAttempts) {
          const backoffDelay = this.baseBackoffMs * Math.pow(2, currentAttempt - 1);
          const nextRunAt = new Date(Date.now() + backoffDelay);

          await this.db
            .update(actions)
            .set({
              status: 'WAITING',
              scheduledAt: nextRunAt,
              lastError: errorMessage,
              updatedAt: new Date(),
            })
            .where(eq(actions.id, action.id));

          await this.db.insert(events).values({
            id: crypto.randomUUID(),
            workspaceId,
            relationshipId: rel.id,
            actionId: action.id,
            eventType: 'ACTION_RETRY_SCHEDULED',
            payloadJson: {
              attemptCount: currentAttempt,
              nextRunAt: nextRunAt.toISOString(),
              error: errorMessage,
            },
            createdAt: new Date(),
          });

          return { status: 'WAITING', error: errorMessage };
        } else {
          // Exhausted all retry attempts
          await this.db
            .update(actions)
            .set({
              status: 'FAILED',
              lastError: `Exhausted ${this.maxAttempts} retry attempts: ${errorMessage}`,
              updatedAt: new Date(),
            })
            .where(eq(actions.id, action.id));

          await this.db.insert(events).values({
            id: crypto.randomUUID(),
            workspaceId,
            relationshipId: rel.id,
            actionId: action.id,
            eventType: 'ACTION_FAILED',
            payloadJson: {
              attempts: currentAttempt,
              error: errorMessage,
            },
            createdAt: new Date(),
          });

          return { status: 'FAILED', error: errorMessage };
        }
      }
    } else {
      // Non-email action (MARK_COMPLETE, NO_ACTION, etc.)
      await this.db
        .update(actions)
        .set({
          status: 'COMPLETED',
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));

      return { status: 'COMPLETED' };
    }
  }

  /**
   * Runs one full execution cycle claiming and processing due actions up to maxBatch
   */
  async runWorkerCycle(workspaceId: string, maxBatch = 10): Promise<WorkerCycleResult> {
    // 0. Auto-sync Hostinger IMAP inbox if configured
    try {
      if (process.env.IMAP_PASSWORD || process.env.IMAP_PASS) {
        const { HostingerImapListener } = await import('@/providers/email/imap-listener');
        const listener = new HostingerImapListener(undefined, this.db);
        await listener.syncInbox(workspaceId);
      }
    } catch (imapErr) {
      console.error('Non-blocking IMAP sync error during worker cycle:', imapErr);
    }

    const summary: WorkerCycleResult = {
      claimedCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      retriedCount: 0,
    };

    for (let i = 0; i < maxBatch; i++) {
      const claimed = await this.claimNextAction(workspaceId);
      if (!claimed) break;

      summary.claimedCount++;
      const result = await this.processAction(claimed);

      if (result.status === 'COMPLETED') summary.completedCount++;
      else if (result.status === 'FAILED') summary.failedCount++;
      else if (result.status === 'CANCELLED') summary.cancelledCount++;
      else if (result.status === 'WAITING') summary.retriedCount++;
    }

    return summary;
  }
}

import { eq, and, inArray } from 'drizzle-orm';
import { contacts, relationships, actions, messages, events } from '@/db/schema';
import { InboundEvent, InboundMessage } from '@/providers/types';
import { DecisionEngine } from '@/core/relationships/decision-engine';

export interface ProcessEventResult {
  eventType: string;
  duplicate: boolean;
  suppressedContact?: string;
  cancelledActionsCount?: number;
  decisionResult?: any;
}

export class DeliveryEventsProcessor {
  constructor(
    private db: any,
    private decisionEngine?: DecisionEngine
  ) {}

  /**
   * Processes a Resend or Email delivery event with replay protection and automatic suppression
   */
  async processEvent(workspaceId: string, event: InboundEvent): Promise<ProcessEventResult> {
    const externalEventId = event.providerEventId;

    // 1. Replay Protection: Check if event was already processed
    if (externalEventId) {
      const [existing] = await this.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.workspaceId, workspaceId),
            eq(events.externalEventId, externalEventId)
          )
        )
        .limit(1);

      if (existing) {
        return {
          eventType: event.eventType,
          duplicate: true,
        };
      }
    }

    const payload = event.rawPayload?.data || event.rawPayload || {};
    const recipientEmail = (
      Array.isArray(payload.to) ? payload.to[0] : payload.to || payload.recipient || ''
    ).toLowerCase();

    // 2. Handle Bounce Event
    if (event.eventType === 'email.bounced' || event.eventType === 'bounce') {
      let cancelledCount = 0;
      if (recipientEmail) {
        // Find contact
        const [contact] = await this.db
          .select()
          .from(contacts)
          .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.emailNormalized, recipientEmail)))
          .limit(1);

        if (contact) {
          await this.db
            .update(contacts)
            .set({
              isSuppressed: true,
              suppressionReason: 'Email bounced (hard bounce)',
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));

          // Cancel any pending outreach for this contact
          const contactRels = await this.db
            .select()
            .from(relationships)
            .where(and(eq(relationships.workspaceId, workspaceId), eq(relationships.contactId, contact.id)));

          if (contactRels.length > 0) {
            const relIds = contactRels.map((r: any) => r.id);
            const pending = await this.db
              .select()
              .from(actions)
              .where(
                and(
                  eq(actions.workspaceId, workspaceId),
                  inArray(actions.relationshipId, relIds),
                  inArray(actions.status, ['PENDING', 'WAITING', 'AWAITING_APPROVAL'])
                )
              );

            if (pending.length > 0) {
              cancelledCount = pending.length;
              await this.db
                .update(actions)
                .set({
                  status: 'CANCELLED',
                  reason: 'Contact suppressed due to email bounce',
                  updatedAt: new Date(),
                })
                .where(inArray(actions.id, pending.map((a: any) => a.id)));
            }
          }
        }
      }

      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId,
        eventType: 'CONTACT_SUPPRESSED_BOUNCE',
        externalEventId,
        payloadJson: { recipientEmail, reason: payload.reason || 'Hard bounce' },
        createdAt: new Date(),
      });

      return {
        eventType: event.eventType,
        duplicate: false,
        suppressedContact: recipientEmail,
        cancelledActionsCount: cancelledCount,
      };
    }

    // 3. Handle Spam Complaint Event
    if (event.eventType === 'email.complained' || event.eventType === 'complaint') {
      let cancelledCount = 0;
      if (recipientEmail) {
        const [contact] = await this.db
          .select()
          .from(contacts)
          .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.emailNormalized, recipientEmail)))
          .limit(1);

        if (contact) {
          await this.db
            .update(contacts)
            .set({
              isSuppressed: true,
              suppressionReason: 'Spam complaint registered',
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));

          const contactRels = await this.db
            .select()
            .from(relationships)
            .where(and(eq(relationships.workspaceId, workspaceId), eq(relationships.contactId, contact.id)));

          if (contactRels.length > 0) {
            const relIds = contactRels.map((r: any) => r.id);
            const pending = await this.db
              .select()
              .from(actions)
              .where(
                and(
                  eq(actions.workspaceId, workspaceId),
                  inArray(actions.relationshipId, relIds),
                  inArray(actions.status, ['PENDING', 'WAITING', 'AWAITING_APPROVAL'])
                )
              );

            if (pending.length > 0) {
              cancelledCount = pending.length;
              await this.db
                .update(actions)
                .set({
                  status: 'CANCELLED',
                  reason: 'Contact suppressed due to spam complaint',
                  updatedAt: new Date(),
                })
                .where(inArray(actions.id, pending.map((a: any) => a.id)));
            }
          }
        }
      }

      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId,
        eventType: 'CONTACT_SUPPRESSED_COMPLAINT',
        externalEventId,
        payloadJson: { recipientEmail },
        createdAt: new Date(),
      });

      return {
        eventType: event.eventType,
        duplicate: false,
        suppressedContact: recipientEmail,
        cancelledActionsCount: cancelledCount,
      };
    }

    // 4. Handle Delivery Confirmation Event
    if (event.eventType === 'email.delivered') {
      const emailId = payload.email_id || payload.id;
      if (emailId) {
        await this.db
          .update(messages)
          .set({ status: 'DELIVERED' })
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              eq(messages.providerMessageId, emailId)
            )
          );
      }

      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId,
        eventType: 'EVENT_EMAIL_DELIVERED',
        externalEventId,
        payloadJson: { emailId, recipientEmail },
        createdAt: new Date(),
      });

      return { eventType: event.eventType, duplicate: false };
    }

    // 5. Inbound Email Received
    if (event.eventType === 'email.received' && this.decisionEngine) {
      const decisionResult = await this.decisionEngine.processInboundMessage({
        workspaceId,
        fromEmail: recipientEmail || payload.from,
        fromName: payload.from_name,
        subject: payload.subject,
        bodyText: payload.text || payload.body || '',
        provider: 'resend',
        providerMessageId: externalEventId,
      });

      return {
        eventType: event.eventType,
        duplicate: false,
        decisionResult,
      };
    }

    // Default audit event
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId,
      eventType: `EVENT_${event.eventType.toUpperCase().replace(/\./g, '_')}`,
      externalEventId,
      payloadJson: payload,
      createdAt: new Date(),
    });

    return { eventType: event.eventType, duplicate: false };
  }
}

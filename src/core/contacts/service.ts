import { eq, and, desc, like, or } from 'drizzle-orm';
import { contacts, relationships, messages, events, agents } from '@/db/schema';
import type { Contact } from '@/db/schema';

export interface ListContactsParams {
  workspaceId: string;
  search?: string;
  isSuppressed?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
}

export class ContactService {
  constructor(private db: any) {}

  /**
   * Lists contacts with workspace isolation, search and suppression filters
   */
  async listContacts(params: ListContactsParams) {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let conditions = [eq(contacts.workspaceId, params.workspaceId)];

    if (params.isSuppressed !== undefined) {
      conditions.push(eq(contacts.isSuppressed, params.isSuppressed));
    }

    if (params.status) {
      conditions.push(eq(contacts.status, params.status));
    }

    const query = this.db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    const items: Contact[] = await query;

    // In-memory or like search filter if provided
    let filtered = items;
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.emailNormalized.toLowerCase().includes(q) ||
          (c.organisation && c.organisation.toLowerCase().includes(q))
      );
    }

    return {
      contacts: filtered,
      total: filtered.length,
    };
  }

  /**
   * Retrieves single contact details with verified tenant isolation
   */
  async getContact(workspaceId: string, contactId: string): Promise<Contact | null> {
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
      .limit(1);

    return contact || null;
  }

  /**
   * Retrieves full relationship details, agent info, messages and event logs for a contact
   */
  async getContactFullProfile(workspaceId: string, contactId: string) {
    const contact = await this.getContact(workspaceId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found in workspace ${workspaceId}`);
    }

    const relList = await this.db
      .select()
      .from(relationships)
      .where(and(eq(relationships.contactId, contactId), eq(relationships.workspaceId, workspaceId)));

    const relationship = relList[0] || null;

    let agent = null;
    let contactMessages: any[] = [];
    let auditEvents: any[] = [];

    if (relationship) {
      const [ag] = await this.db
        .select()
        .from(agents)
        .where(eq(agents.id, relationship.agentId))
        .limit(1);
      agent = ag || null;

      contactMessages = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            eq(messages.relationshipId, relationship.id)
          )
        )
        .orderBy(desc(messages.createdAt));

      auditEvents = await this.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.workspaceId, workspaceId),
            eq(events.relationshipId, relationship.id)
          )
        )
        .orderBy(desc(events.createdAt))
        .limit(25);
    }

    return {
      contact,
      relationship,
      agent,
      messages: contactMessages,
      events: auditEvents,
    };
  }

  /**
   * Updates contact suppression status with audit log
   */
  async setSuppression(params: {
    workspaceId: string;
    contactId: string;
    isSuppressed: boolean;
    reason?: string;
    userId: string;
  }): Promise<Contact> {
    const contact = await this.getContact(params.workspaceId, params.contactId);
    if (!contact) {
      throw new Error(`Contact ${params.contactId} not found in workspace ${params.workspaceId}`);
    }

    const [updated] = await this.db
      .update(contacts)
      .set({
        isSuppressed: params.isSuppressed,
        suppressionReason: params.isSuppressed ? (params.reason || 'Manually suppressed by operator') : null,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contact.id))
      .returning();

    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      eventType: params.isSuppressed ? 'CONTACT_SUPPRESSED' : 'CONTACT_UNSUPPRESSED',
      payloadJson: {
        contactId: contact.id,
        email: contact.emailNormalized,
        isSuppressed: params.isSuppressed,
        reason: params.reason,
        userId: params.userId,
      },
      createdAt: new Date(),
    });

    return updated;
  }
}

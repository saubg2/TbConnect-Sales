import { getDbAsync } from '@/db/client';
import { contacts, relationships, messages, actions, events } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface WorkspaceExportData {
  workspaceId: string;
  exportedAt: string;
  contactsCount: number;
  relationshipsCount: number;
  messagesCount: number;
  actionsCount: number;
  eventsCount: number;
  data: {
    contacts: any[];
    relationships: any[];
    messages: any[];
    actions: any[];
    events: any[];
  };
}

export class ComplianceService {
  /**
   * Export all workspace data for portability & backup compliance
   */
  static async exportWorkspaceData(workspaceId: string, customDb?: any): Promise<WorkspaceExportData> {
    const db = customDb || (await getDbAsync());
    const [cList, rList, mList, aList, eList] = await Promise.all([
      db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId)),
      db.select().from(relationships).where(eq(relationships.workspaceId, workspaceId)),
      db.select().from(messages).where(eq(messages.workspaceId, workspaceId)),
      db.select().from(actions).where(eq(actions.workspaceId, workspaceId)),
      db.select().from(events).where(eq(events.workspaceId, workspaceId)),
    ]);

    return {
      workspaceId,
      exportedAt: new Date().toISOString(),
      contactsCount: cList.length,
      relationshipsCount: rList.length,
      messagesCount: mList.length,
      actionsCount: aList.length,
      eventsCount: eList.length,
      data: {
        contacts: cList,
        relationships: rList,
        messages: mList,
        actions: aList,
        events: eList,
      },
    };
  }

  /**
   * Erase a contact and their associated relationships, messages, and actions (Right to be Forgotten)
   */
  static async deleteContactData(
    workspaceId: string,
    contactId: string,
    actorId = 'system',
    customDb?: any
  ): Promise<{ success: boolean; erasedId: string }> {
    const db = customDb || (await getDbAsync());
    // Record privacy audit event before deletion
    await db.insert(events).values({
      workspaceId,
      eventType: 'CONTACT_PURGED_PRIVACY_REQUEST',
      payloadJson: { requestedAt: new Date().toISOString(), contactId, actorId },
    });

    // Cascading delete configured on database schema for contacts -> relationships, messages, actions
    await db.delete(contacts).where(eq(contacts.id, contactId));

    return { success: true, erasedId: contactId };
  }
}

import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { actions, contacts, messages, relationships } from '@/db/schema';
import type { Relationship } from '@/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const db = await getDbAsync();

    // Inbox contains actual inbound conversations and reply drafts requiring attention,
    // not every cold-outreach relationship in the CRM.
    const relList: Relationship[] = await db.select().from(relationships)
      .where(and(
        eq(relationships.workspaceId, workspaceId),
        sql`(
          exists (select 1 from messages m
            where m.relationship_id = ${relationships.id} and m.direction = 'INBOUND')
          or exists (select 1 from actions a
            where a.relationship_id = ${relationships.id}
              and a.status in ('AWAITING_APPROVAL', 'WAITING', 'PENDING'))
        )`,
      ))
      .orderBy(desc(relationships.updatedAt));

    if (relList.length === 0) {
      return NextResponse.json({ relationships: [], contacts: [], messages: [], actions: [] });
    }

    const relationshipIds = relList.map(record => record.id);
    const contactIds = [...new Set(relList.map(record => record.contactId))];
    const [contactList, messageList, actionList] = await Promise.all([
      db.select().from(contacts).where(and(
        eq(contacts.workspaceId, workspaceId),
        inArray(contacts.id, contactIds),
      )),
      db.select().from(messages).where(and(
        eq(messages.workspaceId, workspaceId),
        inArray(messages.relationshipId, relationshipIds),
      )).orderBy(desc(messages.createdAt)),
      db.select().from(actions).where(and(
        eq(actions.workspaceId, workspaceId),
        inArray(actions.relationshipId, relationshipIds),
        inArray(actions.status, ['AWAITING_APPROVAL', 'WAITING', 'PENDING']),
      )).orderBy(desc(actions.createdAt)),
    ]);

    return NextResponse.json({
      relationships: relList,
      contacts: contactList,
      messages: messageList,
      actions: actionList,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

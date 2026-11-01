import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { workspaces, agents, contacts, relationships, messages, actions, events } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = await getDbAsync();

    const [wsList, agList, ctList, relList, msgList, actList, evtList] = await Promise.all([
      db.select().from(workspaces),
      db.select().from(agents),
      db.select().from(contacts).orderBy(desc(contacts.createdAt)),
      db.select().from(relationships).orderBy(desc(relationships.updatedAt)),
      db.select().from(messages).orderBy(desc(messages.createdAt)),
      db.select().from(actions).orderBy(desc(actions.createdAt)),
      db.select().from(events).orderBy(desc(events.createdAt)).limit(50),
    ]);

    return NextResponse.json({
      workspaces: wsList,
      agents: agList,
      contacts: ctList,
      relationships: relList,
      messages: msgList,
      actions: actList,
      events: evtList,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { contacts, deals, organizations, relationships } from '@/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const db = await getDbAsync();
    const records = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        emailNormalized: contacts.emailNormalized,
        organizationId: contacts.organizationId,
        organisation: contacts.organisation,
        organizationType: organizations.type,
        organizationWebsite: organizations.website,
        organizationAddress: organizations.address,
        organizationCountry: organizations.country,
        organizationOwner: organizations.owner,
        organizationPhone: organizations.phone,
        organizationNotes: organizations.notes,
        country: contacts.country,
        status: contacts.status,
        isSuppressed: contacts.isSuppressed,
        suppressionReason: contacts.suppressionReason,
        createdAt: contacts.createdAt,
        relationshipId: relationships.id,
        stage: relationships.stage,
      })
      .from(contacts)
      .leftJoin(
        organizations,
        and(
          eq(organizations.id, contacts.organizationId),
          eq(organizations.workspaceId, workspaceId)
        )
      )
      .leftJoin(
        relationships,
        and(
          eq(relationships.contactId, contacts.id),
          eq(relationships.workspaceId, workspaceId)
        )
      )
      .where(eq(contacts.workspaceId, workspaceId))
      .orderBy(desc(contacts.updatedAt));

    const dealRecords = await db.select().from(deals)
      .where(eq(deals.workspaceId, workspaceId)).orderBy(desc(deals.updatedAt));
    return NextResponse.json({ records, deals: dealRecords, total: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

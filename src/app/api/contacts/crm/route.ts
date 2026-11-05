import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { contacts, organizations, relationships } from '@/db/schema';

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
        tagsJson: contacts.tagsJson,
        status: contacts.status,
        isSuppressed: contacts.isSuppressed,
        suppressionReason: contacts.suppressionReason,
        createdAt: contacts.createdAt,
        relationshipId: relationships.id,
        stage: relationships.stage,
        summary: relationships.summary,
        lastInboundAt: relationships.lastInboundAt,
        lastOutboundAt: relationships.lastOutboundAt,
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

    return NextResponse.json({ records, total: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

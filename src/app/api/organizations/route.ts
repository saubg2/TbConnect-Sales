import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { organizations } from '@/db/schema';
import { classifyOrganizationType } from '@/core/organizations/classify';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const db = await getDbAsync();
    const records = await db.select().from(organizations)
      .where(eq(organizations.workspaceId, workspaceId))
      .orderBy(asc(organizations.name));
    return NextResponse.json({ organizations: records, total: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    const db = await getDbAsync();
    const [organization] = await db.insert(organizations).values({
      id: crypto.randomUUID(),
      workspaceId: body.workspaceId || 'ws_default',
      name,
      type: body.type || classifyOrganizationType(name),
      website: body.website || null,
      address: body.address || null,
      country: body.country || null,
      owner: body.owner || null,
      phone: body.phone || null,
      notes: body.notes || null,
    }).returning();
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

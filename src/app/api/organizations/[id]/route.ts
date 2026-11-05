import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { organizations } from '@/db/schema';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const allowed = ['name', 'type', 'website', 'address', 'country', 'owner', 'phone', 'notes'] as const;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key] || null;
    }
    const db = await getDbAsync();
    const [organization] = await db.update(organizations).set(update)
      .where(and(eq(organizations.id, params.id), eq(organizations.workspaceId, workspaceId)))
      .returning();
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json({ organization });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

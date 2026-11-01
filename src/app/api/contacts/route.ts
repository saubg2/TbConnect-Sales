import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { ContactService } from '@/core/contacts/service';
import { contacts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const search = searchParams.get('search') || undefined;
    const isSuppressed = searchParams.has('isSuppressed')
      ? searchParams.get('isSuppressed') === 'true'
      : undefined;

    const db = await getDbAsync();
    const service = new ContactService(db);
    const result = await service.listContacts({
      workspaceId,
      search,
      isSuppressed,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const emailNormalized = body.email.trim().toLowerCase();

    const db = await getDbAsync();

    // Deduplication check
    const [existing] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.emailNormalized, emailNormalized)))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Contact with this email already exists in workspace' }, { status: 409 });
    }

    const [newContact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        name: body.name || emailNormalized.split('@')[0],
        emailNormalized,
        organisation: body.organisation || null,
        country: body.country || null,
        tagsJson: body.tags || [],
        sourceJson: { type: 'manual_entry', created_by: body.userId || 'operator' },
        status: 'ACTIVE',
        isSuppressed: !!body.isSuppressed,
        suppressionReason: body.isSuppressed ? (body.suppressionReason || 'Manually flagged') : null,
      })
      .returning();

    return NextResponse.json({ contact: newContact }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

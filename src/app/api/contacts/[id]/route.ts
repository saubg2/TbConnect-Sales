import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { ContactService } from '@/core/contacts/service';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const db = await getDbAsync();
    const service = new ContactService(db);
    const profile = await service.getContactFullProfile(workspaceId, params.id);

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const db = await getDbAsync();
    const service = new ContactService(db);

    if (body.isSuppressed !== undefined) {
      const updated = await service.setSuppression({
        workspaceId,
        contactId: params.id,
        isSuppressed: body.isSuppressed,
        reason: body.suppressionReason || body.reason,
        userId: body.userId || 'operator',
      });
      return NextResponse.json({ contact: updated });
    }

    return NextResponse.json({ error: 'No valid patch parameters provided' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

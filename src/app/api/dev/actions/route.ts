import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { ActionService } from '@/core/actions/service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, workspaceId = 'ws_default', actionId, approvedBy = 'dev_operator' } = body;

    const db = await getDbAsync();
    const actionService = new ActionService(db);

    if (action === 'approve') {
      const updated = await actionService.approveAction({
        workspaceId,
        actionId,
        approvedBy,
        expectedDraftVersion: body.expectedDraftVersion,
      });
      return NextResponse.json({ success: true, action: updated });
    }

    if (action === 'edit') {
      const updated = await actionService.editDraftAction({
        workspaceId,
        actionId,
        newBodyText: body.newBodyText,
        newSubject: body.newSubject,
        editedBy: approvedBy,
      });
      return NextResponse.json({ success: true, action: updated });
    }

    if (action === 'reject') {
      const updated = await actionService.rejectAction({
        workspaceId,
        actionId,
        rejectedBy: approvedBy,
        reason: body.reason,
      });
      return NextResponse.json({ success: true, action: updated });
    }

    return NextResponse.json({ error: 'Unknown action verb' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

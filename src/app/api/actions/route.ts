import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { actions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ActionWorker } from '@/jobs/action-worker';
import { MockEmailProvider } from '@/providers/email/mock';
import { ActionService } from '@/core/actions/service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const status = searchParams.get('status') || undefined;

    const db = await getDbAsync();
    let query = db.select().from(actions).where(eq(actions.workspaceId, workspaceId));

    if (status && status !== 'all') {
      query = db
        .select()
        .from(actions)
        .where(and(eq(actions.workspaceId, workspaceId), eq(actions.status, status)));
    }

    const items = await query.orderBy(desc(actions.createdAt));
    return NextResponse.json({ actions: items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const db = await getDbAsync();

    // Trigger queue execution worker
    if (body.action === 'run_worker') {
      const mockEmail = new MockEmailProvider();
      const worker = new ActionWorker(db, { emailSender: mockEmail });
      const summary = await worker.runWorkerCycle(workspaceId);
      return NextResponse.json({ success: true, summary });
    }

    // Standard action transitions
    const actionService = new ActionService(db);
    if (body.action === 'approve') {
      const approved = await actionService.approveAction({
        workspaceId,
        actionId: body.actionId,
        approvedBy: body.approvedBy || 'web_operator',
        expectedDraftVersion: body.expectedDraftVersion,
      });
      return NextResponse.json({ success: true, action: approved });
    }

    if (body.action === 'edit') {
      const edited = await actionService.editDraftAction({
        workspaceId,
        actionId: body.actionId,
        newBodyText: body.newBodyText,
        newSubject: body.newSubject,
        editedBy: body.editedBy || 'web_operator',
      });
      return NextResponse.json({ success: true, action: edited });
    }

    if (body.action === 'reject') {
      const rejected = await actionService.rejectAction({
        workspaceId,
        actionId: body.actionId,
        rejectedBy: body.rejectedBy || 'web_operator',
        reason: body.reason,
      });
      return NextResponse.json({ success: true, action: rejected });
    }

    return NextResponse.json({ error: 'Unknown action parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { actions, memberships, relationships, contacts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ActionWorker } from '@/jobs/action-worker';
import { MockEmailProvider } from '@/providers/email/mock';
import { ActionService } from '@/core/actions/service';
import { TelegramBotService } from '@/providers/telegram/bot';
import { TelegramAuthService } from '@/providers/telegram/auth';

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
      const emailProviderType = process.env.EMAIL_PROVIDER || 'mock';
      let emailSender: any;
      if (emailProviderType === 'resend') {
        const { ResendEmailSender } = await import('@/providers/email/resend');
        emailSender = new ResendEmailSender();
      } else {
        emailSender = new MockEmailProvider();
      }
      const worker = new ActionWorker(db, { emailSender });
      const summary = await worker.runWorkerCycle(workspaceId);
      return NextResponse.json({ success: true, summary });
    }

    // Push pending approval alerts to Telegram
    if (body.action === 'notify_telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const botService = new TelegramBotService({ botToken }, db);

      const allMembers = await db.select().from(memberships).where(eq(memberships.workspaceId, workspaceId));
      const linkedMember = allMembers.find((m: any) => {
        const rawPerms = m.permissionsJson ?? m.permissions_json ?? {};
        const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
        return !!perms.telegram?.chatId;
      });

      if (!linkedMember) {
        return NextResponse.json({ error: 'No Telegram account linked' }, { status: 400 });
      }

      const rawPerms = linkedMember.permissionsJson ?? linkedMember.permissions_json ?? {};
      const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
      const chatId = perms.telegram.chatId;

      const pendingActions = await db
        .select()
        .from(actions)
        .where(and(eq(actions.workspaceId, workspaceId), eq(actions.status, 'AWAITING_APPROVAL')));

      let sentCount = 0;
      for (const act of pendingActions) {
        const payload = (act.payloadJson as Record<string, any>) || {};
        const [rel] = await db.select().from(relationships).where(eq(relationships.id, act.relationshipId)).limit(1);
        let contactName = 'Researcher';
        let contactEmail = 'lead@university.edu';
        if (rel) {
          const [cnt] = await db.select().from(contacts).where(eq(contacts.id, rel.contactId)).limit(1);
          if (cnt) {
            contactName = cnt.name;
            contactEmail = cnt.emailNormalized;
          }
        }

        await botService.sendApprovalAlert(chatId, {
          actionId: act.id,
          draftVersion: act.approvedDraftVersion || 1,
          contactName,
          recipientEmail: contactEmail,
          subject: payload.subject || 'Digital TST measurement with TBConnect & SmartPatch',
          bodyText: payload.bodyText || payload.body || '',
          reason: act.reason || 'Curiosity-driven Cold Outreach',
        });
        sentCount++;
      }

      return NextResponse.json({ success: true, sentCount });
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

import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { TelegramAuthService } from '@/providers/telegram/auth';
import { TelegramBotService } from '@/providers/telegram/bot';
import { ActionService } from '@/core/actions/service';

export async function POST(req: Request) {
  try {
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (configuredSecret && secretToken !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook secret' }, { status: 401 });
    }

    const update = await req.json();
    const db = await getDbAsync();
    const authService = new TelegramAuthService(db);
    const botService = new TelegramBotService(undefined, db);
    const actionService = new ActionService(db);

    // 1. Handle Messages (e.g. /start link_<code>)
    if (update.message) {
      const msg = update.message;
      const text = msg.text || '';
      const chatId = String(msg.chat.id);
      const userId = String(msg.from.id);
      const username = msg.from.username;

      if (text.startsWith('/start link_')) {
        const code = text.replace('/start ', '').trim();
        try {
          const linked = await authService.linkTelegramUser(code, chatId, userId, username);
          await botService.sendInboundAlert(chatId, {
            fromName: 'TBConnect Alert Bot',
            fromEmail: 'contact@tbconnect.in',
            subject: 'Account Linked Successfully',
            summary: `Your Telegram account is now securely linked to Workspace (${linked.workspaceId}). You will receive real-time approval requests and critical alerts here.`,
          });
        } catch (err: any) {
          // Send error notice back to chat
          await botService.sendInboundAlert(chatId, {
            fromName: 'Linking Error',
            fromEmail: 'contact@tbconnect.in',
            subject: 'Account Linking Failed',
            summary: err.message || 'Invalid or expired linking token. Please generate a new link in Settings.',
          });
        }
      } else if (text.startsWith('/start')) {
        await botService.sendInboundAlert(chatId, {
          fromName: 'TBConnect Alert Bot',
          fromEmail: 'contact@tbconnect.in',
          subject: 'Welcome to TBConnect Outreach Alerts',
          summary: 'To link your Telegram account to your workspace, please open Settings (https://tbconnect-sales-production.up.railway.app/settings), click "Generate 1-Time Link Token", and open the generated link.',
        });
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle Inline Callback Queries (Approve, Reject)
    if (update.callback_query) {
      const cb = update.callback_query;
      const fromUserId = String(cb.from.id);
      const username = cb.from.username || cb.from.first_name || 'operator';
      const data = cb.data || '';
      const messageId = cb.message?.message_id;
      const chatId = String(cb.message?.chat?.id || fromUserId);

      // Verify that caller is an authorized member
      const member = await authService.getMemberByTelegramUser(fromUserId);
      if (!member) {
        await botService.answerCallbackQuery(
          cb.id,
          '❌ Unauthorized: Your Telegram account is not linked to any workspace.',
          true
        );
        return NextResponse.json({ ok: true });
      }

      const parts = data.split(':');
      const verb = parts[0];
      const actionId = parts[1];
      const draftVersion = parts[2] ? parseInt(parts[2], 10) : undefined;

      if (verb === 'appr') {
        try {
          await actionService.approveAction({
            workspaceId: member.workspaceId,
            actionId,
            approvedBy: `telegram:@${username}`,
            expectedDraftVersion: draftVersion,
          });

          await botService.answerCallbackQuery(cb.id, '✅ Action approved and queued for sending!');
          if (messageId) {
            await botService.updateMessageStatus(chatId, messageId, `✅ Approved by @${username}`);
          }
        } catch (err: any) {
          await botService.answerCallbackQuery(cb.id, `⚠️ ${err.message}`, true);
        }
      } else if (verb === 'rejc') {
        try {
          await actionService.rejectAction({
            workspaceId: member.workspaceId,
            actionId,
            rejectedBy: `telegram:@${username}`,
            reason: 'Rejected via Telegram button',
          });

          await botService.answerCallbackQuery(cb.id, '❌ Action cancelled.');
          if (messageId) {
            await botService.updateMessageStatus(chatId, messageId, `❌ Rejected by @${username}`);
          }
        } catch (err: any) {
          await botService.answerCallbackQuery(cb.id, `⚠️ ${err.message}`, true);
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

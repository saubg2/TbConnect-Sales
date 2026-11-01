import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { TelegramBotService } from '@/providers/telegram/bot';
import { memberships } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const db = await getDbAsync();
    const members = await db
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId));

    const linked = members.find((m: any) => {
      const rawPerms = m.permissionsJson ?? m.permissions_json ?? {};
      const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
      return !!perms.telegram?.chatId;
    });

    if (!linked) {
      return NextResponse.json({ error: 'No Telegram account linked yet' }, { status: 400 });
    }

    const rawPerms = linked.permissionsJson ?? linked.permissions_json ?? {};
    const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
    const chatId = perms.telegram.chatId;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botService = new TelegramBotService({ botToken }, db);

    const res = await botService.sendInboundAlert(chatId, {
      fromName: 'TBConnect Alert Bot',
      fromEmail: 'contact@tbconnect.in',
      subject: '✅ Telegram Integration Active',
      summary: 'Connection confirmed! You will receive real-time approval requests and incoming reply notifications here.',
    });

    return NextResponse.json({ success: true, result: res });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

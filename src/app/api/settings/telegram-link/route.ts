import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { TelegramAuthService } from '@/providers/telegram/auth';
import { memberships } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const db = await getDbAsync();
    const members = await db
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId));

    const linkedOperators = members.map((m: any) => {
      const perms = (m.permissionsJson as Record<string, any>) || {};
      return {
        userId: m.userId,
        role: m.role,
        telegramLinked: !!perms.telegram,
        telegramUsername: perms.telegram?.username,
        telegramChatId: perms.telegram?.chatId,
        linkedAt: perms.telegram?.linkedAt,
      };
    });

    return NextResponse.json({ members: linkedOperators });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || 'ws_default';

    const db = await getDbAsync();

    // Ensure member exists
    const [existingMember] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .limit(1);

    const userId = existingMember ? existingMember.userId : (body.userId || 'usr_default_admin');

    if (!existingMember) {
      await db.insert(memberships).values({
        id: crypto.randomUUID(),
        workspaceId,
        userId,
        role: 'operator',
        permissionsJson: {},
      });
    }

    const authService = new TelegramAuthService(db);
    const code = await authService.generateLinkingTokenAsync(workspaceId, userId);
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tbconnect-sales-production.up.railway.app';
    let botHandle = process.env.TELEGRAM_BOT_HANDLE || 'RelationshipAgentBot';

    if (botToken) {
      try {
        // 1. Auto-fetch bot's exact username from Telegram
        const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const meData = await meRes.json();
        if (meData.ok && meData.result?.username) {
          botHandle = meData.result.username;
        }

        // 2. Auto-register webhook with Telegram
        const webhookUrl = `${appUrl}/api/webhooks/telegram`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      } catch (err) {
        console.error('Error auto-configuring Telegram webhook:', err);
      }
    }

    const linkUrl = `https://t.me/${botHandle}?start=${code}`;

    return NextResponse.json({
      success: true,
      code,
      linkUrl,
      botHandle,
      expiresInMinutes: 15,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

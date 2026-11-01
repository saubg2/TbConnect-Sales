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
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const userId = body.userId || 'dev_operator';

    const db = await getDbAsync();

    // Ensure member exists
    const [existingMember] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .limit(1);

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
    const code = authService.generateLinkingToken(workspaceId, userId);
    const botHandle = process.env.TELEGRAM_BOT_HANDLE || 'RelationshipAgentBot';
    const linkUrl = `https://t.me/${botHandle}?start=${code}`;

    return NextResponse.json({
      success: true,
      code,
      linkUrl,
      expiresInMinutes: 15,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

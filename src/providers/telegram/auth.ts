import { eq, and } from 'drizzle-orm';
import { memberships, workspaces, events } from '@/db/schema';

export interface TelegramLinkToken {
  code: string;
  workspaceId: string;
  userId: string;
  expiresAt: number;
}

// In-memory token cache for single-use linking codes (15 min TTL)
const linkingTokens = new Map<string, TelegramLinkToken>();

export class TelegramAuthService {
  constructor(private db: any) {}

  private async persistTokenToDb(workspaceId: string, userId: string, code: string, expiresAt: number) {
    try {
      let [membership] = await this.db
        .select()
        .from(memberships)
        .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
        .limit(1);

      if (!membership) {
        [membership] = await this.db
          .select()
          .from(memberships)
          .where(eq(memberships.workspaceId, workspaceId))
          .limit(1);
      }

      if (membership) {
        const rawPerms = membership.permissionsJson ?? membership.permissions_json ?? {};
        const currentPerms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
        await this.db
          .update(memberships)
          .set({
            permissionsJson: {
              ...currentPerms,
              pendingLinkToken: { code, expiresAt },
            },
          })
          .where(eq(memberships.id, membership.id));
      }
    } catch (e) {
      console.error('Error saving pendingLinkToken to DB:', e);
    }
  }

  async persistToken(workspaceId: string, userId: string, code: string, expiresAt?: number) {
    await this.persistTokenToDb(workspaceId, userId, code, expiresAt || (Date.now() + 15 * 60 * 1000));
  }

  /**
   * Generates a secure, short-lived (15 min) one-time linking token
   */
  generateLinkingToken(workspaceId: string, userId: string): string {
    const code = `link_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const expiresAt = Date.now() + 15 * 60 * 1000;

    linkingTokens.set(code, {
      code,
      workspaceId,
      userId,
      expiresAt,
    });

    this.persistTokenToDb(workspaceId, userId, code, expiresAt);

    return code;
  }

  async generateLinkingTokenAsync(workspaceId: string, userId: string): Promise<string> {
    const code = this.generateLinkingToken(workspaceId, userId);
    await this.persistToken(workspaceId, userId, code);
    return code;
  }

  /**
   * Binds a Telegram user and chat ID to a workspace membership using the one-time code
   */
  async linkTelegramUser(code: string, telegramChatId: string, telegramUserId: string, telegramUsername?: string) {
    let token = linkingTokens.get(code);

    let targetMembership: any = null;
    if (!token) {
      try {
        const allMembers = await this.db.select().from(memberships);
        targetMembership = allMembers.find((m: any) => {
          const rawPerms = m.permissionsJson ?? m.permissions_json ?? {};
          const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
          return perms.pendingLinkToken?.code === code;
        });
        if (targetMembership) {
          const rawPerms = targetMembership.permissionsJson ?? targetMembership.permissions_json ?? {};
          const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
          const pt = perms.pendingLinkToken;
          token = {
            code: pt.code,
            workspaceId: targetMembership.workspaceId || targetMembership.workspace_id,
            userId: targetMembership.userId || targetMembership.user_id,
            expiresAt: pt.expiresAt,
          };
        }
      } catch (e) {
        console.error('Error querying token from DB:', e);
      }
    }

    if (!token) {
      throw new Error('Invalid or expired linking token');
    }

    if (Date.now() > token.expiresAt) {
      linkingTokens.delete(code);
      throw new Error('Linking token has expired');
    }

    // Single-use token: remove immediately
    linkingTokens.delete(code);

    const [membership] = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, token.workspaceId), eq(memberships.userId, token.userId)))
      .limit(1);

    const target = membership || targetMembership;

    if (!target) {
      throw new Error(`Membership not found for user ${token.userId} in workspace ${token.workspaceId}`);
    }

    const rawCurrentPerms = target.permissionsJson ?? target.permissions_json ?? {};
    const currentPerms = typeof rawCurrentPerms === 'string' ? JSON.parse(rawCurrentPerms) : rawCurrentPerms;
    const { pendingLinkToken, ...cleanPerms } = currentPerms;
    const updatedPerms = {
      ...cleanPerms,
      telegram: {
        chatId: telegramChatId,
        userId: telegramUserId,
        username: telegramUsername || null,
        linkedAt: new Date().toISOString(),
      },
    };

    await this.db
      .update(memberships)
      .set({
        permissionsJson: updatedPerms,
      })
      .where(eq(memberships.id, target.id));

    // Append audit event
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: token.workspaceId,
      eventType: 'TELEGRAM_ACCOUNT_LINKED',
      payloadJson: {
        userId: token.userId,
        telegramChatId,
        telegramUserId,
        telegramUsername,
      },
      createdAt: new Date(),
    });

    return {
      workspaceId: token.workspaceId,
      userId: token.userId,
      telegramChatId,
    };
  }

  /**
   * Finds the workspace membership mapped to a Telegram user ID
   */
  async getMemberByTelegramUser(telegramUserId: string) {
    const allMemberships = await this.db.select().from(memberships);

    for (const m of allMemberships) {
      const rawPerms = m.permissionsJson ?? m.permissions_json ?? {};
      const perms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
      if (perms.telegram && String(perms.telegram.userId) === String(telegramUserId)) {
        return {
          workspaceId: m.workspaceId || m.workspace_id,
          userId: m.userId || m.user_id,
          role: m.role,
          chatId: perms.telegram.chatId,
        };
      }
    }

    return null;
  }
}

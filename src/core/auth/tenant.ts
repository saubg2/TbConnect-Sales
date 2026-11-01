import { eq, and } from 'drizzle-orm';
import { memberships, workspaces } from '@/db/schema';
import type { Membership } from '@/db/schema';

export type UserRole = 'owner' | 'operator' | 'viewer';

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: UserRole;
  permissions: Record<string, any>;
}

export class TenantAuthService {
  constructor(private db: any) {}

  /**
   * Verifies that the user belongs to the requested workspace with active membership
   */
  async getMembership(workspaceId: string, userId: string): Promise<Membership | null> {
    const [membership] = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
      .limit(1);

    return membership || null;
  }

  /**
   * Asserts that user has required role/permission for a workspace operation
   */
  async assertPermission(
    workspaceId: string,
    userId: string,
    minimumRole: UserRole = 'viewer'
  ): Promise<AuthContext> {
    const membership = await this.getMembership(workspaceId, userId);

    if (!membership) {
      throw new Error(`Unauthorized: User ${userId} is not a member of workspace ${workspaceId}`);
    }

    const roleRank: Record<UserRole, number> = {
      viewer: 1,
      operator: 2,
      owner: 3,
    };

    const userRole = membership.role as UserRole;
    if ((roleRank[userRole] || 0) < roleRank[minimumRole]) {
      throw new Error(
        `Forbidden: Role '${userRole}' does not meet minimum required role '${minimumRole}'`
      );
    }

    return {
      userId,
      workspaceId,
      role: userRole,
      permissions: (membership.permissionsJson as Record<string, any>) || {},
    };
  }
}

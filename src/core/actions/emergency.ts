import { eq, inArray, and } from 'drizzle-orm';
import { workspaces, actions, events } from '@/db/schema';

export interface EmergencyStopResult {
  workspaceId: string;
  emergencyStopActive: boolean;
  blockedActionsCount: number;
}

export class EmergencyStopService {
  constructor(private db: any) {}

  /**
   * Checks if emergency stop is currently active for a workspace
   */
  async isEmergencyStopActive(workspaceId: string): Promise<boolean> {
    const [ws] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!ws) return false;
    const settings = (ws.settingsJson as Record<string, any>) || {};
    return !!settings.emergencyStopActive;
  }

  /**
   * Activates or deactivates emergency stop for a workspace.
   * When activated, immediately halts and cancels all pending/waiting actions.
   */
  async setEmergencyStop(params: {
    workspaceId: string;
    enabled: boolean;
    reason?: string;
    userId?: string;
  }): Promise<EmergencyStopResult> {
    const [ws] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, params.workspaceId))
      .limit(1);

    if (!ws) {
      throw new Error(`Workspace ${params.workspaceId} not found`);
    }

    const currentSettings = (ws.settingsJson as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      emergencyStopActive: params.enabled,
      emergencyStopReason: params.enabled ? (params.reason || 'Activated by operator') : null,
      emergencyStoppedAt: params.enabled ? new Date().toISOString() : null,
      emergencyStoppedBy: params.enabled ? (params.userId || 'operator') : null,
    };

    await this.db
      .update(workspaces)
      .set({
        settingsJson: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, params.workspaceId));

    let blockedCount = 0;

    if (params.enabled) {
      // Find all pending / waiting actions
      const pendingActions = await this.db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.workspaceId, params.workspaceId),
            inArray(actions.status, ['PENDING', 'WAITING', 'APPROVED'])
          )
        );

      blockedCount = pendingActions.length;

      if (pendingActions.length > 0) {
        const actionIds = pendingActions.map((a: any) => a.id);
        await this.db
          .update(actions)
          .set({
            status: 'CANCELLED',
            reason: `Campaign emergency stop: ${params.reason || 'Halted by operator'}`,
            updatedAt: new Date(),
          })
          .where(inArray(actions.id, actionIds));
      }
    }

    // Append audit event
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      eventType: params.enabled
        ? 'WORKSPACE_EMERGENCY_STOP_ACTIVATED'
        : 'WORKSPACE_EMERGENCY_STOP_DEACTIVATED',
      payloadJson: {
        reason: params.reason,
        userId: params.userId,
        blockedActionsCount: blockedCount,
      },
      createdAt: new Date(),
    });

    return {
      workspaceId: params.workspaceId,
      emergencyStopActive: params.enabled,
      blockedActionsCount: blockedCount,
    };
  }
}

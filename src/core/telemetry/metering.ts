import { getDbAsync } from '@/db/client';
import { events } from '@/db/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

export interface TelemetryRecord {
  metric: 'model_tokens' | 'email_sends' | 'worker_jobs';
  count: number;
  provider?: string;
  model?: string;
  costUsd?: number;
  metadata?: Record<string, any>;
}

export interface WorkspaceQuota {
  maxDailySends: number;
  maxDailyTokens: number;
}

export const DEFAULT_QUOTAS: Record<string, WorkspaceQuota> = {
  default: {
    maxDailySends: 250,
    maxDailyTokens: 100000,
  },
};

export class TelemetryService {
  /**
   * Record a metered usage event into append-only events log
   */
  static async recordUsage(
    workspaceId: string,
    record: TelemetryRecord,
    actorId = 'system',
    customDb?: any
  ): Promise<string> {
    const db = customDb || (await getDbAsync());
    const rows = await db
      .insert(events)
      .values({
        workspaceId,
        eventType: 'USAGE_METER',
        payloadJson: {
          metric: record.metric,
          count: record.count,
          provider: record.provider || 'unknown',
          model: record.model || 'unknown',
          costUsd: record.costUsd || 0,
          metadata: record.metadata || {},
          recordedAt: new Date().toISOString(),
          actorId,
        },
      })
      .returning();

    return rows[0].id;
  }

  /**
   * Aggregate usage metrics for a workspace over the last 24 hours
   */
  static async getDailyUsage(
    workspaceId: string,
    customDb?: any
  ): Promise<{
    emailSends: number;
    modelTokens: number;
    workerJobs: number;
    totalCostUsd: number;
  }> {
    const db = customDb || (await getDbAsync());
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const usageEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.workspaceId, workspaceId),
          eq(events.eventType, 'USAGE_METER'),
          gte(events.createdAt, twentyFourHoursAgo)
        )
      );

    let emailSends = 0;
    let modelTokens = 0;
    let workerJobs = 0;
    let totalCostUsd = 0;

    for (const ev of usageEvents) {
      const payload = (ev.payloadJson as any) || {};
      const count = Number(payload.count) || 0;
      const cost = Number(payload.costUsd) || 0;

      if (payload.metric === 'email_sends') {
        emailSends += count;
      } else if (payload.metric === 'model_tokens') {
        modelTokens += count;
      } else if (payload.metric === 'worker_jobs') {
        workerJobs += count;
      }

      totalCostUsd += cost;
    }

    return { emailSends, modelTokens, workerJobs, totalCostUsd };
  }

  /**
   * Check if workspace has sufficient quota before executing action
   */
  static async checkQuota(
    workspaceId: string,
    metric: 'email_sends' | 'model_tokens',
    amount: number = 1,
    customQuota?: WorkspaceQuota,
    customDb?: any
  ): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    const quota = customQuota || DEFAULT_QUOTAS[workspaceId] || DEFAULT_QUOTAS.default;
    const current = await this.getDailyUsage(workspaceId, customDb);

    if (metric === 'email_sends') {
      const remaining = quota.maxDailySends - current.emailSends;
      if (remaining < amount) {
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          reason: `Daily email send limit exceeded (${current.emailSends}/${quota.maxDailySends} used)`,
        };
      }
      return { allowed: true, remaining: remaining - amount };
    }

    if (metric === 'model_tokens') {
      const remaining = quota.maxDailyTokens - current.modelTokens;
      if (remaining < amount) {
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          reason: `Daily token consumption limit exceeded (${current.modelTokens}/${quota.maxDailyTokens} used)`,
        };
      }
      return { allowed: true, remaining: remaining - amount };
    }

    return { allowed: true, remaining: 999999 };
  }
}

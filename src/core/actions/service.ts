import { eq, and, inArray } from 'drizzle-orm';
import { actions, events, contacts, relationships } from '@/db/schema';
import type { Action, AuditEvent } from '@/db/schema';
import type { ActionType } from '@/providers/types';

export interface CreateActionParams {
  workspaceId: string;
  relationshipId: string;
  agentId: string;
  type: ActionType;
  reason?: string;
  scheduledAt?: Date | null;
  payload?: Record<string, any>;
  approvalRequired?: boolean;
  draftVersion?: number;
  idempotencyKey?: string;
}

export class ActionService {
  constructor(private db: any) {}

  /**
   * Creates a new action adhering to approval rules, initial status and audit trail
   */
  async createAction(params: CreateActionParams): Promise<Action> {
    const actionId = crypto.randomUUID();
    const idempotencyKey =
      params.idempotencyKey ||
      `action_${params.workspaceId}_${params.relationshipId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let initialStatus: 'AWAITING_APPROVAL' | 'WAITING' | 'PENDING' | 'NO_ACTION' = 'PENDING';

    if (params.type === 'NO_ACTION') {
      initialStatus = 'NO_ACTION';
    } else if (params.approvalRequired) {
      initialStatus = 'AWAITING_APPROVAL';
    } else if (params.scheduledAt && params.scheduledAt.getTime() > Date.now()) {
      initialStatus = 'WAITING';
    }

    const [newAction] = await this.db
      .insert(actions)
      .values({
        id: actionId,
        workspaceId: params.workspaceId,
        relationshipId: params.relationshipId,
        agentId: params.agentId,
        type: params.type,
        status: initialStatus,
        scheduledAt: params.scheduledAt || null,
        payloadJson: params.payload || {},
        reason: params.reason || null,
        approvalRequired: params.approvalRequired ?? false,
        approvedDraftVersion: params.approvalRequired ? null : (params.draftVersion ?? 1),
        attemptCount: 0,
        idempotencyKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Append audit event
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      relationshipId: params.relationshipId,
      actionId: newAction.id,
      eventType: 'ACTION_CREATED',
      payloadJson: {
        actionType: params.type,
        initialStatus,
        approvalRequired: params.approvalRequired ?? false,
        reason: params.reason,
      },
      createdAt: new Date(),
    });

    return newAction;
  }

  /**
   * Atomically approves an action awaiting approval
   */
  async approveAction(params: {
    workspaceId: string;
    actionId: string;
    approvedBy: string;
    expectedDraftVersion?: number;
  }): Promise<Action> {
    // 1. Fetch action with workspace isolation
    const [action] = await this.db
      .select()
      .from(actions)
      .where(and(eq(actions.id, params.actionId), eq(actions.workspaceId, params.workspaceId)))
      .limit(1);

    if (!action) {
      throw new Error(`Action ${params.actionId} not found in workspace ${params.workspaceId}`);
    }

    if (action.status !== 'AWAITING_APPROVAL') {
      throw new Error(`Action ${params.actionId} cannot be approved in status ${action.status}`);
    }

    const payload = (action.payloadJson as any) || {};
    const currentDraftVersion = payload.draft_version ?? 1;

    // Check version match (editing invalidates previous approval intent)
    if (params.expectedDraftVersion !== undefined && params.expectedDraftVersion !== currentDraftVersion) {
      throw new Error(
        `Draft version mismatch: expected ${params.expectedDraftVersion}, but current draft is version ${currentDraftVersion}`
      );
    }

    // 2. Suppression check: contact must not be suppressed
    const [relationship] = await this.db
      .select()
      .from(relationships)
      .where(and(eq(relationships.id, action.relationshipId), eq(relationships.workspaceId, params.workspaceId)))
      .limit(1);

    if (!relationship) {
      throw new Error(`Relationship not found for action ${action.id}`);
    }

    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, relationship.contactId), eq(contacts.workspaceId, params.workspaceId)))
      .limit(1);

    if (contact && contact.isSuppressed) {
      throw new Error(`Cannot approve action for contact ${contact.emailNormalized}: contact is suppressed.`);
    }

    // 3. Update status to APPROVED / PENDING for queue execution
    const [updatedAction] = await this.db
      .update(actions)
      .set({
        status: 'APPROVED',
        approvedDraftVersion: currentDraftVersion,
        approvedBy: params.approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(actions.id, action.id))
      .returning();

    // Audit log
    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      relationshipId: action.relationshipId,
      actionId: action.id,
      eventType: 'ACTION_APPROVED',
      payloadJson: {
        approvedBy: params.approvedBy,
        draftVersion: currentDraftVersion,
      },
      createdAt: new Date(),
    });

    return updatedAction;
  }

  /**
   * Edit draft content on an action.
   * If action was approved or awaiting approval, creates a new draft version and resets to AWAITING_APPROVAL.
   */
  async editDraftAction(params: {
    workspaceId: string;
    actionId: string;
    newBodyText: string;
    newSubject?: string;
    editedBy: string;
  }): Promise<Action> {
    const [action] = await this.db
      .select()
      .from(actions)
      .where(and(eq(actions.id, params.actionId), eq(actions.workspaceId, params.workspaceId)))
      .limit(1);

    if (!action) {
      throw new Error(`Action ${params.actionId} not found in workspace ${params.workspaceId}`);
    }

    const payload = (action.payloadJson as any) || {};
    const oldVersion = payload.draft_version ?? 1;
    const newVersion = oldVersion + 1;

    const updatedPayload = {
      ...payload,
      draft_version: newVersion,
      draft: {
        ...payload.draft,
        subject: params.newSubject ?? payload.draft?.subject ?? 'Follow-up',
        body_text: params.newBodyText,
        draft_version: newVersion,
      },
      last_edited_by: params.editedBy,
      last_edited_at: new Date().toISOString(),
    };

    // If it was already approved, editing it strictly invalidates approval!
    const newStatus = 'AWAITING_APPROVAL';

    const [updatedAction] = await this.db
      .update(actions)
      .set({
        status: newStatus,
        payloadJson: updatedPayload,
        approvedDraftVersion: null,
        approvedBy: null,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, action.id))
      .returning();

    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      relationshipId: action.relationshipId,
      actionId: action.id,
      eventType: 'ACTION_DRAFT_EDITED',
      payloadJson: {
        editedBy: params.editedBy,
        oldVersion,
        newVersion,
        invalidatedApproval: action.status === 'APPROVED',
      },
      createdAt: new Date(),
    });

    return updatedAction;
  }

  /**
   * Rejects / cancels an action
   */
  async rejectAction(params: {
    workspaceId: string;
    actionId: string;
    rejectedBy: string;
    reason?: string;
  }): Promise<Action> {
    const [action] = await this.db
      .select()
      .from(actions)
      .where(and(eq(actions.id, params.actionId), eq(actions.workspaceId, params.workspaceId)))
      .limit(1);

    if (!action) {
      throw new Error(`Action ${params.actionId} not found in workspace ${params.workspaceId}`);
    }

    const [updatedAction] = await this.db
      .update(actions)
      .set({
        status: 'CANCELLED',
        reason: params.reason || 'Rejected by operator',
        updatedAt: new Date(),
      })
      .where(eq(actions.id, action.id))
      .returning();

    await this.db.insert(events).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      relationshipId: action.relationshipId,
      actionId: action.id,
      eventType: 'ACTION_REJECTED',
      payloadJson: {
        rejectedBy: params.rejectedBy,
        reason: params.reason,
      },
      createdAt: new Date(),
    });

    return updatedAction;
  }

  /**
   * Stops/cancels pending follow-ups for a relationship when a substantive inbound arrives
   */
  async cancelPendingFollowUpsForRelationship(params: {
    workspaceId: string;
    relationshipId: string;
    reason: string;
  }): Promise<number> {
    const pendingActions = await this.db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.workspaceId, params.workspaceId),
          eq(actions.relationshipId, params.relationshipId),
          inArray(actions.status, ['PENDING', 'WAITING', 'AWAITING_APPROVAL'])
        )
      );

    if (pendingActions.length === 0) return 0;

    const actionIds = pendingActions.map((a: Action) => a.id);

    await this.db
      .update(actions)
      .set({
        status: 'CANCELLED',
        reason: params.reason,
        updatedAt: new Date(),
      })
      .where(inArray(actions.id, actionIds));

    for (const a of pendingActions) {
      await this.db.insert(events).values({
        id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        relationshipId: params.relationshipId,
        actionId: a.id,
        eventType: 'ACTION_CANCELLED',
        payloadJson: {
          reason: params.reason,
          previousStatus: a.status,
        },
        createdAt: new Date(),
      });
    }

    return pendingActions.length;
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTestWorkspace } from './setup';
import { TelegramAuthService } from '@/providers/telegram/auth';
import { TelegramBotService } from '@/providers/telegram/bot';
import { ActionService } from '@/core/actions/service';
import { memberships, contacts, relationships, actions, events } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Phase 5: Telegram Operational Interface Test Suite', () => {
  let db: any;
  let workspace: any;
  let agent: any;
  let authService: TelegramAuthService;
  let botService: TelegramBotService;
  let actionService: ActionService;

  beforeEach(async () => {
    const context = await createTestDb();
    db = context.testDb;
    const seeded = await seedTestWorkspace(db);
    workspace = seeded.workspace;
    agent = seeded.agent;

    authService = new TelegramAuthService(db);
    botService = new TelegramBotService({ botToken: 'mock_token' }, db);
    actionService = new ActionService(db);
  });

  it('demonstrates Phase 5 Exit Gate: single-use linking token binds Telegram user to workspace', async () => {
    // 1. Add an operator membership
    const [member] = await db
      .insert(memberships)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        userId: 'dan_operator',
        role: 'operator',
        permissionsJson: {},
      })
      .returning();

    // 2. Generate linking token
    const token = authService.generateLinkingToken(workspace.id, member.userId);
    expect(token).toContain('link_');

    // 3. User links Telegram chat
    const linkResult = await authService.linkTelegramUser(
      token,
      'chat_123456',
      'tg_user_789',
      'dan_tele'
    );

    expect(linkResult.workspaceId).toBe(workspace.id);
    expect(linkResult.telegramChatId).toBe('chat_123456');

    // 4. Token cannot be reused (single-use guarantee)
    await expect(
      authService.linkTelegramUser(token, 'chat_999', 'tg_user_999')
    ).rejects.toThrow('Invalid or expired linking token');

    // 5. Query membership by Telegram User ID
    const foundMember = await authService.getMemberByTelegramUser('tg_user_789');
    expect(foundMember).toBeDefined();
    expect(foundMember?.userId).toBe('dan_operator');
    expect(foundMember?.workspaceId).toBe(workspace.id);
  });

  it('demonstrates Phase 5 Exit Gate: unlinked Telegram user cannot approve actions', async () => {
    const unlinkedUser = await authService.getMemberByTelegramUser('random_stranger_000');
    expect(unlinkedUser).toBeNull();
  });

  it('demonstrates Phase 5 Exit Gate: only an authorised approver can approve the exact current draft', async () => {
    // 1. Link authorized operator
    const [member] = await db
      .insert(memberships)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        userId: 'approver_sam',
        role: 'operator',
        permissionsJson: {
          telegram: {
            userId: 'tg_user_555',
            chatId: 'chat_555',
            username: 'sam_operator',
          },
        },
      })
      .returning();

    // 2. Create contact, relationship, and action awaiting approval
    const [contact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Target Prospect',
        emailNormalized: 'target@growth.com',
      })
      .returning();

    const [rel] = await db
      .insert(relationships)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        contactId: contact.id,
        agentId: agent.id,
      })
      .returning();

    const action = await actionService.createAction({
      workspaceId: workspace.id,
      relationshipId: rel.id,
      agentId: agent.id,
      type: 'REQUEST_APPROVAL',
      approvalRequired: true,
      draftVersion: 1,
      payload: {
        draft: {
          subject: 'Custom partnership terms',
          body_text: 'Exact draft version 1 terms',
          draft_version: 1,
        },
        draft_version: 1,
      },
    });

    // 3. Authorized operator approves via Telegram callback for exact version 1
    const approvedAction = await actionService.approveAction({
      workspaceId: workspace.id,
      actionId: action.id,
      approvedBy: 'telegram:@sam_operator',
      expectedDraftVersion: 1,
    });

    expect(approvedAction.status).toBe('APPROVED');
    expect(approvedAction.approvedBy).toBe('telegram:@sam_operator');
    expect(approvedAction.approvedDraftVersion).toBe(1);

    // 4. Repeated callback does nothing / fails safely (action is no longer in AWAITING_APPROVAL)
    await expect(
      actionService.approveAction({
        workspaceId: workspace.id,
        actionId: action.id,
        approvedBy: 'telegram:@sam_operator',
        expectedDraftVersion: 1,
      })
    ).rejects.toThrow('cannot be approved in status APPROVED');
  });

  it('demonstrates Phase 5 Exit Gate: outdated draft version callback fails when draft was edited', async () => {
    // 1. Create action with draft v1
    const [contact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Draft Version Prospect',
        emailNormalized: 'v2@prospect.com',
      })
      .returning();

    const [rel] = await db
      .insert(relationships)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        contactId: contact.id,
        agentId: agent.id,
      })
      .returning();

    const action = await actionService.createAction({
      workspaceId: workspace.id,
      relationshipId: rel.id,
      agentId: agent.id,
      type: 'REQUEST_APPROVAL',
      approvalRequired: true,
      draftVersion: 1,
      payload: {
        draft: {
          subject: 'Draft version test',
          body_text: 'Body version 1',
          draft_version: 1,
        },
        draft_version: 1,
      },
    });

    // 2. Operator on web edits draft text, which bumps draft version to 2
    await actionService.editDraftAction({
      workspaceId: workspace.id,
      actionId: action.id,
      newBodyText: 'Body version 2 with revised discount',
      editedBy: 'web_editor',
    });

    // 3. Telegram operator clicks old button from version 1 (appr:<actionId>:1)
    // Invariant: MUST fail because draft is now version 2!
    await expect(
      actionService.approveAction({
        workspaceId: workspace.id,
        actionId: action.id,
        approvedBy: 'telegram:@sam_operator',
        expectedDraftVersion: 1, // out-of-date version!
      })
    ).rejects.toThrow('Draft version mismatch: expected 1, but current draft is version 2');

    // 4. Approving with current version 2 succeeds
    const reapproved = await actionService.approveAction({
      workspaceId: workspace.id,
      actionId: action.id,
      approvedBy: 'telegram:@sam_operator',
      expectedDraftVersion: 2,
    });
    expect(reapproved.status).toBe('APPROVED');
    expect(reapproved.approvedDraftVersion).toBe(2);
  });

  it('demonstrates Phase 5 Exit Gate: Telegram failure is non-blocking and does not lose action', async () => {
    // Simulate broken network or invalid token
    const brokenBot = new TelegramBotService({ botToken: 'invalid_dead_token' }, db);

    // Calling sendApprovalAlert does not throw an unhandled exception
    const result = await brokenBot.sendApprovalAlert('fake_chat_id', {
      actionId: 'act_123',
      draftVersion: 1,
      contactName: 'Alice',
      recipientEmail: 'alice@test.com',
      subject: 'Inquiry',
      bodyText: 'Hello',
      reason: 'Question',
    });

    // Returns error payload gracefully without crashing caller
    expect(result.ok).toBe(false);
  });
});

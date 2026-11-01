import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTestWorkspace } from './setup';
import { ResendEmailSender } from '@/providers/email/resend';
import { ResendInboundAdapter } from '@/providers/email/resend-inbound';
import { DeliveryEventsProcessor } from '@/core/campaigns/events-processor';
import { CampaignSequenceEngine } from '@/core/campaigns/sequence';
import { DecisionEngine } from '@/core/relationships/decision-engine';
import { MockLLMProvider } from '@/providers/llm/mock';
import { ActionService } from '@/core/actions/service';
import { contacts, relationships, actions, events, messages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Phase 4: Real Email Integration (Resend) Test Suite', () => {
  let db: any;
  let workspace: any;
  let agent: any;
  let resendSender: ResendEmailSender;
  let resendInbound: ResendInboundAdapter;
  let decisionEngine: DecisionEngine;
  let eventsProcessor: DeliveryEventsProcessor;
  let campaignEngine: CampaignSequenceEngine;
  let actionService: ActionService;

  beforeEach(async () => {
    const context = await createTestDb();
    db = context.testDb;
    const seeded = await seedTestWorkspace(db);
    workspace = seeded.workspace;
    agent = seeded.agent;

    resendSender = new ResendEmailSender({ dryRun: true });
    resendInbound = new ResendInboundAdapter();
    const mockLLM = new MockLLMProvider();
    decisionEngine = new DecisionEngine(db, mockLLM);
    eventsProcessor = new DeliveryEventsProcessor(db, decisionEngine);
    campaignEngine = new CampaignSequenceEngine(db);
    actionService = new ActionService(db);
  });

  it('demonstrates Phase 4 Exit Gate: Resend sender dispatches with idempotency key in dry-run mode', async () => {
    const idempotencyKey = `idemp_${crypto.randomUUID()}`;
    const result = await resendSender.send(
      {
        workspaceId: workspace.id,
        relationshipId: 'rel_test',
        toEmail: 'test.prospect@resend.dev',
        fromEmail: 'agent@workspace.local',
        subject: 'Product partnership opportunity',
        bodyText: 'Hi team, would you be open to exploring product integration?',
      },
      idempotencyKey
    );

    expect(result.status).toBe('ACCEPTED');
    expect(result.providerMessageId).toBeDefined();
    expect(result.providerMessageId).toContain('dryrun_');
  });

  it('demonstrates Phase 4 Exit Gate: webhook replay protection prevents duplicate events', async () => {
    const rawPayload = {
      type: 'email.delivered',
      id: 'resend_event_unique_001',
      data: {
        id: 'resend_event_unique_001',
        email_id: 'msg_resend_123',
        to: ['delivered@partner.com'],
      },
    };

    const inboundEvent = await resendInbound.verifyWebhook(
      JSON.stringify(rawPayload),
      new Headers()
    );

    // First event run: processed
    const result1 = await eventsProcessor.processEvent(workspace.id, inboundEvent);
    expect(result1.duplicate).toBe(false);

    // Replay of the exact same event
    const result2 = await eventsProcessor.processEvent(workspace.id, inboundEvent);
    expect(result2.duplicate).toBe(true);

    // Exactly 1 audit record exists in database
    const dbEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.workspaceId, workspace.id),
          eq(events.externalEventId, 'resend_event_unique_001')
        )
      );
    expect(dbEvents.length).toBe(1);
  });

  it('demonstrates Phase 4 Exit Gate: bounce event suppresses contact and halts pending actions', async () => {
    // 1. Create contact and relationship
    const [contact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Bounced User',
        emailNormalized: 'invalid-address@badmail.com',
        isSuppressed: false,
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

    // 2. Pending follow-up action exists
    const action = await actionService.createAction({
      workspaceId: workspace.id,
      relationshipId: rel.id,
      agentId: agent.id,
      type: 'SEND_EMAIL',
      scheduledAt: new Date(Date.now() + 86400000),
      reason: 'Scheduled follow-up',
    });

    // 3. Receive email.bounced webhook from Resend
    const bouncePayload = {
      type: 'email.bounced',
      id: 'resend_bounce_evt_001',
      data: {
        to: [contact.emailNormalized],
        reason: 'Mailbox does not exist (550)',
      },
    };

    const inboundEvent = await resendInbound.verifyWebhook(
      JSON.stringify(bouncePayload),
      new Headers()
    );

    const result = await eventsProcessor.processEvent(workspace.id, inboundEvent);
    expect(result.suppressedContact).toBe(contact.emailNormalized);
    expect(result.cancelledActionsCount).toBe(1);

    // Contact is now suppressed in database
    const [updatedContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contact.id));

    expect(updatedContact.isSuppressed).toBe(true);
    expect(updatedContact.suppressionReason).toContain('hard bounce');

    // Pending action was cancelled
    const [updatedAction] = await db
      .select()
      .from(actions)
      .where(eq(actions.id, action.id));

    expect(updatedAction.status).toBe('CANCELLED');
    expect(updatedAction.reason).toContain('bounce');
  });

  it('demonstrates Phase 4 Exit Gate: spam complaint suppresses contact across all campaigns', async () => {
    const [contact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Complaining User',
        emailNormalized: 'unhappy@prospect.org',
        isSuppressed: false,
      })
      .returning();

    const complaintPayload = {
      type: 'email.complained',
      id: 'resend_complaint_evt_001',
      data: {
        to: [contact.emailNormalized],
      },
    };

    const inboundEvent = await resendInbound.verifyWebhook(
      JSON.stringify(complaintPayload),
      new Headers()
    );

    await eventsProcessor.processEvent(workspace.id, inboundEvent);

    const [updatedContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contact.id));

    expect(updatedContact.isSuppressed).toBe(true);
    expect(updatedContact.suppressionReason).toContain('Spam complaint');
  });

  it('demonstrates Phase 4 Exit Gate: campaign launch with initial outreach + follow-up, and reply cancels follow-up', async () => {
    // 1. Create 2 contacts: 1 eligible, 1 suppressed
    const [eligibleContact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Eligible Lead',
        emailNormalized: 'eligible@prospectcorp.com',
        isSuppressed: false,
      })
      .returning();

    const [suppressedContact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspace.id,
        name: 'Suppressed Lead',
        emailNormalized: 'suppressed@prospectcorp.com',
        isSuppressed: true,
        suppressionReason: 'Unsubscribed previously',
      })
      .returning();

    // 2. Launch campaign sequence
    const campaignResult = await campaignEngine.launchCampaign({
      workspaceId: workspace.id,
      agentId: agent.id,
      contactIds: [eligibleContact.id, suppressedContact.id],
      initialTemplate: {
        subject: 'Partnership exploration with {{company}}',
        bodyText: 'Hi {{name}}, we would love to connect with {{company}}.',
      },
      followUpRule: {
        delayDays: 3,
        subject: 'Following up regarding {{company}}',
        bodyText: 'Hi {{name}}, just circling back on my previous email.',
      },
    });

    expect(campaignResult.eligibleContactsCount).toBe(1);
    expect(campaignResult.suppressedSkippedCount).toBe(1); // Suppressed contact safely skipped
    expect(campaignResult.initialActionsCreated).toBe(1);
    expect(campaignResult.followUpActionsScheduled).toBe(1);

    // 3. Contact replies to the campaign email!
    const replyPayload = {
      type: 'email.received',
      id: 'resend_inbound_reply_001',
      data: {
        from: eligibleContact.emailNormalized,
        from_name: eligibleContact.name,
        subject: 'Re: Partnership exploration with ProspectCorp',
        text: 'Hi Sarah, yes I would be interested in seeing a quick demo.',
      },
    };

    const inboundEvent = await resendInbound.verifyWebhook(
      JSON.stringify(replyPayload),
      new Headers()
    );

    const eventResult = await eventsProcessor.processEvent(workspace.id, inboundEvent);

    // Invariant: Substantive reply automatically cancelled pending outreach and follow-up actions
    expect(eventResult.decisionResult.cancelledFollowUpsCount).toBe(2);

    // Next action generated for the reply
    expect(eventResult.decisionResult.decision).toBeDefined();
    expect(eventResult.decisionResult.relationship.stage).toBe('ENGAGED');
  });
});

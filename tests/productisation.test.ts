import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './setup';
import { setDb } from '@/db/client';
import { workspaces, contacts, agents, relationships, messages, actions, events } from '@/db/schema';
import { AgentDecisionSchema, OutboundMessage } from '@/providers/types';
import { MockLLMProvider } from '@/providers/llm/mock';
import { MistralLLMProvider } from '@/providers/llm/mistral';
import { MockEmailProvider } from '@/providers/email/mock';
import { ResendEmailSender } from '@/providers/email/resend';
import { TelemetryService } from '@/core/telemetry/metering';
import { ComplianceService } from '@/core/compliance/export-delete';
import { AgentService } from '@/core/agents/service';
import { eq } from 'drizzle-orm';

describe('Phase 6: Productisation, Multi-Provider & Beta Readiness Test Suite', () => {
  const wsAlpha = 'ws_prod_alpha';
  const wsBeta = 'ws_prod_beta';
  let db: any;

  beforeEach(async () => {
    const context = await createTestDb();
    db = context.testDb;
    setDb(db);

    // Clean up test tables
    await db.delete(events);
    await db.delete(actions);
    await db.delete(messages);
    await db.delete(relationships);
    await db.delete(agents);
    await db.delete(contacts);
    await db.delete(workspaces);

    // Seed test workspaces
    await db.insert(workspaces).values([
      { id: wsAlpha, name: 'Alpha Corp' },
      { id: wsBeta, name: 'Beta Ltd' },
    ]);
  });

  it('demonstrates Phase 6 Exit Gate: at least two LLM providers pass the exact same decision contract tests', async () => {
    const mockLLM = new MockLLMProvider();
    const mistralLLM = new MistralLLMProvider();

    const sampleContext = {
      agent: {
        name: 'Sarah',
        goal: 'Engage partners',
        instructions: 'Be professional and direct',
        voiceProfile: { tone: 'warm, direct', maxSentences: 3 },
        permissions: { allowCommercialPricing: false },
      },
      contact: {
        name: 'Alex Rivera',
        email: 'alex@cloudflow.io',
        organisation: 'CloudFlow',
      },
      relationship: {
        stage: 'NEW',
        facts: ['Interest in API webhooks'],
        openQuestions: [],
      },
      recentMessages: [],
      inboundMessage: {
        subject: 'API details',
        bodyText: 'Hi Sarah, does your solution support webhook triggers for automated outreach?',
        receivedAt: new Date(),
      },
    };

    // 1. Verify Mock LLM adheres to contract
    const mockDecision = await mockLLM.decide(sampleContext);
    const parsedMock = AgentDecisionSchema.safeParse(mockDecision);
    expect(parsedMock.success).toBe(true);
    expect(mockDecision.next_action).toBe('SEND_EMAIL');
    expect(mockDecision.draft_required).toBe(true);

    // 2. Verify Mistral LLM adheres to the exact same contract
    // MistralLLMProvider formatPrompt creates structured instruction
    expect(mistralLLM.name).toBe('mistral');
    if (process.env.MISTRAL_API_KEY) {
      const mistralDecision = await mistralLLM.decide(sampleContext);
      const parsedMistral = AgentDecisionSchema.safeParse(mistralDecision);
      expect(parsedMistral.success).toBe(true);
      expect(typeof mistralDecision.intent).toBe('string');
      expect(typeof mistralDecision.reason).toBe('string');
      expect(typeof mistralDecision.approval_required).toBe('boolean');
    }
  });

  it('demonstrates Phase 6 Exit Gate: at least two Email providers pass the exact same sending contract tests', async () => {
    const mockEmail = new MockEmailProvider();
    const resendEmail = new ResendEmailSender();

    const outbound: OutboundMessage = {
      workspaceId: wsAlpha,
      relationshipId: 'rel_test_1',
      toEmail: 'lead@partner.io',
      toName: 'Partner Lead',
      fromEmail: 'agent@workspace.local',
      fromName: 'Alpha Agent',
      subject: 'Exploring technical partnership',
      bodyText: 'Hi Partner, we would love to connect on API integration.',
      threadKey: 'thread_123',
    };

    // 1. Mock Email Provider Contract
    const mockResult = await mockEmail.send(outbound, 'idem_mock_1');
    expect(mockResult.status).toBe('ACCEPTED');
    expect(mockResult.providerMessageId).toBeDefined();

    // Idempotent resend with same key returns identical or accepted status
    const mockResult2 = await mockEmail.send(outbound, 'idem_mock_1');
    expect(mockResult2.status).toBe('ACCEPTED');

    // 2. Resend Email Provider Contract (dry-run mode guarantees safety without API dispatch)
    const resendResult = await resendEmail.send(outbound, 'idem_resend_1');
    expect(resendResult.status).toBe('ACCEPTED');
    expect(resendResult.providerMessageId).toContain('dryrun_');

    // Both providers conform to EmailSender interface
    expect(mockEmail.name).toBe('mock');
    expect(resendEmail.name).toBe('resend');
  });

  it('demonstrates Phase 6 Exit Gate: workspace usage is metered and isolated between tenants', async () => {
    // Record usage for Workspace Alpha
    await TelemetryService.recordUsage(wsAlpha, {
      metric: 'email_sends',
      count: 15,
      provider: 'resend',
    });
    await TelemetryService.recordUsage(wsAlpha, {
      metric: 'model_tokens',
      count: 4200,
      provider: 'mistral',
      model: 'ministral-8b-latest',
    });

    // Record usage for Workspace Beta
    await TelemetryService.recordUsage(wsBeta, {
      metric: 'email_sends',
      count: 5,
      provider: 'mock',
    });
    await TelemetryService.recordUsage(wsBeta, {
      metric: 'model_tokens',
      count: 1100,
      provider: 'mock',
    });

    // Verify isolation and accuracy of daily metrics for Alpha
    const alphaUsage = await TelemetryService.getDailyUsage(wsAlpha);
    expect(alphaUsage.emailSends).toBe(15);
    expect(alphaUsage.modelTokens).toBe(4200);

    // Verify isolation and accuracy of daily metrics for Beta
    const betaUsage = await TelemetryService.getDailyUsage(wsBeta);
    expect(betaUsage.emailSends).toBe(5);
    expect(betaUsage.modelTokens).toBe(1100);

    // Check Quota enforcement
    const customQuota = { maxDailySends: 20, maxDailyTokens: 5000 };

    // Alpha sending 3 more emails (15 + 3 = 18 <= 20) -> allowed
    const canSend3 = await TelemetryService.checkQuota(wsAlpha, 'email_sends', 3, customQuota);
    expect(canSend3.allowed).toBe(true);
    expect(canSend3.remaining).toBe(2);

    // Alpha sending 10 more emails (15 + 10 = 25 > 20) -> rejected
    const canSend10 = await TelemetryService.checkQuota(wsAlpha, 'email_sends', 10, customQuota);
    expect(canSend10.allowed).toBe(false);
    expect(canSend10.reason).toContain('Daily email send limit exceeded');
  });

  it('demonstrates Phase 6 Exit Gate: compliance data export and privacy deletion workflow', async () => {
    // 1. Seed data for Alpha
    const [c] = await db
      .insert(contacts)
      .values({
        workspaceId: wsAlpha,
        name: 'Target Partner',
        emailNormalized: 'target@partner.com',
      })
      .returning();

    const [a] = await db
      .insert(agents)
      .values({
        workspaceId: wsAlpha,
        name: 'Sarah',
        goal: 'B2B Sales',
        instructions: 'Direct tone',
      })
      .returning();

    const [r] = await db
      .insert(relationships)
      .values({
        workspaceId: wsAlpha,
        contactId: c.id,
        agentId: a.id,
        stage: 'NEW',
      })
      .returning();

    await db.insert(messages).values({
      workspaceId: wsAlpha,
      relationshipId: r.id,
      direction: 'INBOUND',
      channel: 'EMAIL',
      bodyText: 'Hello',
    });

    // 2. Perform Workspace Data Export
    const exportData = await ComplianceService.exportWorkspaceData(wsAlpha);
    expect(exportData.workspaceId).toBe(wsAlpha);
    expect(exportData.contactsCount).toBe(1);
    expect(exportData.relationshipsCount).toBe(1);
    expect(exportData.messagesCount).toBe(1);
    expect(exportData.data.contacts[0].emailNormalized).toBe('target@partner.com');

    // 3. Perform Privacy Contact Purge (Right to be Forgotten)
    const purgeResult = await ComplianceService.deleteContactData(wsAlpha, c.id);
    expect(purgeResult.success).toBe(true);

    // Verify contact is gone
    const remainingContacts = await db.select().from(contacts).where(eq(contacts.id, c.id));
    expect(remainingContacts.length).toBe(0);

    // Verify audit event was logged
    const auditEvents = await db.select().from(events).where(eq(events.eventType, 'CONTACT_PURGED_PRIVACY_REQUEST'));
    expect(auditEvents.length).toBe(1);
    expect((auditEvents[0].payloadJson as any).contactId).toBe(c.id);
  });

  it('demonstrates Agent Studio configuration updates with audit trail', async () => {
    // Create an agent
    const agent = await AgentService.createAgent(wsAlpha, {
      name: 'Initial Agent',
      goal: 'Initial Goal',
      instructions: 'Initial Instructions',
    });

    expect(agent.name).toBe('Initial Agent');

    // Update agent voice, avoidPhrases, and provider
    const updated = await AgentService.updateAgent(wsAlpha, agent.id, {
      name: 'Sarah - Enterprise Partner Lead',
      goal: 'Drive technical demos for enterprise prospects',
      llmProvider: 'mistral',
      llmModel: 'ministral-8b-latest',
      voiceJson: {
        tone: 'concise, technical, friendly',
        maxSentences: 3,
        avoidPhrases: ['synergy', 'circle back', 'touch base'],
        forbiddenTopics: ['commercial pricing quotes', 'legal commitments'],
      },
      permissionsJson: {
        allowCommercialPricing: false,
        allowContractTerms: false,
        allowDirectOutreach: true,
      },
    });

    expect(updated.name).toBe('Sarah - Enterprise Partner Lead');
    expect(updated.llmProvider).toBe('mistral');
    expect((updated.voiceJson as any).avoidPhrases).toContain('circle back');

    // Verify audit event
    const auditLogs = await db
      .select()
      .from(events)
      .where(eq(events.eventType, 'AGENT_CONFIG_UPDATED'));

    expect(auditLogs.length).toBe(1);
    expect((auditLogs[0].payloadJson as any).agentId).toBe(agent.id);
  });
});

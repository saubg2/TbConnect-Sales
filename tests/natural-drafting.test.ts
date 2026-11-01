import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTestWorkspace } from './setup';
import { DecisionEngine } from '@/core/relationships/decision-engine';
import { MockLLMProvider } from '@/providers/llm/mock';
import { MistralLLMProvider } from '@/providers/llm/mistral';
import { VoiceValidator } from '@/core/agents/voice';
import { ConversationSummarizer } from '@/core/conversations/summarizer';
import { contacts, relationships, messages, actions } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Phase 2: LLM & Natural Drafting Test Suite', () => {
  let db: any;
  let workspace: any;
  let agent: any;
  let mockLLM: MockLLMProvider;
  let engine: DecisionEngine;

  beforeEach(async () => {
    const context = await createTestDb();
    db = context.testDb;
    const seeded = await seedTestWorkspace(db);
    workspace = seeded.workspace;
    agent = seeded.agent;

    mockLLM = new MockLLMProvider();
    engine = new DecisionEngine(db, mockLLM);
  });

  it('demonstrates Phase 2 Exit Gate: scripted multi-turn conversation preserves facts and updates state', async () => {
    const contactEmail = 'claire.morrison@retailscale.io';
    const contactName = 'Claire Morrison';

    // --- TURN 1: Initial Inbound Inquiry ---
    const turn1 = await engine.processInboundMessage({
      workspaceId: workspace.id,
      fromEmail: contactEmail,
      fromName: contactName,
      subject: 'Inquiry regarding relationship automation',
      bodyText: 'Hi Sarah, we are an online retail brand evaluating automated outreach solutions.',
      providerMessageId: 'turn1_msg',
    });

    expect(turn1.relationship.stage).toBe('ENGAGED');
    expect(turn1.decision?.next_action).toBe('SEND_EMAIL');

    // Simulate agent sending the drafted reply
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      relationshipId: turn1.relationship.id,
      direction: 'OUTBOUND',
      channel: 'EMAIL',
      subject: 'Re: Inquiry regarding relationship automation',
      bodyText: 'Hi Claire, glad to connect! How many team members are looking to use the system?',
      status: 'SENT',
      createdAt: new Date(),
    });

    // --- TURN 2: Contact provides specific team size requirement ---
    const turn2 = await engine.processInboundMessage({
      workspaceId: workspace.id,
      fromEmail: contactEmail,
      fromName: contactName,
      subject: 'Re: Inquiry regarding relationship automation',
      bodyText: 'We have 25 team members who would be managing partnerships and outreach.',
      providerMessageId: 'turn2_msg',
    });

    // Check fact extraction via conversation summarizer
    const allMessagesTurn2 = await db
      .select()
      .from(messages)
      .where(eq(messages.relationshipId, turn1.relationship.id));

    const summarizedTurn2 = ConversationSummarizer.summarize(
      contactName,
      (turn2.relationship.factsJson as string[]) || [],
      allMessagesTurn2
    );

    expect(summarizedTurn2.facts).toContain('Team size requirement: 25 team members');

    // --- TURN 3: Contact follows up on integrations ---
    const turn3 = await engine.processInboundMessage({
      workspaceId: workspace.id,
      fromEmail: contactEmail,
      fromName: contactName,
      subject: 'Re: Inquiry regarding relationship automation',
      bodyText: 'Also, does your API support webhook triggers for outbound delivery?',
      providerMessageId: 'turn3_msg',
    });

    // Fact from Turn 2 is preserved in Turn 3
    expect(turn3.relationship.stage).toBe('ENGAGED');
    const turn3Facts = (turn3.relationship.factsJson as string[]) || [];
    expect(turn3.relationship.summary).toBeDefined();
    expect(turn3.action?.status).toBe('PENDING');
    expect(turn3.action?.type).toBe('SEND_EMAIL');
  });

  it('demonstrates Phase 2 Exit Gate: commercial pricing inquiry strictly escalates to human approval', async () => {
    const result = await engine.processInboundMessage({
      workspaceId: workspace.id,
      fromEmail: 'procurement@acquisitions.org',
      fromName: 'Robert Procurement',
      subject: 'Annual enterprise quote and seat discounts',
      bodyText: 'Could you give us your pricing tiers and quote for 50 seats?',
      providerMessageId: 'pricing_inquiry_001',
    });

    // Invariant: pricing inquiry MUST require approval
    expect(result.decision?.intent).toBe('pricing_request');
    expect(result.decision?.approval_required).toBe(true);
    expect(result.action?.type).toBe('REQUEST_APPROVAL');
    expect(result.action?.status).toBe('AWAITING_APPROVAL');
    expect(result.action?.approvalRequired).toBe(true);

    // Draft is generated but safely held awaiting approval
    const payload = result.action?.payloadJson as any;
    expect(payload.draft).toBeDefined();
    expect(payload.draft.body_text).toContain('pricing');
  });

  it('enforces agent voice profile: flags avoided phrases and unauthorized pricing', () => {
    const agentVoice = {
      formality: 'casual',
      avoidedPhrases: ['Hope this email finds you well', 'Synergy', 'Circle back'],
    };

    const agentPermissions = {
      canQuotePricing: false,
    };

    // 1. Violation of avoided phrase
    const badDraft1 = {
      subject: 'Checking in',
      body_text: 'Hope this email finds you well! Let us create synergy together.',
      draft_version: 1,
    };

    const check1 = VoiceValidator.validateDraft(badDraft1, agentVoice, agentPermissions);
    expect(check1.isValid).toBe(false);
    expect(check1.violations.some((v) => v.foundText === 'Hope this email finds you well')).toBe(true);
    expect(check1.violations.some((v) => v.foundText === 'Synergy')).toBe(true);

    // 2. Violation of unauthorized pricing quote
    const badDraft2 = {
      subject: 'Pricing',
      body_text: 'Our enterprise tier is $50 per seat/month.',
      draft_version: 1,
    };

    const check2 = VoiceValidator.validateDraft(badDraft2, agentVoice, agentPermissions);
    expect(check2.isValid).toBe(false);
    expect(check2.violations.some((v) => v.rule === 'UNAUTHORIZED_PRICING_QUOTE')).toBe(true);

    // 3. Clean compliant draft
    const cleanDraft = {
      subject: 'Re: API platform',
      body_text: 'Hi Claire,\n\nYes, we provide full webhook support for real-time delivery events.\n\nBest,\nSarah',
      draft_version: 1,
    };

    const checkClean = VoiceValidator.validateDraft(cleanDraft, agentVoice, agentPermissions);
    expect(checkClean.isValid).toBe(true);
    expect(checkClean.violations.length).toBe(0);
  });

  it('verifies MistralLLMProvider adheres to LLMProvider interface contract', () => {
    const mistral = new MistralLLMProvider({
      apiKey: 'test-key',
      model: 'mistral-small-latest',
    });

    expect(mistral.name).toBe('mistral');
    expect(typeof mistral.decide).toBe('function');
    expect(typeof mistral.draft).toBe('function');
  });
});

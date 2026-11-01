import { LLMProvider, DecisionContext, DraftContext, AgentDecision, MessageDraft, AgentDecisionSchema, MessageDraftSchema } from '../types';

export class MockLLMProvider implements LLMProvider {
  name = 'mock';

  private customDecisionGenerator?: (context: DecisionContext) => any;
  private customDraftGenerator?: (context: DraftContext) => any;

  constructor(options?: {
    customDecision?: (context: DecisionContext) => any;
    customDraft?: (context: DraftContext) => any;
  }) {
    if (options?.customDecision) {
      this.customDecisionGenerator = options.customDecision;
    }
    if (options?.customDraft) {
      this.customDraftGenerator = options.customDraft;
    }
  }

  setDecisionGenerator(fn: (context: DecisionContext) => any) {
    this.customDecisionGenerator = fn;
  }

  setDraftGenerator(fn: (context: DraftContext) => any) {
    this.customDraftGenerator = fn;
  }

  async decide(context: DecisionContext): Promise<AgentDecision> {
    if (this.customDecisionGenerator) {
      const raw = this.customDecisionGenerator(context);
      return AgentDecisionSchema.parse(raw);
    }

    const text = context.inboundMessage.bodyText.toLowerCase();

    // 1. Opt-out check
    if (text.includes('unsubscribe') || text.includes('stop') || text.includes('remove me')) {
      return AgentDecisionSchema.parse({
        intent: 'opt_out',
        confidence: 0.99,
        summary_update: 'Contact requested to be removed from future outreach.',
        stage: 'OPTED_OUT',
        next_action: 'MARK_COMPLETE',
        reason: 'Contact expressed explicit opt-out preference.',
        draft_required: false,
        approval_required: false,
        schedule_after_minutes: 0,
        new_facts: ['Requested opt-out on inbound email'],
        open_questions: [],
      });
    }

    // 2. Sensitive / Pricing / Commercial request check
    if (
      text.includes('pricing') ||
      text.includes('cost') ||
      text.includes('how much') ||
      text.includes('quote') ||
      text.includes('contract') ||
      text.includes('discount')
    ) {
      return AgentDecisionSchema.parse({
        intent: 'pricing_request',
        confidence: 0.95,
        summary_update: 'Contact asked for pricing or commercial terms.',
        stage: 'ENGAGED',
        next_action: 'REQUEST_APPROVAL',
        reason: 'Commercial terms require human approval by policy.',
        draft_required: true,
        approval_required: true,
        schedule_after_minutes: 0,
        new_facts: ['Interested in pricing details'],
        open_questions: ['What tier/volume fits their requirements?'],
      });
    }

    // 3. Simple acknowledgment or "Thank you" without need for follow-up
    if (text === 'thanks' || text === 'thank you' || text === 'received, thanks!') {
      return AgentDecisionSchema.parse({
        intent: 'acknowledgment',
        confidence: 0.9,
        summary_update: 'Contact acknowledged receipt.',
        stage: context.relationship.stage as any || 'ENGAGED',
        next_action: 'NO_ACTION',
        reason: 'Polite acknowledgment does not require a reply.',
        draft_required: false,
        approval_required: false,
        schedule_after_minutes: 0,
        new_facts: [],
        open_questions: [],
      });
    }

    // 4. Default: Information request / engagement
    return AgentDecisionSchema.parse({
      intent: 'information_request',
      confidence: 0.92,
      summary_update: `${context.contact.name || 'Contact'} replied asking for more details: "${context.inboundMessage.subject || 're: inquiry'}"`,
      stage: 'ENGAGED',
      next_action: 'SEND_EMAIL',
      reason: 'Provide concise direct response to their question.',
      draft_required: true,
      approval_required: false,
      schedule_after_minutes: 0,
      new_facts: [`Contact engaged with subject: ${context.inboundMessage.subject || 'Direct message'}`],
      open_questions: [],
    });
  }

  async draft(context: DraftContext): Promise<MessageDraft> {
    if (this.customDraftGenerator) {
      const raw = this.customDraftGenerator(context);
      return MessageDraftSchema.parse(raw);
    }

    const contactName = context.decisionContext.contact.name || 'there';
    const originalSubject = context.decisionContext.inboundMessage.subject || 'Hello';
    const replySubject = originalSubject.toLowerCase().startsWith('re:') ? originalSubject : `Re: ${originalSubject}`;

    if (context.decision.intent === 'pricing_request') {
      return MessageDraftSchema.parse({
        subject: replySubject,
        body_text: `Hi ${contactName},\n\nThanks for asking about our pricing. I'd be glad to share the details tailored to your workspace requirements.\n\nCould you let me know roughly how many contacts or team members you are looking to support?\n\nBest,\n${context.decisionContext.agent.name}`,
        draft_version: 1,
      });
    }

    return MessageDraftSchema.parse({
      subject: replySubject,
      body_text: `Hi ${contactName},\n\nThanks for reaching out! Regarding your inquiry: ${context.decision.reason}.\n\nLet me know if that answers your question or if you need any additional details.\n\nBest,\n${context.decisionContext.agent.name}`,
      draft_version: 1,
    });
  }
}

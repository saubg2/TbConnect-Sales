import {
  LLMProvider,
  DecisionContext,
  DraftContext,
  AgentDecision,
  MessageDraft,
  AgentDecisionSchema,
  MessageDraftSchema,
} from '../types';

export interface MistralConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class MistralLLMProvider implements LLMProvider {
  name = 'mistral';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: MistralConfig) {
    this.apiKey = config?.apiKey || process.env.MISTRAL_API_KEY || '';
    this.model = config?.model || process.env.MISTRAL_MODEL || 'mistral-small-latest';
    this.baseUrl = config?.baseUrl || 'https://api.mistral.ai/v1';
  }

  private async callChatCompletion(messages: Array<{ role: string; content: string }>) {
    if (!this.apiKey) {
      throw new Error('Mistral API key is not configured. Set MISTRAL_API_KEY in .env.local');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from Mistral API');
    }

    return JSON.parse(content);
  }

  async decide(context: DecisionContext): Promise<AgentDecision> {
    const systemPrompt = `You are an AI Relationship Agent decision engine.
Analyze the inbound communication in the context of the agent's goal and relationship history.
Propose a structured next action and relationship update.

ALLOWED ACTIONS:
- "SEND_EMAIL": Standard direct answer or follow-up.
- "WAIT": Awaiting contact response or scheduled follow-up.
- "REQUEST_APPROVAL": Inquiries requiring human operator review (pricing, quotes, contracts, regulatory claims, discounts).
- "MARK_COMPLETE": Goal completed or contact requested opt-out.
- "ESCALATE": Blocked, high-risk or sensitive inquiry needing operator takeover.
- "NO_ACTION": Inbound does not need a response (polite thanks, auto-reply, acknowledgment).

ALLOWED STAGES:
"NEW", "OUTREACH", "ENGAGED", "NEGOTIATING", "COMPLETED", "STALLED", "OPTED_OUT".

RULES:
1. If the contact asks for pricing, cost, quotes, discounts, or enterprise contracts, you MUST set next_action="REQUEST_APPROVAL" and approval_required=true.
2. If the contact asks to unsubscribe, stop, or remove, set next_action="MARK_COMPLETE" and stage="OPTED_OUT".
3. If the contact is acknowledging receipt without a question ("thanks", "received"), set next_action="NO_ACTION".
4. Do not invent unverified facts. Only extract verified facts explicitly mentioned in messages.

Respond with strict JSON matching this schema:
{
  "intent": string,
  "confidence": number (0 to 1),
  "summary_update": string,
  "stage": string (one of the allowed stages),
  "next_action": string (one of the allowed actions),
  "reason": string,
  "draft_required": boolean,
  "approval_required": boolean,
  "schedule_after_minutes": number,
  "new_facts": string[],
  "open_questions": string[]
}`;

    const userPrompt = `AGENT GOAL: ${context.agent.goal}
AGENT INSTRUCTIONS: ${context.agent.instructions}
AGENT KNOWLEDGE: ${context.agent.knowledgeText || 'N/A'}

CONTACT:
Name: ${context.contact.name}
Email: ${context.contact.email}
Organisation: ${context.contact.organisation || 'N/A'}
Country: ${context.contact.country || 'N/A'}
Is Suppressed: ${context.contact.isSuppressed}

CURRENT RELATIONSHIP:
Stage: ${context.relationship.stage}
Summary: ${context.relationship.summary || 'None'}
Known Facts: ${JSON.stringify(context.relationship.facts)}
Open Questions: ${JSON.stringify(context.relationship.openQuestions)}

RECENT MESSAGES:
${context.recentMessages
  .map((m) => `[${m.direction}] ${m.subject || ''}: ${m.bodyText}`)
  .join('\n')}

CURRENT INBOUND MESSAGE:
Subject: ${context.inboundMessage.subject || '(No subject)'}
Body:
${context.inboundMessage.bodyText}

Analyze this message and return the JSON decision.`;

    const raw = await this.callChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return AgentDecisionSchema.parse(raw);
  }

  async draft(context: DraftContext): Promise<MessageDraft> {
    const voice = context.decisionContext.agent.voiceProfile || {};
    const formality = voice.formality || 'conversational-professional';
    const lengthPref = voice.length || 'concise';
    const avoidedPhrases = (voice.avoidedPhrases as string[]) || [];
    const examples = (voice.examples as string[]) || [];

    const systemPrompt = `You are drafting a professional email on behalf of ${context.decisionContext.agent.name}.
Goal: ${context.decisionContext.agent.goal}

WRITING STYLE GUIDELINES:
- Formality: ${formality}
- Length: ${lengthPref} (prefer short paragraphs, plain language).
- Tone: Natural, helpful, direct. Answer the specific question first.
- AVOID these phrases: ${avoidedPhrases.join(', ') || 'None'}.
- NEVER use artificial robotic pleasantries like "Hope this email finds you well", "I trust you are having a productive week".
- NEVER invent facts, fake partnerships, unverified meetings, or false commitments.
- NEVER pretend a human manually typed this if it's automated.
- Ask at most 1 or 2 meaningful questions.

WRITING EXAMPLES OF DESIRED VOICE:
${examples.length > 0 ? examples.map((ex, i) => `Example ${i + 1}:\n${ex}`).join('\n\n') : 'Concise, direct, friendly tone.'}

Return JSON strictly matching:
{
  "subject": string,
  "body_text": string,
  "draft_version": 1
}`;

    const userPrompt = `RECIPIENT: ${context.decisionContext.contact.name} (${context.decisionContext.contact.email})
DECISION:
Intent: ${context.decision.intent}
Action Reason: ${context.decision.reason}

INBOUND MESSAGE TO REPLY TO:
Subject: ${context.decisionContext.inboundMessage.subject || ''}
Body: ${context.decisionContext.inboundMessage.bodyText}

Draft a context-aware natural email response following the instructions.`;

    const raw = await this.callChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return MessageDraftSchema.parse(raw);
  }
}

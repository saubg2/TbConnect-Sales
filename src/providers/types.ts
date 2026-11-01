import { z } from 'zod';

export const ActionTypeEnum = z.enum([
  'SEND_EMAIL',
  'WAIT',
  'REQUEST_APPROVAL',
  'MARK_COMPLETE',
  'ESCALATE',
  'NO_ACTION',
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

export const RelationshipStageEnum = z.enum([
  'NEW',
  'OUTREACH',
  'ENGAGED',
  'NEGOTIATING',
  'COMPLETED',
  'STALLED',
  'OPTED_OUT',
]);
export type RelationshipStage = z.infer<typeof RelationshipStageEnum>;

export const AgentDecisionSchema = z.object({
  intent: z.string().min(1, 'Intent cannot be empty'),
  confidence: z.number().min(0).max(1),
  summary_update: z.string().min(1, 'Summary update is required'),
  stage: RelationshipStageEnum,
  next_action: ActionTypeEnum,
  reason: z.string().min(1, 'Reason is required'),
  draft_required: z.boolean(),
  approval_required: z.boolean(),
  schedule_after_minutes: z.number().int().min(0).nullable().optional().transform((val) => val ?? 0),
  new_facts: z.preprocess((val) => val ?? [], z.array(z.string()).default([])),
  open_questions: z.preprocess((val) => val ?? [], z.array(z.string()).default([])),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const MessageDraftSchema = z.object({
  subject: z.string().min(1),
  body_text: z.string().min(1),
  draft_version: z.number().int().default(1),
});
export type MessageDraft = z.infer<typeof MessageDraftSchema>;

export interface DecisionContext {
  agent: {
    name: string;
    goal: string;
    instructions: string;
    knowledgeText?: string | null;
    voiceProfile?: Record<string, any>;
    permissions?: Record<string, any>;
  };
  contact: {
    name: string;
    email: string;
    organisation?: string | null;
    country?: string | null;
    isSuppressed: boolean;
  };
  relationship: {
    stage: string;
    summary?: string | null;
    facts: string[];
    openQuestions: string[];
  };
  recentMessages: Array<{
    direction: 'INBOUND' | 'OUTBOUND';
    subject?: string | null;
    bodyText: string;
    receivedAt?: Date | null;
    sentAt?: Date | null;
  }>;
  inboundMessage: {
    subject?: string | null;
    bodyText: string;
    receivedAt: Date;
  };
}

export interface DraftContext {
  decision: AgentDecision;
  decisionContext: DecisionContext;
}

export interface OutboundMessage {
  workspaceId: string;
  relationshipId: string;
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  inReplyTo?: string | null;
  threadKey?: string | null;
  headers?: Record<string, string>;
}

export interface SendResult {
  status: 'ACCEPTED' | 'REJECTED';
  providerMessageId?: string;
  error?: string;
}

export interface InboundEvent {
  provider: string;
  eventType: string;
  providerEventId: string;
  rawPayload: any;
}

export interface InboundMessage {
  provider: string;
  providerMessageId: string;
  internetMessageId?: string;
  inReplyTo?: string;
  threadKey?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
  headers?: Record<string, string>;
}

export interface LLMProvider {
  name: string;
  decide(context: DecisionContext): Promise<AgentDecision>;
  draft(context: DraftContext): Promise<MessageDraft>;
}

export interface EmailSender {
  name: string;
  send(message: OutboundMessage, idempotencyKey: string): Promise<SendResult>;
}

export interface EmailInboundAdapter {
  name: string;
  verifyWebhook(rawBody: string, headers: Headers): Promise<InboundEvent>;
  retrieveMessage(event: InboundEvent): Promise<InboundMessage>;
}

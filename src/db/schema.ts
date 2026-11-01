import { pgTable, text, timestamp, boolean, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Helper for generating UUID strings
const defaultId = () => crypto.randomUUID();

/**
 * 1. WORKSPACES
 * Tenant root entity
 */
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  name: text('name').notNull(),
  settingsJson: jsonb('settings_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 2. MEMBERSHIPS
 * Supabase auth user_id mapped to workspace with role & permissions
 */
export const memberships = pgTable('memberships', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // 'owner' | 'operator' | 'viewer'
  permissionsJson: jsonb('permissions_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceUserIdx: uniqueIndex('memberships_workspace_user_idx').on(table.workspaceId, table.userId),
}));

/**
 * 3. CONTACTS
 * Workspace-scoped contacts with suppression and provenance
 */
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  emailNormalized: text('email_normalized').notNull(),
  organisation: text('organisation'),
  country: text('country'),
  tagsJson: jsonb('tags_json').notNull().default([]),
  sourceJson: jsonb('source_json').notNull().default({}),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'ARCHIVED'
  isSuppressed: boolean('is_suppressed').notNull().default(false),
  suppressionReason: text('suppression_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceEmailIdx: uniqueIndex('contacts_workspace_email_idx').on(table.workspaceId, table.emailNormalized),
  workspaceSuppressedIdx: index('contacts_workspace_suppressed_idx').on(table.workspaceId, table.isSuppressed),
}));

/**
 * 4. AGENTS
 * Configuration, goals, instructions, voice profile and permissions
 */
export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  instructions: text('instructions').notNull(),
  knowledgeText: text('knowledge_text'),
  voiceJson: jsonb('voice_json').notNull().default({}),
  permissionsJson: jsonb('permissions_json').notNull().default({}),
  llmProvider: text('llm_provider').notNull().default('mock'),
  llmModel: text('llm_model').notNull().default('mock-agent-v1'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceAgentIdx: index('agents_workspace_idx').on(table.workspaceId),
}));

/**
 * 5. RELATIONSHIPS
 * Context, stage, verified facts, open questions and assigned agent for a contact
 */
export const relationships = pgTable('relationships', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull().default('NEW'), // 'NEW' | 'OUTREACH' | 'ENGAGED' | 'NEGOTIATING' | 'COMPLETED' | 'STALLED' | 'OPTED_OUT'
  summary: text('summary'),
  factsJson: jsonb('facts_json').notNull().default([]),
  openQuestionsJson: jsonb('open_questions_json').notNull().default([]),
  currentActionId: text('current_action_id'),
  lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
  lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceContactAgentIdx: uniqueIndex('relationships_workspace_contact_agent_idx').on(table.workspaceId, table.contactId, table.agentId),
  workspaceStageIdx: index('relationships_workspace_stage_idx').on(table.workspaceId, table.stage),
}));

/**
 * 6. MESSAGES
 * Inbound and outbound communications history
 */
export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
  direction: text('direction').notNull(), // 'INBOUND' | 'OUTBOUND'
  channel: text('channel').notNull().default('EMAIL'), // 'EMAIL'
  subject: text('subject'),
  bodyText: text('body_text').notNull(),
  bodyHtml: text('body_html'),
  provider: text('provider').notNull().default('mock'),
  providerMessageId: text('provider_message_id'),
  internetMessageId: text('internet_message_id'),
  inReplyTo: text('in_reply_to'),
  threadKey: text('thread_key'),
  status: text('status').notNull().default('RECEIVED'), // 'RECEIVED' | 'SENT' | 'DRAFT' | 'FAILED'
  draftVersion: integer('draft_version').default(1),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceRelationshipIdx: index('messages_workspace_relationship_idx').on(table.workspaceId, table.relationshipId),
  providerMessageIdx: index('messages_provider_msg_idx').on(table.workspaceId, table.providerMessageId),
  threadKeyIdx: index('messages_thread_key_idx').on(table.workspaceId, table.threadKey),
}));

/**
 * 7. ACTIONS
 * Durable queued, pending, awaiting approval and completed actions
 */
export const actions = pgTable('actions', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'SEND_EMAIL' | 'WAIT' | 'REQUEST_APPROVAL' | 'MARK_COMPLETE' | 'ESCALATE' | 'NO_ACTION'
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'WAITING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  payloadJson: jsonb('payload_json').notNull().default({}),
  reason: text('reason'),
  approvalRequired: boolean('approval_required').notNull().default(false),
  approvedDraftVersion: integer('approved_draft_version'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  attemptCount: integer('attempt_count').notNull().default(0),
  idempotencyKey: text('idempotency_key').notNull(),
  providerReference: text('provider_reference'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceRelationshipIdx: index('actions_workspace_relationship_idx').on(table.workspaceId, table.relationshipId),
  idempotencyIdx: uniqueIndex('actions_idempotency_idx').on(table.idempotencyKey),
  statusScheduledIdx: index('actions_status_scheduled_idx').on(table.workspaceId, table.status, table.scheduledAt),
}));

/**
 * 8. EVENTS
 * Append-only audit history of all state changes and external events
 */
export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(defaultId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  relationshipId: text('relationship_id').references(() => relationships.id, { onDelete: 'cascade' }),
  actionId: text('action_id').references(() => actions.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  externalEventId: text('external_event_id'),
  payloadJson: jsonb('payload_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceRelationshipIdx: index('events_workspace_relationship_idx').on(table.workspaceId, table.relationshipId),
  eventTypeIdx: index('events_type_idx').on(table.workspaceId, table.eventType),
  externalEventIdx: index('events_external_id_idx').on(table.workspaceId, table.externalEventId),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;

export type AuditEvent = typeof events.$inferSelect;
export type NewAuditEvent = typeof events.$inferInsert;

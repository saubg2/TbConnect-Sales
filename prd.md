# PRD — Relationship Agent SaaS

**Version:** 1.0  
**Status:** Implementation-ready phased specification  
**Product concept:** An email-first, multi-tenant AI relationship manager that remembers conversations, proposes the next action, writes naturally, and acts only within configured permissions.

## 1. Product goal

Build the smallest maintainable SaaS that can import contacts, manage outreach, receive replies, maintain relationship memory, propose and schedule next actions, and support human approvals through web and Telegram. The product is industry-agnostic: sales, partnerships, recruitment, fundraising and research are use cases, not separate code paths.

**Differentiator:** Persistent relationship context + explicit next-action state + natural, sender-specific writing + controllable autonomy.

**Non-goal:** Rebuilding a full CRM, lead database, workflow builder, email delivery infrastructure or multi-agent orchestration platform.

## 2. Principles

1. **One modular monolith:** Next.js + TypeScript; no microservices.
2. **Own core logic, rent infrastructure:** Supabase for PostgreSQL/auth/storage, Trigger.dev for durable jobs, managed email and LLM APIs.
3. **Provider independence:** Implement LLM and email interfaces first; add providers incrementally.
4. **Database is source of truth:** Models cannot mutate records or send messages directly.
5. **Every action is durable:** Persist intent, schedule, approval state, execution state and outcome.
6. **Natural writing is a feature:** Use context, voice profiles and examples, not artificial typos or deceptive personal claims.
7. **Safe by default:** New campaigns are drafts; production sending requires explicit approval; suppression, tenant isolation and auditability are foundational.
8. **Avoid speculative abstractions:** Only generalise where two providers or two concrete use cases demonstrate a need.

## 3. Technology choices

| Concern | Choice |
|---|---|
| App and API | Next.js App Router, TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database and auth | Supabase PostgreSQL + Supabase Auth |
| SQL access | Drizzle ORM and migrations |
| Background execution | Trigger.dev |
| Schema validation | Zod |
| LLMs | Provider interface: OpenAI, Mistral, Z.ai |
| Email | Provider interface: Resend, SendGrid |
| Notifications/approvals | Telegram Bot API |
| Deployment | Vercel for app; managed Supabase and Trigger.dev |
| Testing | Vitest + integration tests; Playwright for key UI flows |

Initial production adapters: **OpenAI and Resend**. Mistral, Z.ai and SendGrid are supported by design, not implemented until Phase 6. Do not create empty adapter files.

## 4. Users and permissions

- **Workspace owner:** configure workspace, providers, agents, campaigns, members, billing; approve actions.
- **Operator:** manage contacts and campaigns, edit drafts, approve actions if granted permission.
- **Viewer:** read-only access.

Use Supabase Auth and enforce workspace membership on every server-side operation. Apply PostgreSQL row-level security to tenant data. Never trust a workspace ID supplied by the client without authorisation.

## 5. MVP scope

### In scope

- Workspace onboarding and login.
- CSV import, validation, deduplication, provenance and suppression.
- Contacts and relationship detail screens.
- Agent configuration: objective, allowed actions, knowledge, voice profile, example messages.
- Message history and conversation summary.
- Structured LLM decisions and natural reply drafting.
- Persisted actions, due times, approvals, execution history.
- Simple email campaign: audience, template, initial email and configurable limited follow-ups.
- Resend outbound and inbound integration, delivery event processing, unsubscribe and bounce handling.
- Telegram private-chat alerts and approve/reject buttons.
- Minimal dashboard and operational logs.

### Out of scope until justified

Lead enrichment, scraping, visual automation builder, lead scoring, full sales pipeline, native calendar, vector database, multi-agent frameworks, n8n, LinkedIn/WhatsApp, custom email warm-up, multi-provider failover, complex analytics, multilingual UI, per-customer Telegram bots, automated pricing and proposals.

## 6. Core domain model

Start with **eight application tables**; Supabase Auth manages its own user tables. Add a ninth table only if real multi-thread use requires it.

### `workspaces`
`id`, `name`, `settings_json`, `created_at`, `updated_at`.

### `memberships`
`id`, `workspace_id`, `user_id`, `role`, `permissions_json`, `created_at`; unique `(workspace_id, user_id)`.

### `contacts`
`id`, `workspace_id`, `name`, `email_normalized`, `organisation`, `country`, `tags_json`, `source_json`, `status`, `is_suppressed`, `suppression_reason`, `created_at`, `updated_at`; unique `(workspace_id, email_normalized)` where email is present. Store contact provenance and marketing eligibility. Suppression must apply across the workspace's campaigns.

### `agents`
`id`, `workspace_id`, `name`, `goal`, `instructions`, `knowledge_text`, `voice_json`, `permissions_json`, `llm_provider`, `llm_model`, `is_active`, `created_at`, `updated_at`. Voice includes greeting/sign-off preferences, formality, length, avoided phrases and user-provided writing examples.

### `relationships`
`id`, `workspace_id`, `contact_id`, `agent_id`, `stage`, `summary`, `facts_json`, `open_questions_json`, `current_action_id`, `last_inbound_at`, `last_outbound_at`, `created_at`, `updated_at`. Enforce ownership and unique relationship per `(workspace_id, contact_id, agent_id)` for V1. Do not store inferred facts as verified facts.

### `messages`
`id`, `workspace_id`, `relationship_id`, `direction`, `channel`, `subject`, `body_text`, `body_html`, `provider`, `provider_message_id`, `internet_message_id`, `in_reply_to`, `thread_key`, `status`, `draft_version`, `received_at`, `sent_at`, `created_at`. Preserve raw relevant headers and provider metadata as JSON. Deduplicate inbound messages by provider event/message identity.

### `actions`
`id`, `workspace_id`, `relationship_id`, `agent_id`, `type`, `status`, `scheduled_at`, `payload_json`, `reason`, `approval_required`, `approved_draft_version`, `approved_by`, `approved_at`, `attempt_count`, `idempotency_key`, `provider_reference`, `last_error`, `created_at`, `updated_at`. Statuses: `PENDING`, `WAITING`, `AWAITING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`. Store an immutable snapshot of the exact draft approved. Use unique idempotency keys and atomic transitions.

### `events`
`id`, `workspace_id`, `relationship_id`, `action_id`, `event_type`, `external_event_id`, `payload_json`, `created_at`. Append-only audit history; unique provider event identity where available.

**Note:** Email provider configuration and Telegram chat linkage can live in encrypted workspace settings for a single-operator prototype, but production SaaS must store secrets in an appropriate encrypted secret store and may introduce a dedicated `integrations` table. Never expose tokens to the browser or logs.

## 7. Provider contracts

Define common types in `src/providers/types.ts` and narrow interfaces:

```ts
interface LLMProvider {
  decide(context: DecisionContext): Promise<AgentDecision>;
  draft(context: DraftContext): Promise<MessageDraft>;
}

interface EmailSender {
  send(message: OutboundMessage, idempotencyKey: string): Promise<SendResult>;
}

interface EmailInboundAdapter {
  verifyWebhook(rawBody: string, headers: Headers): Promise<InboundEvent>;
  retrieveMessage(event: InboundEvent): Promise<InboundMessage>;
}
```

Email sending and receiving are separate capabilities; do not assume all vendors expose the same inbound APIs. Keep provider-specific webhook routes thin. Normalise all events before core processing. Provider selection belongs to workspace/agent configuration; do not hard-code it in business logic.

For LLM adapters, account for differences in structured-output support and model naming. Validate every response with Zod and reject or safely retry invalid responses. Never assume model outputs are trustworthy instructions.

## 8. Relationship decision flow

**Trigger:** simulated inbound message (Phase 2), actual inbound email (Phase 4), or due action.

1. Load authorised workspace, contact, relationship, recent messages, summary, agent goal, voice and knowledge.
2. Check suppression, campaign status and human-takeover flags.
3. Ask LLM to classify intent and propose a structured next action.
4. Validate against schema, agent permissions and business rules.
5. Persist decision, action and audit event in one transaction where practical.
6. If drafting is required, generate concise context-aware text.
7. If approval is required, store exact draft snapshot and wait.
8. Otherwise enqueue eligible action for durable execution.
9. On confirmed completion, append events and update summary/next action.

Allowed initial action types: `SEND_EMAIL`, `WAIT`, `REQUEST_APPROVAL`, `MARK_COMPLETE`, `ESCALATE`, `NO_ACTION`. Do not allow the LLM to emit arbitrary tools or SQL.

**Example decision contract:**

```json
{
  "intent": "information_request",
  "confidence": 0.92,
  "summary_update": "Contact requested a short overview.",
  "stage": "ENGAGED",
  "next_action": "SEND_EMAIL",
  "reason": "Answer the specific question",
  "draft_required": true,
  "approval_required": false,
  "schedule_after_minutes": 0
}
```

The server determines final approval requirements; the model's `approval_required` field is advisory only.

## 9. Human communication requirements

- Answer the actual question first; do not over-sell.
- Use the sender's supplied voice profile and representative writing examples.
- Prefer short paragraphs and plain language; length depends on the task.
- Avoid generic AI phrases, excessive flattery, repeated introductions and fabricated familiarity.
- Ask at most one or two meaningful questions unless the user explicitly requests a questionnaire.
- Preserve the conversation's language where supported and appropriate.
- Do not invent facts, case studies, relationships, research, meetings, or commitments.
- Do not add intentional errors to mimic a person.
- Never claim a human personally typed or reviewed an automatically generated message.
- Record human edits to drafts; use approved edits as future voice examples with user control.
- Support `NO_ACTION` when a reply is unnecessary.

Naturalness is evaluated using blinded human review of test conversations, not only an LLM-as-judge score.

## 10. Campaign and delivery rules

V1 campaign = agent + selected contacts + approved initial template + limited follow-up rules + schedule. No visual sequence editor.

- Production sends disabled until explicit workspace approval.
- Contact must have documented outreach eligibility under applicable law and provider policy; an imported address alone does not imply consent.
- Check global workspace suppression immediately before every send.
- Stop pending generic follow-ups on a substantive inbound reply, opt-out, bounce or complaint.
- Send individually from a durable queue; configurable pacing and sending windows are for orderly operations, not evasion of anti-spam controls.
- Respect provider limits and sender-domain authentication.
- Distinguish provider acceptance from actual delivery.
- Use deterministic idempotency keys; reconcile ambiguous provider responses before retrying.
- Offer campaign pause and emergency stop.
- Include accurate sender identity and legally appropriate opt-out mechanism.

## 11. Approval workflow

Approvals are `actions` in `AWAITING_APPROVAL` state. Store exact proposed message and version.

- Approve: atomically verify role, current state, draft version and eligibility; enqueue send.
- Edit: create a new draft version; prior approval becomes invalid.
- Reject: mark action cancelled/rejected and audit.
- Expired or already-processed approvals cannot be reused.
- Approval never bypasses suppression, campaign pause or sender eligibility checks.
- Commercial terms, prices, contracts, regulatory or clinical claims require human review by default.

Phase 3 uses a web approval page; Phase 5 adds Telegram buttons invoking the **same approval service**.

## 12. Telegram requirements (Phase 5)

Shared Telegram bot for V1. Authorised workspace members connect by a secure one-time linking flow in private chat.

Notifications: new reply, positive interest, approval required, important errors, optional daily digest.

Inline buttons: `Approve`, `Reject`, `Open to edit`. Editing happens on an authenticated web page.

Security: verify Telegram webhook secret header; verify Telegram user-to-workspace mapping; use opaque short-lived callback tokens; bind callback to action ID and draft version; ensure atomic single-use approval; minimise sensitive text in notifications. Telegram downtime must not block core processing.

## 13. Screens (five only)

1. **Contacts:** CSV import, list/search/filter, relationship details and event timeline.
2. **Agents:** goal, voice examples, approved knowledge, permissions, provider selection.
3. **Inbox:** thread view, summaries, draft replies, manual takeover.
4. **Actions:** pending, scheduled, approvals, errors, manual edit/approve/reject.
5. **Settings:** workspace members, sender configuration, Telegram link, safety limits.

Use basic summary counts on the home screen. Defer advanced analytics.

## 14. Code organisation

```text
src/
  app/
    (auth)/
    (dashboard)/contacts/
    (dashboard)/agents/
    (dashboard)/inbox/
    (dashboard)/actions/
    (dashboard)/settings/
    api/webhooks/
  core/
    contacts/
    relationships/
    conversations/
    agents/
    actions/
    campaigns/
  providers/
    types.ts
    llm/{interface,mock,openai}.ts
    email/{interface,mock,resend}.ts
    telegram/
  jobs/
    process-message.ts
    execute-action.ts
    send-email.ts
  db/{schema,client}/
  lib/
tests/
```

**Phase 0 only creates modules actually used.** The directory above is the eventual V1 layout, not a request for empty files. Keep core logic independent from HTTP handlers and provider SDKs.

## 15. Phased build plan and exit gates

### Phase 0 — Contracts and test harness

**Build:** Next.js skeleton; Drizzle schema; domain types; LLM/email interfaces; mock providers; Zod decision contract; Vitest; seeded test data. Document invariants and configuration.

**Do not build:** Real email, Telegram, billing, dashboards beyond a development view.

**Exit:** Tests demonstrate simulated inbound → validated decision → persisted next action without external APIs.

### Phase 1 — Contacts and relationship state

**Build:** Supabase Auth, workspaces/memberships/RLS, CSV import with deduplication, provenance and suppression, contacts list/detail, relationship memory model, event log.

**Exit:** Two workspaces cannot access each other's records; 100 test contacts import correctly; duplicates and suppressed addresses handled.

### Phase 2 — LLM and natural drafting

**Build:** OpenAI adapter, structured decision function, summarisation, agent instructions, voice profile, writing examples, simulated inbox, natural reply drafts, factual/permission validation.

**Do not build:** Mistral/Z.ai adapters, vector search, web enrichment.

**Exit:** A scripted set of multi-turn conversations preserves facts, generates useful next actions, and escalates pricing or sensitive claims.

### Phase 3 — Durable actions and web approvals

**Build:** Trigger.dev integration, persistent action lifecycle, retries, atomic claims, idempotency, due-date scheduling, approval/edit/reject web flow, audit trail, emergency stop.

**Exit:** Restart/retry tests do not duplicate an action; edited drafts invalidate prior approvals; suppressed contacts cannot be sent to.

### Phase 4 — First real email integration

**Build:** Resend sender, authenticated domain setup guidance, inbound receiving adapter and verified webhooks, thread matching, provider event deduplication, simple campaign sequence, delivery status, bounce/complaint/unsubscribe processing.

**Exit:** With test addresses, one approved outreach message is delivered, reply ingested, next action generated and safe reply sent/approved. Pause, suppression and failure tests pass.

### Phase 5 — Telegram operational interface

**Build:** Shared Telegram bot, secure account linking, alerts, approval/reject buttons, edit deep link, optional digest. Reuse existing action/approval services.

**Exit:** Only an authorised approver can approve the exact current draft; repeated/expired callbacks do nothing; Telegram failure does not lose an action.

### Phase 6 — Productisation and optional providers

**Build only after pilot evidence:** Mistral and Z.ai LLM adapters, SendGrid email adapter, billing, quotas, onboarding, monitoring, customer support tooling, data export/deletion, operational runbooks. Add integration configuration UI as needed.

**Exit:** At least two LLM providers and two email providers pass the same contract tests; workspace usage is isolated and metered; production beta checklist passes.

## 16. Test scenarios

Required automated tests:

- Tenant A cannot read or approve Tenant B actions.
- CSV duplicate import does not create duplicate contacts.
- Suppressed contact never receives queued email.
- Reply cancels pending generic follow-ups.
- Incoming webhook replay creates one message/event.
- Worker retry does not cause duplicate sending.
- Unknown provider acceptance is reconciled before retry.
- Malformed LLM JSON produces no action.
- Incoming prompt injection cannot override agent permissions.
- Pricing request goes to human approval.
- Natural reply does not invent relationship history.
- Draft edit invalidates old approval.
- Telegram callback from unknown user is rejected.
- Provider outage preserves action for controlled retry.
- Campaign emergency stop blocks all pending sends.

## 17. Operational requirements

- Use environment variables for secrets; never commit keys.
- Structured logs with correlation IDs, without sensitive email bodies or tokens by default.
- Daily database backups and tested restoration before public beta.
- Configurable retention and deletion/export workflows.
- Basic cost and usage telemetry for model tokens, email sends and job runs.
- Rate limits and abuse monitoring for customer campaigns.
- Deployment migrations and rollback plan.
- Document email authentication, provider webhook setup, Telegram bot setup and incident response.

## 18. Definition of MVP done

A workspace owner can sign in, import eligible contacts, configure an agent's goal and writing voice, review a simple campaign, approve sending, send via Resend, receive a reply, inspect the complete relationship context, receive a natural proposed response, approve sensitive actions through web or Telegram, and see the resulting next action and audit trail. All workflows survive retries/restarts without unsafe duplicate sends.

## 19. Instructions to coding agent

1. Read this PRD and inspect the repository before coding.
2. Implement **only the current phase**; do not pre-build future integrations.
3. Present a short implementation plan and schema changes before each phase.
4. Keep business rules in `src/core`; keep provider SDKs in `src/providers`.
5. Use strict TypeScript, Zod validation, database migrations and tests.
6. Use mocks and dry-run mode by default; never send production email without explicit configuration and approval.
7. Provide setup commands, `.env.example`, tests and phase acceptance evidence.
8. Do not claim an integration works unless verified with its sandbox/test environment.
9. Flag genuine ambiguities; otherwise use the simplest maintainable implementation.
10. Optimise for **fewest moving parts and smallest reliable codebase**, not maximum feature count.

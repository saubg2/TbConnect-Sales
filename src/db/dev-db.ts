import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';
import path from 'path';

let devDbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDevDb() {
  if (devDbInstance) return devDbInstance;

  const dataDir = path.resolve(process.cwd(), '.pgdata');
  pgliteInstance = new PGlite(dataDir);
  devDbInstance = drizzle(pgliteInstance, { schema });

  // Ensure tables exist
  await pgliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT memberships_workspace_user_idx UNIQUE (workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email_normalized TEXT NOT NULL,
      organisation TEXT,
      country TEXT,
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_suppressed BOOLEAN NOT NULL DEFAULT false,
      suppression_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT contacts_workspace_email_idx UNIQUE (workspace_id, email_normalized)
    );
    CREATE INDEX IF NOT EXISTS contacts_workspace_suppressed_idx ON contacts(workspace_id, is_suppressed);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      goal TEXT NOT NULL,
      instructions TEXT NOT NULL,
      knowledge_text TEXT,
      voice_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      llm_provider TEXT NOT NULL DEFAULT 'mock',
      llm_model TEXT NOT NULL DEFAULT 'mock-agent-v1',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS agents_workspace_idx ON agents(workspace_id);

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      stage TEXT NOT NULL DEFAULT 'NEW',
      summary TEXT,
      facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      open_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_action_id TEXT,
      last_inbound_at TIMESTAMPTZ,
      last_outbound_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT relationships_workspace_contact_agent_idx UNIQUE (workspace_id, contact_id, agent_id)
    );
    CREATE INDEX IF NOT EXISTS relationships_workspace_stage_idx ON relationships(workspace_id, stage);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'EMAIL',
      subject TEXT,
      body_text TEXT NOT NULL,
      body_html TEXT,
      provider TEXT NOT NULL DEFAULT 'mock',
      provider_message_id TEXT,
      internet_message_id TEXT,
      in_reply_to TEXT,
      thread_key TEXT,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      draft_version INTEGER DEFAULT 1,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      received_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_workspace_relationship_idx ON messages(workspace_id, relationship_id);
    CREATE INDEX IF NOT EXISTS messages_provider_msg_idx ON messages(workspace_id, provider_message_id);

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      scheduled_at TIMESTAMPTZ,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      reason TEXT,
      approval_required BOOLEAN NOT NULL DEFAULT false,
      approved_draft_version INTEGER,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT NOT NULL UNIQUE,
      provider_reference TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS actions_workspace_relationship_idx ON actions(workspace_id, relationship_id);
    CREATE INDEX IF NOT EXISTS actions_status_scheduled_idx ON actions(workspace_id, status, scheduled_at);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      relationship_id TEXT REFERENCES relationships(id) ON DELETE CASCADE,
      action_id TEXT REFERENCES actions(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      external_event_id TEXT,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS events_workspace_relationship_idx ON events(workspace_id, relationship_id);
    CREATE INDEX IF NOT EXISTS events_type_idx ON events(workspace_id, event_type);
  `);

  // Seed default workspace if empty
  const existingWs = await devDbInstance.select().from(schema.workspaces).limit(1);
  if (existingWs.length === 0) {
    const wsId = 'ws_default';
    const agentId = 'agent_default';

    await devDbInstance.insert(schema.workspaces).values({
      id: wsId,
      name: 'Default Workspace',
      settingsJson: { outboundEnabled: true },
    });

    await devDbInstance.insert(schema.agents).values({
      id: agentId,
      workspaceId: wsId,
      name: 'Sarah - Relationship Manager',
      goal: 'Qualify inbound inquiries and draft helpful, concise follow-ups.',
      instructions: 'Always be clear and courteous. Never invent pricing or make unauthorized commitments.',
      knowledgeText: 'We build autonomous relationship management infrastructure.',
      voiceJson: {
        formality: 'friendly-professional',
        length: 'concise',
        avoidedPhrases: ['Hope this email finds you well'],
      },
      permissionsJson: {
        canQuotePricing: false,
      },
      llmProvider: 'mock',
      llmModel: 'mock-agent-v1',
      isActive: true,
    });
  }

  return devDbInstance;
}

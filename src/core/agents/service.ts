import { getDbAsync } from '@/db/client';
import { agents, events, workspaces } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface UpdateAgentInput {
  name?: string;
  goal?: string;
  instructions?: string;
  knowledgeText?: string;
  voiceJson?: {
    tone?: string;
    maxSentences?: number;
    avoidPhrases?: string[];
    forbiddenTopics?: string[];
  };
  permissionsJson?: {
    allowCommercialPricing?: boolean;
    allowContractTerms?: boolean;
    allowDirectOutreach?: boolean;
    requireReviewForNewDomains?: boolean;
  };
  llmProvider?: string;
  llmModel?: string;
  isActive?: boolean;
}

export class AgentService {
  /**
   * List all agents for a workspace. If none exist, auto-seeds default Sarah agent.
   */
  static async listAgents(workspaceId: string, customDb?: any) {
    const db = customDb || (await getDbAsync());
    const existing = await db.select().from(agents).where(eq(agents.workspaceId, workspaceId));

    if (existing.length > 0) {
      return existing;
    }

    // Ensure workspace exists before inserting agent
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (ws.length === 0) {
      await db.insert(workspaces).values({
        id: workspaceId,
        name: 'Default Workspace',
      });
    }

    // Seed default agent
    const defaultAgent = await this.createAgent(
      workspaceId,
      {
        name: 'Sarah - Partner Relationships',
        goal: 'Engage inbound leads and schedule discovery conversations for enterprise partnerships',
        instructions:
          'Maintain a warm, professional, and helpful tone. Answer product questions directly using only approved knowledge. Never invent features or make binding commercial pricing commitments.',
        knowledgeText:
          'Product: Next-generation B2B relationship orchestration platform. Features: Multi-channel messaging, durable state machines, autonomous decision engine with human approval gates. Integrations: REST API, Webhooks, Resend, Telegram.',
        voiceJson: {
          tone: 'professional, warm, direct',
          maxSentences: 4,
          avoidPhrases: ['synergy', 'touch base', 'low-hanging fruit', 'circle back'],
          forbiddenTopics: ['commercial pricing quotes', 'legal commitments', 'unreleased features'],
        },
        permissionsJson: {
          allowCommercialPricing: false,
          allowContractTerms: false,
          allowDirectOutreach: true,
          requireReviewForNewDomains: false,
        },
        llmProvider: process.env.LLM_PROVIDER || 'mock',
        llmModel: process.env.MISTRAL_MODEL || 'ministral-8b-latest',
      },
      'system',
      db
    );

    return [defaultAgent];
  }

  /**
   * Get a specific agent by ID
   */
  static async getAgent(workspaceId: string, agentId: string, customDb?: any) {
    const db = customDb || (await getDbAsync());
    const rows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)));
    return rows[0] || null;
  }

  /**
   * Update an agent configuration with audit event
   */
  static async updateAgent(
    workspaceId: string,
    agentId: string,
    input: UpdateAgentInput,
    actorId = 'system',
    customDb?: any
  ) {
    const db = customDb || (await getDbAsync());
    const existing = await this.getAgent(workspaceId, agentId, db);
    if (!existing) {
      throw new Error(`Agent ${agentId} not found in workspace ${workspaceId}`);
    }

    const updated = await db
      .update(agents)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.knowledgeText !== undefined ? { knowledgeText: input.knowledgeText } : {}),
        ...(input.voiceJson !== undefined ? { voiceJson: input.voiceJson } : {}),
        ...(input.permissionsJson !== undefined ? { permissionsJson: input.permissionsJson } : {}),
        ...(input.llmProvider !== undefined ? { llmProvider: input.llmProvider } : {}),
        ...(input.llmModel !== undefined ? { llmModel: input.llmModel } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)))
      .returning();

    // Record audit event
    await db.insert(events).values({
      workspaceId,
      eventType: 'AGENT_CONFIG_UPDATED',
      payloadJson: {
        agentId,
        actorId,
        previous: {
          name: existing.name,
          goal: existing.goal,
          llmProvider: existing.llmProvider,
          llmModel: existing.llmModel,
        },
        updated: input,
      },
    });

    return updated[0];
  }

  /**
   * Create a new agent configuration
   */
  static async createAgent(
    workspaceId: string,
    input: {
      name: string;
      goal: string;
      instructions: string;
      knowledgeText?: string;
      voiceJson?: any;
      permissionsJson?: any;
      llmProvider?: string;
      llmModel?: string;
    },
    actorId = 'system',
    customDb?: any
  ) {
    const db = customDb || (await getDbAsync());
    const rows = await db
      .insert(agents)
      .values({
        workspaceId,
        name: input.name,
        goal: input.goal,
        instructions: input.instructions,
        knowledgeText: input.knowledgeText || '',
        voiceJson: input.voiceJson || {
          tone: 'professional, warm, direct',
          maxSentences: 4,
          avoidPhrases: ['synergy', 'touch base', 'low-hanging fruit', 'circle back'],
          forbiddenTopics: ['commercial pricing quotes', 'legal commitments', 'unreleased features'],
        },
        permissionsJson: input.permissionsJson || {
          allowCommercialPricing: false,
          allowContractTerms: false,
          allowDirectOutreach: true,
          requireReviewForNewDomains: false,
        },
        llmProvider: input.llmProvider || process.env.LLM_PROVIDER || 'mock',
        llmModel: input.llmModel || process.env.MISTRAL_MODEL || 'mock-agent-v1',
        isActive: true,
      })
      .returning();

    const created = rows[0];

    await db.insert(events).values({
      workspaceId,
      eventType: 'AGENT_CREATED',
      payloadJson: { agentId: created.id, name: created.name, goal: created.goal, actorId },
    });

    return created;
  }
}

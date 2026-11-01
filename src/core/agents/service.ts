import { db } from '@/db/client';
import { agents, events } from '@/db/schema';
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
   * List all agents for a workspace
   */
  static async listAgents(workspaceId: string) {
    return await db.select().from(agents).where(eq(agents.workspaceId, workspaceId));
  }

  /**
   * Get a specific agent by ID
   */
  static async getAgent(workspaceId: string, agentId: string) {
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
    actorId = 'system'
  ) {
    const existing = await this.getAgent(workspaceId, agentId);
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
    actorId = 'system'
  ) {
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
        llmProvider: input.llmProvider || 'mock',
        llmModel: input.llmModel || 'mock-agent-v1',
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

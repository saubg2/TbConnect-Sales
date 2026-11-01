import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/core/agents/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';
    const agentId = searchParams.get('agentId');

    if (agentId) {
      const agent = await AgentService.getAgent(workspaceId, agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      return NextResponse.json({ agent });
    }

    const agentsList = await AgentService.listAgents(workspaceId);
    return NextResponse.json({ agents: agentsList });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId = 'ws_default', action, agentId, data } = body;

    if (action === 'update') {
      if (!agentId) {
        return NextResponse.json({ error: 'agentId is required for update' }, { status: 400 });
      }
      const updated = await AgentService.updateAgent(workspaceId, agentId, data);
      return NextResponse.json({ success: true, agent: updated });
    }

    if (action === 'create') {
      const created = await AgentService.createAgent(workspaceId, data);
      return NextResponse.json({ success: true, agent: created });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error modifying agent:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

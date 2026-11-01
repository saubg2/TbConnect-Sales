import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { ResendInboundAdapter } from '@/providers/email/resend-inbound';
import { DeliveryEventsProcessor } from '@/core/campaigns/events-processor';
import { DecisionEngine } from '@/core/relationships/decision-engine';
import { getLLMProvider } from '@/providers/llm';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;

    const adapter = new ResendInboundAdapter();
    const inboundEvent = await adapter.verifyWebhook(rawBody, headers);

    const db = await getDbAsync();
    const llm = getLLMProvider();
    const decisionEngine = new DecisionEngine(db, llm);
    const processor = new DeliveryEventsProcessor(db, decisionEngine);

    const workspaceId = headers.get('x-workspace-id') || 'ws_default';
    const result = await processor.processEvent(workspaceId, inboundEvent);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

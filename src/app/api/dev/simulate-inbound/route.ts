import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { DecisionEngine } from '@/core/relationships/decision-engine';
import { MockLLMProvider } from '@/providers/llm/mock';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await getDbAsync();

    const workspaceId = body.workspaceId || 'ws_default';
    const fromEmail = body.fromEmail || 'inquiry@acme-partner.com';
    const fromName = body.fromName || 'Test Lead';
    const subject = body.subject || 'Integration question';
    const bodyText = body.bodyText || 'Hi, can you tell us more about your product?';

    const llm = new MockLLMProvider();
    const engine = new DecisionEngine(db, llm);

    const result = await engine.processInboundMessage({
      workspaceId,
      fromEmail,
      fromName,
      subject,
      bodyText,
      provider: 'mock',
      providerMessageId: `mock_inbound_${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

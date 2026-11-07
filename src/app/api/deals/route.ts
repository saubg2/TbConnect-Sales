import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDbAsync } from '@/db/client';
import { deals } from '@/db/schema';

const stages = ['QUALIFICATION','NEEDS_ANALYSIS','DEMO_DONE','PROPOSAL_PRICE_QUOTE','NEGOTIATION_REVIEW','CLOSED_WON','CLOSED_LOST'];

export async function GET(req: Request) {
  const workspaceId = new URL(req.url).searchParams.get('workspaceId') || 'ws_default';
  const db = await getDbAsync();
  const records = await db.select().from(deals).where(eq(deals.workspaceId, workspaceId)).orderBy(desc(deals.updatedAt));
  return NextResponse.json({ deals: records });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!String(body.name || '').trim()) return NextResponse.json({ error: 'Deal name is required' }, { status: 400 });
    if (!stages.includes(body.stage)) return NextResponse.json({ error: 'Invalid deal stage' }, { status: 400 });
    const probability = Number(body.probability || 0);
    if (probability < 0 || probability > 100) return NextResponse.json({ error: 'Probability must be 0–100' }, { status: 400 });
    const db = await getDbAsync();
    const [deal] = await db.insert(deals).values({
      id: crypto.randomUUID(), workspaceId: body.workspaceId || 'ws_default', owner: body.owner || 'saubconsulting',
      name: body.name.trim(), contactId: body.contactId || null, organizationId: body.organizationId || null,
      probability, stage: body.stage, amount: body.amount ? Number(body.amount) : null,
      closingDate: body.closingDate ? new Date(body.closingDate) : null,
      description: body.description || null, rep: body.rep || null,
    }).returning();
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}

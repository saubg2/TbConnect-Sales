import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { EmergencyStopService } from '@/core/actions/emergency';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const db = await getDbAsync();
    const service = new EmergencyStopService(db);
    const isActive = await service.isEmergencyStopActive(workspaceId);

    return NextResponse.json({ workspaceId, emergencyStopActive: isActive });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || 'ws_default';
    const enabled = !!body.enabled;
    const reason = body.reason || 'Manual operator toggle';

    const db = await getDbAsync();
    const service = new EmergencyStopService(db);
    const result = await service.setEmergencyStop({
      workspaceId,
      enabled,
      reason,
      userId: body.userId || 'operator',
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService } from '@/core/compliance/export-delete';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const exportData = await ComplianceService.exportWorkspaceData(workspaceId);
    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Error exporting workspace data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

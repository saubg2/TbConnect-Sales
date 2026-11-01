import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { HostingerImapListener } from '@/providers/email/imap-listener';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws_default';

    const db = await getDbAsync();
    const listener = new HostingerImapListener(undefined, db);

    if (!listener.isConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'Hostinger IMAP credentials not configured. Please set IMAP_PASSWORD in Railway variables.',
      }, { status: 400 });
    }

    const result = await listener.syncInbox(workspaceId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

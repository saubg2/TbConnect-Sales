import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { DecisionEngine } from '@/core/relationships/decision-engine';
import { getLLMProvider } from '@/providers/llm';

export interface ImapConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export class HostingerImapListener {
  private host: string;
  private port: number;
  private user: string;
  private pass: string;

  constructor(config?: ImapConfig, private db?: any) {
    this.host = config?.host || process.env.IMAP_HOST || 'imap.hostinger.com';
    this.port = config?.port || parseInt(process.env.IMAP_PORT || '993', 10);
    this.user = config?.user || process.env.IMAP_USER || 'contact@tbconnect.in';
    this.pass = config?.pass || process.env.IMAP_PASS || process.env.IMAP_PASSWORD || '';
  }

  isConfigured(): boolean {
    return Boolean(this.user && this.pass);
  }

  async syncInbox(workspaceId = 'ws_default') {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Hostinger IMAP credentials not configured (IMAP_USER, IMAP_PASSWORD)' };
    }

    const client = new ImapFlow({
      host: this.host,
      port: this.port,
      secure: true,
      auth: {
        user: this.user,
        pass: this.pass,
      },
      logger: false,
    });

    let processedCount = 0;
    const errors: string[] = [];

    try {
      await client.connect();

      // Open INBOX
      const lock = await client.getMailboxLock('INBOX');
      try {
        const llm = getLLMProvider();
        const engine = new DecisionEngine(this.db, llm);

        // Fetch unseen messages
        for await (const message of client.fetch({ seen: false }, { source: true, uid: true, envelope: true })) {
          try {
            if (!message.source) continue;
            const parsed = await simpleParser(message.source);

            const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
            const fromName = parsed.from?.value?.[0]?.name || '';
            const subject = parsed.subject || '';
            const htmlText = typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, ' ') : '';
            const bodyText = parsed.text || htmlText || '';
            const messageId = parsed.messageId || `imap_${message.uid}`;

            if (fromAddress && fromAddress !== this.user.toLowerCase()) {
              await engine.processInboundMessage({
                workspaceId,
                fromEmail: fromAddress,
                fromName,
                subject,
                bodyText,
                provider: 'hostinger_imap',
                providerMessageId: messageId,
                internetMessageId: parsed.messageId,
                inReplyTo: parsed.inReplyTo,
              });

              processedCount++;
            }

            // Mark as seen so we don't re-process next cycle
            await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);
          } catch (msgErr: any) {
            console.error('Error processing single IMAP message:', msgErr);
            errors.push(msgErr.message);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return { ok: true, processedCount, errors };
    } catch (err: any) {
      console.error('IMAP sync error:', err);
      return { ok: false, error: err.message };
    }
  }
}

import { EmailSender, OutboundMessage, SendResult } from '../types';

export interface ResendConfig {
  apiKey?: string;
  defaultFrom?: string;
  dryRun?: boolean;
}

export class ResendEmailSender implements EmailSender {
  name = 'resend';
  private apiKey: string;
  private defaultFrom: string;
  private dryRun: boolean;

  constructor(config?: ResendConfig) {
    this.apiKey = config?.apiKey || process.env.RESEND_API_KEY || '';
    this.defaultFrom = config?.defaultFrom || process.env.RESEND_DEFAULT_FROM || 'contact@tbconnect.in';
    this.dryRun =
      config?.dryRun ??
      (process.env.DRY_RUN_MODE === 'true' || process.env.ENABLE_PRODUCTION_SENDS !== 'true');
  }

  async send(message: OutboundMessage, idempotencyKey: string): Promise<SendResult> {
    // Safe-by-default: dry run mode does not send real external email unless explicitly enabled
    if (this.dryRun || !this.apiKey) {
      const mockId = `dryrun_${crypto.randomUUID()}`;
      return {
        status: 'ACCEPTED',
        providerMessageId: mockId,
      };
    }

    try {
      const fromAddress = this.defaultFrom.includes('<')
        ? this.defaultFrom
        : `${message.fromName || process.env.SENDER_NAME || 'Dr. Mahek Aneja'} <${this.defaultFrom}>`;

      const payload: Record<string, any> = {
        from: fromAddress,
        to: [message.toEmail],
        subject: message.subject,
        text: message.bodyText,
        headers: {
          'X-Entity-Ref-ID': idempotencyKey,
          ...(message.headers || {}),
        },
      };

      if (message.bodyHtml) {
        payload.html = message.bodyHtml;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          status: 'REJECTED',
          error: data.message || `Resend API HTTP ${response.status}`,
        };
      }

      return {
        status: 'ACCEPTED',
        providerMessageId: data.id,
      };
    } catch (err: any) {
      return {
        status: 'REJECTED',
        error: err.message || 'Network error connecting to Resend',
      };
    }
  }
}

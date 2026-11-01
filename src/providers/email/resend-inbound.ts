import {
  EmailInboundAdapter,
  InboundEvent,
  InboundMessage,
} from '../types';
import crypto from 'crypto';

export class ResendInboundAdapter implements EmailInboundAdapter {
  name = 'resend';

  constructor(private webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.RESEND_WEBHOOK_SECRET;
  }

  /**
   * Verifies Svix webhook signature and normalizes into InboundEvent
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<InboundEvent> {
    const svixId = headers.get('svix-id') || headers.get('webhook-id');
    const svixTimestamp = headers.get('svix-timestamp') || headers.get('webhook-timestamp');
    const svixSignature = headers.get('svix-signature') || headers.get('webhook-signature');

    // If webhook secret is configured, verify HMAC signature
    if (this.webhookSecret && svixId && svixTimestamp && svixSignature) {
      const secret = this.webhookSecret.startsWith('whsec_')
        ? this.webhookSecret.substring(6)
        : this.webhookSecret;

      const secretBuffer = Buffer.from(secret, 'base64');
      const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
      const expectedSig = crypto
        .createHmac('sha256', secretBuffer)
        .update(toSign)
        .digest('base64');

      const signatures = svixSignature.split(' ').map((s) => s.split(',')[1] || s);
      const isMatch = signatures.some((sig) => sig === `v1,${expectedSig}` || sig === expectedSig);

      if (!isMatch) {
        throw new Error('Invalid Resend webhook signature');
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { rawBody };
    }

    const eventType = payload.type || 'email.received';
    const providerEventId = payload.data?.id || payload.id || svixId || `resend_${crypto.randomUUID()}`;

    return {
      provider: 'resend',
      eventType,
      providerEventId,
      rawPayload: payload,
    };
  }

  /**
   * Normalizes an InboundEvent into an InboundMessage
   */
  async retrieveMessage(event: InboundEvent): Promise<InboundMessage> {
    const data = event.rawPayload?.data || event.rawPayload || {};

    const fromString = data.from || 'sender@external.com';
    let fromEmail = fromString;
    let fromName: string | undefined = undefined;

    const emailMatch = fromString.match(/^(.*?)<([^>]+)>$/);
    if (emailMatch) {
      fromName = emailMatch[1].trim();
      fromEmail = emailMatch[2].trim();
    }

    const toString = Array.isArray(data.to) ? data.to[0] : data.to || 'agent@workspace.local';

    return {
      provider: 'resend',
      providerMessageId: data.id || event.providerEventId,
      internetMessageId: data.headers?.['message-id'] || data.message_id,
      inReplyTo: data.headers?.['in-reply-to'] || data.in_reply_to,
      threadKey: data.headers?.['references'] || data.subject || 'default-thread',
      fromEmail: fromEmail.toLowerCase(),
      fromName,
      toEmail: toString.toLowerCase(),
      subject: data.subject || '',
      bodyText: data.text || data.html?.replace(/<[^>]+>/g, ' ') || '',
      bodyHtml: data.html,
      receivedAt: data.created_at ? new Date(data.created_at) : new Date(),
      headers: data.headers || {},
    };
  }
}

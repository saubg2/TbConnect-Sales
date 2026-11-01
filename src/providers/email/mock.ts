import {
  EmailSender,
  EmailInboundAdapter,
  OutboundMessage,
  SendResult,
  InboundEvent,
  InboundMessage,
} from '../types';

export class MockEmailProvider implements EmailSender, EmailInboundAdapter {
  name = 'mock';

  public sentMessages: Array<{
    message: OutboundMessage;
    idempotencyKey: string;
    sentAt: Date;
    providerMessageId: string;
  }> = [];

  private simulateFailure = false;
  private failureReason = 'Mock provider delivery error';

  setSimulateFailure(fail: boolean, reason = 'Mock provider delivery error') {
    this.simulateFailure = fail;
    this.failureReason = reason;
  }

  clear() {
    this.sentMessages = [];
    this.simulateFailure = false;
  }

  async send(message: OutboundMessage, idempotencyKey: string): Promise<SendResult> {
    // Check if duplicate idempotency key was already sent
    const existing = this.sentMessages.find((s) => s.idempotencyKey === idempotencyKey);
    if (existing) {
      return {
        status: 'ACCEPTED',
        providerMessageId: existing.providerMessageId,
      };
    }

    if (this.simulateFailure) {
      return {
        status: 'REJECTED',
        error: this.failureReason,
      };
    }

    const providerMessageId = `mock_msg_${crypto.randomUUID()}`;
    this.sentMessages.push({
      message,
      idempotencyKey,
      sentAt: new Date(),
      providerMessageId,
    });

    return {
      status: 'ACCEPTED',
      providerMessageId,
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<InboundEvent> {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { rawBody };
    }

    return {
      provider: 'mock',
      eventType: payload.type || 'email.received',
      providerEventId: payload.id || `mock_evt_${crypto.randomUUID()}`,
      rawPayload: payload,
    };
  }

  async retrieveMessage(event: InboundEvent): Promise<InboundMessage> {
    const p = event.rawPayload || {};
    return {
      provider: 'mock',
      providerMessageId: p.messageId || event.providerEventId,
      internetMessageId: p.internetMessageId || `<${event.providerEventId}@mock.local>`,
      inReplyTo: p.inReplyTo,
      threadKey: p.threadKey || p.subject || 'thread-default',
      fromEmail: p.fromEmail || p.from || 'test@example.com',
      fromName: p.fromName || 'Test Sender',
      toEmail: p.toEmail || p.to || 'agent@workspace.local',
      subject: p.subject || 'Inquiry',
      bodyText: p.bodyText || p.text || '',
      bodyHtml: p.bodyHtml || p.html,
      receivedAt: p.receivedAt ? new Date(p.receivedAt) : new Date(),
      headers: p.headers || {},
    };
  }
}

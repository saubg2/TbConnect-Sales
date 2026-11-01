import { events } from '@/db/schema';

export interface TelegramConfig {
  botToken?: string;
  appUrl?: string;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramBotService {
  private botToken: string;
  private appUrl: string;

  constructor(config?: TelegramConfig, private db?: any) {
    this.botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.appUrl = config?.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private async callApi(endpoint: string, payload: any) {
    if (!this.botToken) {
      return { ok: false, description: 'Telegram bot token not configured' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`Telegram API error on ${endpoint}:`, data);
        if (this.db) {
          try {
            await this.db.insert(events).values({
              id: crypto.randomUUID(),
              workspaceId: 'ws_default',
              eventType: 'TELEGRAM_API_ERROR',
              payloadJson: { endpoint, payload, response: data },
              createdAt: new Date(),
            });
          } catch {}
        }
      }
      return data;
    } catch (err: any) {
      if (this.db) {
        try {
          await this.db.insert(events).values({
            id: crypto.randomUUID(),
            workspaceId: 'ws_default',
            eventType: 'TELEGRAM_API_ERROR',
            payloadJson: { endpoint, error: err.message },
            createdAt: new Date(),
          });
        } catch {}
      }
      return { ok: false, description: err.message };
    }
  }

  /**
   * Sends an approval alert with inline action buttons to an authorized operator
   */
  async sendApprovalAlert(
    chatId: string,
    params: {
      actionId: string;
      draftVersion: number;
      contactName: string;
      recipientEmail: string;
      subject: string;
      bodyText: string;
      reason: string;
    }
  ) {
    const preview = params.bodyText.length > 300 ? params.bodyText.substring(0, 300) + '...' : params.bodyText;
    const text = `🔔 <b>Approval Required</b>

<b>Contact:</b> ${escapeHtml(params.contactName)} (${escapeHtml(params.recipientEmail)})
<b>Reason:</b> ${escapeHtml(params.reason)}
<b>Draft v${params.draftVersion}:</b>
<b>Subject:</b> ${escapeHtml(params.subject)}

<pre>${escapeHtml(preview)}</pre>`;

    const editUrl = `${this.appUrl}/actions?edit=${params.actionId}`;

    const inlineKeyboard = [
      [
        {
          text: '✅ Approve',
          callback_data: `appr:${params.actionId}:${params.draftVersion}`,
        },
        {
          text: '❌ Reject',
          callback_data: `rejc:${params.actionId}:${params.draftVersion}`,
        },
      ],
      [
        {
          text: '📝 Open in Web to Edit',
          url: editUrl,
        },
      ],
    ];

    return await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  /**
   * Sends an alert when a substantive inbound reply is received
   */
  async sendInboundAlert(
    chatId: string,
    params: {
      fromName: string;
      fromEmail: string;
      subject: string;
      summary: string;
    }
  ) {
    const text = `📥 <b>New Inbound Reply</b>

<b>From:</b> ${escapeHtml(params.fromName)} (${escapeHtml(params.fromEmail)})
<b>Subject:</b> ${escapeHtml(params.subject)}
<b>Summary:</b> ${escapeHtml(params.summary)}`;

    return await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
  }

  /**
   * Responds to inline button press with toast notification
   */
  async answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
    return await this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  /**
   * Updates message inline keyboard to reflect single-use decision state
   */
  async updateMessageStatus(chatId: string, messageId: number, statusText: string) {
    return await this.callApi('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: statusText, callback_data: 'noop' }]],
      },
    });
  }
}

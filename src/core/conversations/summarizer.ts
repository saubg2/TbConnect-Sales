import { Message } from '@/db/schema';

export interface SummarizeResult {
  summary: string;
  facts: string[];
  openQuestions: string[];
}

export class ConversationSummarizer {
  /**
   * Summarizes multi-turn message history deterministically or via model
   */
  static summarize(
    contactName: string,
    existingFacts: string[],
    messagesList: Message[]
  ): SummarizeResult {
    const inboundMessages = messagesList.filter((m) => m.direction === 'INBOUND');
    const outboundMessages = messagesList.filter((m) => m.direction === 'OUTBOUND');

    const facts = [...existingFacts];
    const openQuestions: string[] = [];

    // Extract facts from inbound messages
    for (const msg of inboundMessages) {
      const lower = msg.bodyText.toLowerCase();

      if (
        lower.includes('seats') ||
        lower.includes('team size') ||
        lower.includes('team members') ||
        lower.includes('users')
      ) {
        const match = msg.bodyText.match(/(\d+)\s*(seats|users|team members|people)/i);
        if (match) {
          const fact = `Team size requirement: ${match[1]} ${match[2]}`;
          if (!facts.includes(fact)) facts.push(fact);
        }
      }

      if (lower.includes('budget') || lower.includes('timeline') || lower.includes('evaluating')) {
        const fact = `Evaluating integration capabilities and timeline`;
        if (!facts.includes(fact)) facts.push(fact);
      }
    }

    const latestInbound = inboundMessages[0];
    let summary = `${contactName} is actively engaged (${inboundMessages.length} inbound, ${outboundMessages.length} outbound messages).`;
    if (latestInbound) {
      summary += ` Latest topic: "${latestInbound.subject || 'Direct inquiry'}".`;
    }

    return {
      summary,
      facts,
      openQuestions,
    };
  }
}

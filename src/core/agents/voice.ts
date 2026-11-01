import { MessageDraft } from '@/providers/types';

export interface VoiceRuleViolation {
  rule: string;
  foundText: string;
}

export class VoiceValidator {
  /**
   * Checks draft against agent voice preferences (e.g. avoided phrases) and factual safety
   */
  static validateDraft(
    draft: MessageDraft,
    agentVoice: Record<string, any>,
    agentPermissions: Record<string, any>
  ): { isValid: boolean; violations: VoiceRuleViolation[] } {
    const violations: VoiceRuleViolation[] = [];
    const lowerBody = draft.body_text.toLowerCase();

    // 1. Avoided phrases check
    const avoidedPhrases = (agentVoice.avoidedPhrases as string[]) || [];
    for (const phrase of avoidedPhrases) {
      if (lowerBody.includes(phrase.toLowerCase())) {
        violations.push({
          rule: 'AVOIDED_PHRASE',
          foundText: phrase,
        });
      }
    }

    // 2. Prohibited pricing quotation check
    if (agentPermissions.canQuotePricing === false) {
      const priceIndicators = ['$', '€', '£', 'per seat', '/month', '/year', 'usd', 'eur'];
      for (const indicator of priceIndicators) {
        if (lowerBody.includes(indicator)) {
          violations.push({
            rule: 'UNAUTHORIZED_PRICING_QUOTE',
            foundText: indicator,
          });
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Sanitizes a draft if minor stylistic violations occur, or flags for human approval
   */
  static sanitizeDraft(
    draft: MessageDraft,
    agentVoice: Record<string, any>
  ): MessageDraft {
    let cleanedBody = draft.body_text;
    const avoidedPhrases = (agentVoice.avoidedPhrases as string[]) || [];

    for (const phrase of avoidedPhrases) {
      const regex = new RegExp(`^${phrase}[,.]?\\s*`, 'im');
      cleanedBody = cleanedBody.replace(regex, '');
    }

    return {
      ...draft,
      body_text: cleanedBody.trim(),
    };
  }
}

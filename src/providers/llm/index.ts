import { LLMProvider } from '../types';
import { MockLLMProvider } from './mock';
import { MistralLLMProvider } from './mistral';

export function getLLMProvider(providerName?: string): LLMProvider {
  const selected = providerName || process.env.LLM_PROVIDER || 'mock';

  if (selected === 'mistral') {
    return new MistralLLMProvider();
  }

  // Default to deterministic Mock for zero-dependency tests & safety
  return new MockLLMProvider();
}

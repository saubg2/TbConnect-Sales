import { MockEmailProvider } from './mock';
import { ResendEmailSender } from './resend';
import { EmailSender } from '../types';

export function getEmailProvider(providerName?: string): EmailSender {
  const selected = providerName || process.env.EMAIL_PROVIDER || 'mock';

  if (selected === 'resend') {
    return new ResendEmailSender();
  }

  // Default to deterministic Mock for zero-dependency tests & safety
  return new MockEmailProvider();
}

export { MockEmailProvider, ResendEmailSender };
export const ResendEmailProvider = ResendEmailSender;


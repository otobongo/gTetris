/** What Sign in, Sign up and Settings say for each AuthService result (brief 3.1). */
import type { FailReason, ProviderId } from '../../shared/account';

export interface AuthNotice {
  /** 'soon' is the calm accounts-are-off message; 'error' uses the error look and role=alert. */
  tone: 'soon' | 'error' | 'info';
  title: string;
  body: string;
}

const NAMES: Record<ProviderId, string> = { apple: 'Apple', google: 'Google', facebook: 'Facebook', email: 'Email' };

export const SOON: AuthNotice = {
  tone: 'soon',
  title: 'Family accounts are coming soon.',
  body: "Playing doesn't need an account. Stars, levels and stickers stay on this device.",
};

/** Copy for a failed call. Wrong email and wrong password share one message on purpose. */
export function authNotice(reason: FailReason, provider: ProviderId): AuthNotice {
  switch (reason) {
    case 'not-enabled':
      return SOON;
    case 'offline':
      return { tone: 'info', title: 'No internet connection.', body: 'Connect to sign in. Children can still play on this device.' };
    case 'wrong-credentials':
      return { tone: 'error', title: "That email and password don't match an account.", body: 'Check them, or reset your password.' };
    case 'too-many-tries':
      return { tone: 'error', title: 'Too many tries.', body: 'Wait [PLACEHOLDER: lockout minutes] minutes, or reset your password.' };
    case 'cancelled':
      return { tone: 'info', title: `${NAMES[provider]} sign-in was closed.`, body: 'Try again, or use another way to sign in.' };
    case 'provider-failed':
    case 'unknown':
    default:
      return { tone: 'error', title: `${NAMES[provider]} sign-in didn't finish.`, body: 'Try again, or use another way to sign in.' };
  }
}

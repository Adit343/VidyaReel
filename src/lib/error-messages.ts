const MESSAGES: Record<string, string> = {
  INVITE_ONLY: 'This app is invite-only. Ask an admin to approve your email first.',
  NOT_APPROVED: 'Your access has been removed. Contact an admin.',
  WEAK_PASSWORD: 'Use at least 10 characters for your password.',
  EMAIL_EXISTS: 'An account with this email already exists. Try signing in.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  INVALID_RESET_TOKEN: 'This reset link is invalid or has expired. Request a new one.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have access to that.',
  INVALID_STATE: 'That change is not allowed right now.',
  NOT_FOUND: 'We could not find that.',
  INVALID: 'Something went wrong. Please try again.',
  GOOGLE_NOT_CONFIGURED: 'Google sign-in is not set up yet. Use your email and password.',
  invalid: 'Google sign-in did not complete. Please try again.',
  access_denied: 'Google sign-in was cancelled.',
};

/** Friendly text for an API error code (or a `?error=` value from the Google callback). */
export const friendlyError = (code?: string | null, fallback = MESSAGES.INVALID) => (code && MESSAGES[code]) || fallback;

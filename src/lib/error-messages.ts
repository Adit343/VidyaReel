import type { ErrorCode } from './errors';

/** One plain sentence for every API error code. `Record<ErrorCode, string>` makes a new code fail to compile until it has one. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
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
  VALIDATION: 'Please check what you entered and try again.',
  DAILY_LIMIT: 'You have reached today\'s video limit. It resets at midnight.',
  VOICE_CREDITS_LOW: 'The team\'s monthly narration budget is used up. Ask an admin, or try again next month.',
  UNSAFE_TOPIC: 'That topic is not suitable for a classroom video. Try a different one.',
  VERSION_CONFLICT: 'This video changed in another tab. Reload to see the latest version.',
  STORYBOARD_FAILED: 'We could not write a script for that topic. Try rewording it.',
  PROVIDER_UNAVAILABLE: 'A service we depend on is busy right now. Please try again in a minute.',
  VIDEO_LOCKED: 'This video is being rendered. Wait for it to finish.',
  VIDEO_NOT_POSTABLE: 'This video cannot be posted yet. Finish rendering it first.',
  IG_NOT_ELIGIBLE: 'That Instagram account is not a Business or Creator account. Switch it in Instagram, then connect again.',
  IG_NOT_CONNECTED: 'Connect your Instagram account to post.',
  IG_NEEDS_RECONNECT: 'Your Instagram connection expired. Reconnect it in Settings.',
  ALREADY_POSTED: 'This video was already posted. Confirm to post it again.',
  SCHEDULE_IN_PAST: 'Pick a time in the future.',
};

// Google sign-in sends back a lowercase `?error=` value rather than an API code.
const EXTRA: Record<string, string> = {
  GOOGLE_NOT_CONFIGURED: 'Google sign-in is not set up yet. Use your email and password.',
  invalid: 'Google sign-in did not complete. Please try again.',
  access_denied: 'Google sign-in was cancelled.',
};

/** Friendly text for an API error code (or a `?error=` value from the Google callback). */
export const friendlyError = (code?: string | null, fallback = ERROR_MESSAGES.INVALID) =>
  (code && (ERROR_MESSAGES[code as ErrorCode] ?? EXTRA[code])) || fallback;

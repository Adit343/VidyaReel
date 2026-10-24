export type ErrorCode =
  | 'DAILY_LIMIT' | 'VOICE_CREDITS_LOW' | 'UNSAFE_TOPIC' | 'VERSION_CONFLICT'
  | 'IG_NOT_ELIGIBLE' | 'INVITE_ONLY' | 'NOT_APPROVED' | 'INVALID_CREDENTIALS'
  | 'WEAK_PASSWORD' | 'EMAIL_EXISTS' | 'INVALID_RESET_TOKEN' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'RATE_LIMITED' | 'INVALID_STATE'
  | 'STORYBOARD_FAILED' | 'PROVIDER_UNAVAILABLE' | 'VIDEO_LOCKED';

export class AppError extends Error {
  constructor(
    public code: ErrorCode, message: string, public status = 400, public retryAfter?: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return Response.json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }, {
      status: e.status,
      headers: e.retryAfter ? { 'retry-after': String(e.retryAfter) } : undefined,
    });
  }
  return Response.json({ error: { code: 'INVALID', message: 'Unexpected error' } }, { status: 500 });
}

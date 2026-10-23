export const MIN_PASSWORD_LENGTH = 10;

const COMMON = ['password', '1234567890', 'qwertyuiop', 'iloveyou', 'letmein', 'welcome', 'admin', 'abc123', 'monkey', 'dragon', 'football', 'baseball'];

export type PasswordCheck =
  | { status: 'empty' }
  | { status: 'short' | 'common' | 'email' | 'ok'; level: 1 | 2 | 3 | 4; message: string };

/** Shared by the forms (live feedback) and the server (enforcement). */
export function checkPassword(password: string, email = ''): PasswordCheck {
  if (!password) return { status: 'empty' };
  const lower = password.toLowerCase();
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if ((local.length >= 3 && lower.includes(local)) || (email && lower.includes(email.toLowerCase()))) {
    return { status: 'email', level: 1, message: 'Do not use your email in your password.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: 'short', level: 1, message: `Too short: ${MIN_PASSWORD_LENGTH} characters needed` };
  }
  if (COMMON.some((c) => lower.includes(c))) {
    return { status: 'common', level: 2, message: 'That password is too common. Try a few random words.' };
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  return { status: 'ok', level: password.length >= 14 || variety >= 3 ? 4 : 3, message: 'Looks good' };
}

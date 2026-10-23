import { errorResponse } from '@/lib/errors';
import { AppError } from '@/lib/errors';

// TODO: see docs/API-Design.md
export async function POST(_req: Request) {
  return errorResponse(new AppError('INVALID', 'Not implemented', 501));
}

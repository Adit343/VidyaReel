import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/current-user';

export const dynamic = 'force-dynamic';

// Signed-in users skip the auth pages.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/');
  return children;
}

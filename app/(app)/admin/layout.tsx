import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/current-user';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if ((await getCurrentUser())?.role !== 'admin') redirect('/');
  return children;
}

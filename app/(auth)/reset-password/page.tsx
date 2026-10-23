import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <AuthShell title="Set a new password" subtitle="Choose a password with at least 10 characters.">
      {token ? (
        <AuthForm
          endpoint="/api/auth/reset-password" redirectTo="/sign-in" extra={{ token }} submit="Set new password"
          fields={[{ name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password' }]}
        />
      ) : (
        <p className="alert">This reset link is missing its token. <Link href="/forgot-password">Request a new one</Link>.</p>
      )}
    </AuthShell>
  );
}

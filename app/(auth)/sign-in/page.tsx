import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { GoogleButton } from '@/components/GoogleButton';

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <GoogleButton label="Sign in with Google" />
      <div className="divider">or</div>
      <AuthForm
        endpoint="/api/auth/login" redirectTo="/" submit="Sign in" initialError={error}
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href="/forgot-password">Forgot password?</Link>
        <span className="muted">New here? <Link href="/sign-up">Create an account</Link></span>
      </div>
    </AuthShell>
  );
}

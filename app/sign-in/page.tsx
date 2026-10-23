import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { GoogleButton } from '@/components/GoogleButton';

export default function Page() {
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Sign in</h1>
      <div className="card" style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        <AuthForm endpoint="/api/auth/login" redirectTo="/" submit="Sign in" fields={[{ name: 'email', label: 'Email', type: 'email' }, { name: 'password', label: 'Password', type: 'password' }]} />
        <GoogleButton />
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/sign-up">Create an account</Link>
      </div>
    </main>
  );
}

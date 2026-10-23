import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { GoogleButton } from '@/components/GoogleButton';

export default function Page() {
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Create account</h1>
      <p>Invite-only: your email must be approved by an admin.</p>
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <AuthForm endpoint="/api/auth/signup" redirectTo="/" submit="Create account" fields={[{ name: 'name', label: 'Name' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'password', label: 'Password (10+ characters)', type: 'password' }]} />
        <GoogleButton />
        <Link href="/sign-in">Already have an account?</Link>
      </div>
    </main>
  );
}

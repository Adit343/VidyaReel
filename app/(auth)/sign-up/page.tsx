import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { GoogleButton } from '@/components/GoogleButton';

export default function Page() {
  return (
    <AuthShell title="Create your account" subtitle="Vidyareel is invite-only: your email must be approved by an admin.">
      <GoogleButton label="Sign up with Google" />
      <div className="divider">or</div>
      <AuthForm
        endpoint="/api/auth/signup" redirectTo="/" submit="Create account"
        fields={[
          { name: 'name', label: 'Name', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password (10+ characters)', type: 'password', autoComplete: 'new-password' },
        ]}
      />
      <span className="muted">Already have an account? <Link href="/sign-in">Sign in</Link></span>
    </AuthShell>
  );
}

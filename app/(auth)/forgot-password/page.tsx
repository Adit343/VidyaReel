import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default function Page() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send a reset link if the account exists.">
      <AuthForm
        endpoint="/api/auth/forgot-password" submit="Send reset link"
        doneMessage="If that email is approved, a reset link is on its way. It expires in 30 minutes."
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
      />
      <Link href="/sign-in">Back to sign in</Link>
    </AuthShell>
  );
}

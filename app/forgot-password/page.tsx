import { AuthForm } from '@/components/AuthForm';

export default function Page() {
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Forgot password</h1>
      <div className="card">
        <AuthForm endpoint="/api/auth/forgot-password" submit="Send reset link" fields={[{ name: 'email', label: 'Email', type: 'email' }]} />
      </div>
    </main>
  );
}

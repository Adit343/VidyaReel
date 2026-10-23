import { AuthForm } from '@/components/AuthForm';

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Set a new password</h1>
      <div className="card">
        <AuthForm endpoint="/api/auth/reset-password" redirectTo="/sign-in" extra={{ token }} submit="Set new password" fields={[{ name: 'password', label: 'New password (10+ characters)', type: 'password' }]} />
      </div>
    </main>
  );
}

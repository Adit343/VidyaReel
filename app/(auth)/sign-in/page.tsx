import Link from 'next/link';
import { LoginArt } from '@/components/auth/LoginArt';
import { LoginForm } from '@/components/auth/LoginForm';
import { SplitAuth } from '@/components/auth/layouts';

export const metadata = { title: 'Log in · Vidyareel' };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; email?: string }> }) {
  const { error, reset, email } = await searchParams;
  return (
    <SplitAuth title="Welcome back" subtitle="Log in to pick up where you left off." art={<LoginArt />} spec
      below={<>New here? <Link href="/sign-up" className="ml-1 font-ui-medium font-semibold text-solstice-forest hover:underline">Create an account</Link></>}>
      <LoginForm initialError={error} initialEmail={email?.slice(0, 200)} resetDone={reset === '1'} />
    </SplitAuth>
  );
}

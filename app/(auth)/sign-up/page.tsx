import Link from 'next/link';
import { SignupArt } from '@/components/auth/SignupArt';
import { SignupForm } from '@/components/auth/SignupForm';
import { GoogleButton, OrDivider } from '@/components/auth/primitives';
import { SplitAuth } from '@/components/auth/layouts';

export const metadata = { title: 'Create account · Vidyareel' };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <SplitAuth title="Create your account" subtitle="Turn a lesson idea into a short video in about ten minutes." art={<SignupArt />}
      below={<>Already have an account? <Link href="/sign-in" className="ml-1 font-semibold text-solstice-forest hover:underline">Log in</Link></>}>
      <GoogleButton label="Sign up with Google" />
      <OrDivider />
      <SignupForm initialError={error} />
    </SplitAuth>
  );
}

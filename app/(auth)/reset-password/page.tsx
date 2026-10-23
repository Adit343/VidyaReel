import { ResetForm } from '@/components/auth/ResetForm';
import { CardAuth } from '@/components/auth/layouts';

export const metadata = { title: 'Set a new password · Vidyareel' };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <CardAuth chip="ENCRYPTED CHANNEL">
      <ResetForm token={token} />
    </CardAuth>
  );
}

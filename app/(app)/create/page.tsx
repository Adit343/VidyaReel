import { redirect } from 'next/navigation';
import { CreateClient } from '@/components/create/CreateClient';
import { getAppContext } from '@/server/app-data';

export default async function Page({ searchParams }: { searchParams: Promise<{ topic?: string; voice?: string }> }) {
  // Layouts and pages render in parallel, so the page checks the session itself.
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const { topic, voice } = await searchParams;
  return (
    <CreateClient
      initialTopic={(topic ?? '').slice(0, 500)} voiceId={voice}
      quota={{ used: ctx.quota.used, limit: ctx.quota.limit }}
      tzLabel={ctx.timeZone === 'Asia/Kolkata' ? 'IST' : ctx.timeZone}
    />
  );
}

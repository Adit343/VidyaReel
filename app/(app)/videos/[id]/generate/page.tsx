import { ObjectId } from 'mongodb';
import { notFound, redirect } from 'next/navigation';
import { GenerateClient } from '@/components/generate/GenerateClient';
import { AppError } from '@/lib/errors';
import { getAppContext } from '@/server/app-data';
import { getRenderStatus } from '@/server/render/jobs';
import { getVideo } from '@/server/videos/service';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const { id } = await params;
  const userId = new ObjectId(ctx.user.id);
  const [video, status] = await Promise.all([getVideo(userId, id), getRenderStatus(userId, id)]).catch((e) => {
    if (e instanceof AppError && e.status === 404) return [null, null] as const;
    throw e;
  });
  if (!video || !status) notFound();
  return <GenerateClient initialVideo={video} initialStatus={status} autoStart={(await searchParams).start === '1'} />;
}

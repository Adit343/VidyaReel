import { ObjectId } from 'mongodb';
import { notFound, redirect } from 'next/navigation';
import { ReviewClient } from '@/components/review/ReviewClient';
import { AppError } from '@/lib/errors';
import { getAppContext } from '@/server/app-data';
import { getVideo } from '@/server/videos/service';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Layouts and pages render in parallel, so the page checks the session itself.
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const video = await getVideo(new ObjectId(ctx.user.id), (await params).id).catch((e) => {
    if (e instanceof AppError && e.status === 404) return null;
    throw e;
  });
  if (!video) notFound();
  return <ReviewClient initial={video} />;
}

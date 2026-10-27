import { notFound, redirect } from 'next/navigation';
import { PostClient } from '@/components/post/PostClient';
import { AppError } from '@/lib/errors';
import { getAppContext } from '@/server/app-data';
import { getConnection } from '@/server/instagram/connection';
import { latestPost } from '@/server/posts/service';
import { mediaLinks } from '@/server/render/jobs';
import { loadOwned } from '@/server/videos/service';
import { toVideoView } from '@/server/videos/view';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ig?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const { id } = await params;
  const doc = await loadOwned(ctx.userId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) return null;
    throw e;
  });
  if (!doc) notFound();
  // Posting is Step 4: a video that is not finished goes back to the step it is on.
  if (doc.status === 'draft' || doc.status === 'storyboard_ready') redirect(`/videos/${id}/review`);
  if (doc.status === 'rendering' || doc.status === 'failed') redirect(`/videos/${id}/generate`);

  const [{ connection }, post, media] = await Promise.all([
    getConnection(ctx.userId), latestPost(ctx.userId, doc._id), mediaLinks(doc).catch(() => null),
  ]);
  return (
    <PostClient
      initialVideo={toVideoView(doc)} initialMedia={media} initialConnection={connection} initialPost={post}
      timeZone={ctx.timeZone} flag={(await searchParams).ig ?? null}
    />
  );
}

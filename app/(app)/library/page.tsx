import { redirect } from 'next/navigation';
import { LibraryClient } from '@/components/library/LibraryClient';
import { getAppContext } from '@/server/app-data';
import { listVideos } from '@/server/videos/list';

export default async function Page() {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  return <LibraryClient videos={await listVideos(ctx.userId)} timeZone={ctx.timeZone} />;
}

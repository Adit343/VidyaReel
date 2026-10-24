import { ComingSoon } from '@/components/shell/ComingSoon';

export default async function Page({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const topic = (await searchParams).topic?.slice(0, 800);
  return (
    <ComingSoon icon="movie_edit" title="Script and storyboard drafting is coming next" text="This step turns your idea into an editable script and storyboard. It is the next thing being built.">
      {topic && (
        <p className="font-code-xs text-code-xs text-[#0F2A20] bg-[#EEF1EC] border border-[#D3DBD0] rounded-xl p-3 mb-6 text-left break-words">
          <span className="text-[#54675D]">Your idea:</span> {topic}
        </p>
      )}
    </ComingSoon>
  );
}

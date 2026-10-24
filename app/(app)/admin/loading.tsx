export default function Loading() {
  return (
    <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6" aria-busy="true" aria-label="Loading members">
      <div className="pb-6 border-b border-[#D3DBD0] flex items-end justify-between">
        <div className="space-y-3"><div className="h-3 w-48 shimmer-sage rounded" /><div className="h-12 w-40 shimmer-sage rounded" /></div>
        <div className="h-11 w-72 shimmer-sage rounded-xl" />
      </div>
      <div className="flex gap-3"><div className="h-10 flex-1 max-w-sm shimmer-sage rounded-xl" /><div className="h-10 w-64 shimmer-sage rounded-xl" /></div>
      <div className="bg-white border border-[#D3DBD0] rounded-2xl overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[#D3DBD0] last:border-0">
            <div className="w-8 h-8 rounded-full shimmer-sage" />
            <div className="space-y-2 flex-1"><div className="h-3.5 w-40 shimmer-sage rounded" /><div className="h-3 w-56 shimmer-sage rounded" /></div>
            <div className="h-6 w-20 shimmer-sage rounded-lg" /><div className="h-6 w-24 shimmer-sage rounded-lg" /><div className="h-5 w-16 shimmer-sage rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}

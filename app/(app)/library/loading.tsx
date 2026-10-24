/** Loading skeletons (Stitch Library state 2): sage shimmer cards with 9:16 plates. */
export default function Loading() {
  return (
    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-0 py-6 md:py-10" aria-busy="true" aria-label="Loading your library">
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[40px] leading-[44px] font-headline-lg font-bold text-[#0F2A20] tracking-[-0.03em]">Library</h1>
          <div className="h-7 w-20 shimmer-sage rounded-full" />
        </div>
        <div className="h-10 w-36 shimmer-sage rounded-[12px]" />
      </div>
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="h-10 w-full lg:w-72 shimmer-sage rounded-[12px]" />
        <div className="h-8 w-80 shimmer-sage rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-white rounded-[16px] border border-[#D3DBD0] p-4 flex flex-col justify-between h-[390px]">
            <div>
              <div className="w-full aspect-[9/16] max-h-[220px] rounded-[12px] shimmer-sage mb-3.5" />
              <div className={`h-5 shimmer-sage rounded mb-2 ${i % 2 ? 'w-3/4' : 'w-4/5'}`} />
              <div className={`h-3 shimmer-sage rounded mb-3 ${i % 2 ? 'w-1/2' : 'w-3/5'}`} />
            </div>
            <div className="pt-3 border-t border-[#EEF1EC] flex justify-between items-center">
              <div className="h-5 w-20 shimmer-sage rounded-full" />
              <div className="h-6 w-6 shimmer-sage rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

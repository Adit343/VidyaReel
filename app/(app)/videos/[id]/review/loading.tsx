/** Review skeleton (Stitch "Loading Skeleton" state). */
export default function Loading() {
  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8" aria-busy="true" aria-label="Loading your storyboard">
      <div className="h-6 w-full rounded shimmer-sage mb-8" />
      <div className="h-9 w-72 rounded shimmer-sage mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          {[0, 1, 2].map((k) => (
            <div key={k} className="bg-white rounded-2xl border border-[#D3DBD0] p-5 space-y-4">
              <div className="h-4 w-32 rounded shimmer-sage" />
              <div className="flex gap-4">
                <div className="w-[90px] h-[160px] rounded-xl shimmer-sage shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-full rounded shimmer-sage" /><div className="h-4 w-4/5 rounded shimmer-sage" /><div className="h-4 w-3/4 rounded shimmer-sage" />
                  <div className="h-8 w-48 rounded-full shimmer-sage mt-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-4 h-[520px] rounded-3xl bg-white border border-[#D3DBD0] shimmer-sage" />
      </div>
    </div>
  );
}

/** Home loading state (Stitch Dashboard state 3): hero shell plus four skeleton cards. */
export default function Loading() {
  return (
    <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 sm:px-6 md:px-0 py-6 md:py-8 space-y-6 md:space-y-8" aria-busy="true" aria-label="Loading your studio">
      <div className="bg-white rounded-[24px] border border-[#D3DBD0] p-5 sm:p-8 hero-atelier-shadow skeleton-shimmer space-y-4">
        <div className="w-60 h-3 bg-[#EEF1EC] rounded" />
        <div className="w-4/5 h-9 bg-[#DCE3D9] rounded" />
        <div className="w-3/5 h-4 bg-[#EEF1EC] rounded" />
        <div className="w-full h-24 bg-[#F4F6F2] rounded-xl border border-[#D3DBD0]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[0, 1].map((i) => <div key={i} className="bg-white rounded-[16px] border border-[#D3DBD0] h-40 skeleton-shimmer" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[16px] border border-[#D3DBD0] p-4 flex flex-col justify-between space-y-4 skeleton-shimmer">
            <div className="space-y-3">
              <div className="w-full aspect-[16/9] rounded-xl bg-[#DCE3D9]" />
              <div className="w-24 h-3 bg-[#EEF1EC] rounded" />
              <div className="w-4/5 h-4 bg-[#DCE3D9] rounded" />
            </div>
            <div className="pt-3 border-t border-[#EEF1EC] flex justify-between items-center">
              <div className="w-16 h-3 bg-[#EEF1EC] rounded" />
              <div className="w-14 h-6 bg-[#DCE3D9] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

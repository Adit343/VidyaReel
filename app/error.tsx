'use client';

/** 500 canvas from the Stitch shared components. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#EEF1EC] flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border border-[#D3DBD0] p-10 text-center max-w-md w-full">
        <div className="w-12 h-12 rounded-full bg-[#FFDAD6]/60 text-[#C93A2E] mx-auto flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[26px]">sync_problem</span>
        </div>
        <h1 className="font-headline-md text-headline-md text-[#0F2A20]">Something went wrong.</h1>
        <p className="font-body-md text-body-md text-[#54675D] mt-2 mb-6">Refresh the page, or try again in a minute.</p>
        <button onClick={reset} className="btn-lift inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#145A41] text-white font-ui-medium text-ui-medium hover:bg-[#0F4632]">
          <span className="material-symbols-outlined text-[18px]">refresh</span> Reload workspace
        </button>
      </div>
    </main>
  );
}

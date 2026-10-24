import Link from 'next/link';

/** 404 canvas from the Stitch shared components. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#EEF1EC] flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border border-[#D3DBD0] p-10 text-center max-w-md w-full">
        <span className="inline-block font-code-xs text-code-xs uppercase tracking-wider bg-[#EEF1EC] border border-[#D3DBD0] rounded-full px-3 py-1 text-[#0F2A20]">Error code 404</span>
        <h1 className="font-headline-md text-headline-md text-[#0F2A20] mt-4">404 · Page not found</h1>
        <p className="font-body-md text-body-md text-[#54675D] mt-2 mb-6">We could not find that page.</p>
        <Link href="/" className="btn-lift inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#145A41] text-white font-ui-medium text-ui-medium hover:bg-[#0F4632]">
          Back to home <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}

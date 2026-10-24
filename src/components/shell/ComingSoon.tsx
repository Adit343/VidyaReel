import Link from 'next/link';

/** Empty-state panel (Stitch shared components, section 10) for screens that arrive in a later phase. */
export function ComingSoon({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-0 py-10 md:py-16">
      <div className="w-full rounded-[24px] border-2 border-dashed border-[#B9C5B5] bg-white p-10 md:p-14 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#E1E7DF] border border-[#D3DBD0] mx-auto flex items-center justify-center text-[#145A41] mb-5">
          <span className="material-symbols-outlined text-[32px]">{icon}</span>
        </div>
        <h1 className="font-headline-md text-headline-md text-[#0F2A20] mb-2 tracking-tight">{title}</h1>
        <p className="font-body-md text-body-md text-[#54675D] max-w-md mx-auto mb-6">{text}</p>
        {children}
        <Link href="/" className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-[12px] bg-[#145A41] text-white font-ui-medium text-ui-medium hover:bg-[#0F4632]">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Create</span>
        </Link>
      </div>
    </main>
  );
}

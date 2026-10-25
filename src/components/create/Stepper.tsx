const STEPS = ['Idea', 'Review', 'Generate', 'Post'] as const;

/**
 * The 4-step indicator. Stitch draws it two ways: "dots" on Step 1 (thin line, small dots) and "line" on Step 2
 * (check circles joined by lines, current ring); both are kept so each screen matches its design.
 */
export function Stepper({ current, variant }: { current: 1 | 2 | 3 | 4; variant: 'dots' | 'line' | 'stack' }) {
  if (variant === 'stack') {
    // Step 3 (Generate) draws a narrow centred stepper with the label under each circle.
    return (
      <div className="flex items-center justify-between max-w-xl mx-auto relative" aria-label="Creation progress">
        <div className="absolute left-3 right-3 top-2.5 h-[1.5px] bg-[#B9C5B5] -z-0" />
        {STEPS.map((label, i) => {
          const now = i + 1 === current;
          const done = i + 1 < current;
          return (
            <div key={label} className={`flex flex-col items-center gap-1.5 z-10 bg-[#EEF1EC] px-2 ${!now && !done ? 'opacity-60' : ''}`} aria-current={now ? 'step' : undefined}>
              {done ? (
                <div className="w-5 h-5 rounded-full bg-[#145A41] text-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[13px] leading-none">check</span>
                </div>
              ) : now ? (
                <div className="w-5 h-5 rounded-full bg-white border-2 border-[#145A41] flex items-center justify-center shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#145A41]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#EEF1EC] border border-[#B9C5B5] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B9C5B5]" />
                </div>
              )}
              <span className={`text-xs ${now ? 'font-semibold text-[#145A41] font-code-sm' : 'font-medium text-[#54675D]'}`}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (variant === 'dots') {
    return (
      <div className="w-full mb-8" aria-label="Creation progress">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-3 right-3 top-[7px] -translate-y-1/2 h-[1.5px] bg-[#D3DBD0] z-0" />
          {STEPS.map((label, i) => {
            const now = i + 1 === current;
            const done = i + 1 < current;
            return (
              <div key={label} className="relative z-10 flex flex-col items-center" aria-current={now ? 'step' : undefined}>
                {now ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-[#145A41] ring-4 ring-[#EEF1EC] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-[#EEF1EC] ${done ? 'bg-[#145A41]' : 'bg-[#B9C5B5]'}`} />
                )}
                <span className={`mt-2 font-code-sm text-[11px] tracking-tight ${now ? 'text-[#145A41] font-semibold' : 'text-[#54675D]'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between w-full relative" aria-label="Creation progress">
      {STEPS.map((label, i) => {
        const now = i + 1 === current;
        const done = i + 1 < current;
        return (
          <div key={label} className="contents">
            <div className={`flex items-center gap-2 ${!now && !done ? 'text-[#54675D] opacity-70' : ''}`} aria-current={now ? 'step' : undefined}>
              {done ? (
                <div className="w-5 h-5 rounded-full bg-[#145A41] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                </div>
              ) : now ? (
                <div className="w-5 h-5 rounded-full border-2 border-[#145A41] flex items-center justify-center bg-white">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#145A41]" />
                </div>
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-[#B9C5B5] mx-1" />
              )}
              <span className={`font-ui-regular text-body-sm ${now ? 'text-[#145A41] font-bold' : 'text-[#54675D]'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-[2px] mx-3 ${done ? 'bg-[#145A41]' : 'bg-[#D3DBD0]'}`} />}
          </div>
        );
      })}
    </div>
  );
}

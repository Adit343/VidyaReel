// Ported from the Stitch "Sign-Up" screen (right-hand art panel).
export function SignupArt() {
  return (
<section className="lg:col-span-6 flex items-center justify-center">
<div className="w-full h-full min-h-[580px] lg:min-h-[640px] rounded-[24px] bg-[#145A41] border border-[#0F4632] relative overflow-hidden p-8 lg:p-10 flex flex-col justify-between text-white shadow-xl">

<div className="absolute inset-0 pointer-events-none opacity-20">
<svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
<defs>
<pattern height="36" id="atelier-grid" patternUnits="userSpaceOnUse" width="36">
<path d="M 36 0 L 0 0 0 36" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="0.75"/>
</pattern>
</defs>
<rect fill="url(#atelier-grid)" height="100%" width="100%"/>
</svg>
</div>

<div className="relative z-10 flex items-center justify-between">
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
<span className="w-2 h-2 rounded-full bg-[#FF9F1C]"></span>
<span className="font-code-xs text-[11px] tracking-wide text-white uppercase">Lesson-to-Reel v2.4</span>
</div>
<div className="flex items-center gap-2 text-white/70 font-code-xs text-xs">
<span className="material-symbols-outlined text-[16px]">auto_videocam</span>
<span>60s Explainer</span>
</div>
</div>

<div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center">

<div className="absolute -top-6 w-72 h-72 rounded-full border border-dashed border-white/20 pointer-events-none flex items-center justify-center">
<div className="w-56 h-56 rounded-full border border-white/10"></div>

<div className="absolute top-4 right-8 flex items-center gap-1">
<span className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C] shadow-[0_0_12px_#FF9F1C]"></span>
<span className="font-code-xs text-[9px] text-[#FF9F1C] tracking-widest uppercase">Solar Angle 23.5°</span>
</div>
</div>

<svg className="absolute -bottom-8 -left-4 w-28 h-28 text-[#92d4b4]/20 pointer-events-none rotate-12" fill="currentColor" viewBox="0 0 100 100">
<path d="M10 80 Q 50 10 90 20 Q 80 70 10 80 Z"/>
<path d="M10 80 Q 45 45 90 20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
</svg>

<div className="tilted-preview w-64 rounded-[20px] bg-[#FFFFFF] p-3 text-[#0F2A20] shadow-[0_20px_40px_rgba(0,0,0,0.35)] border border-[#D3DBD0] relative">

<div className="w-full aspect-[9/13] rounded-[14px] bg-[#0F2A20] relative overflow-hidden flex flex-col justify-between p-3.5 border border-[#1b352b]">

<div className="flex items-center justify-between text-white/80">
<div className="flex items-center gap-1.5">
<span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]"></span>
<span className="font-code-xs text-[10px] tracking-tight uppercase">Earth Systems</span>
</div>
<span className="font-code-xs text-[10px] bg-white/15 px-1.5 py-0.5 rounded text-white font-medium">Auto-Scripted</span>
</div>

<div className="my-auto flex flex-col items-center justify-center relative py-2">

<div className="relative w-24 h-24 rounded-full border border-emerald-300/40 bg-gradient-to-tr from-[#052017] via-[#145A41] to-[#286a50] flex items-center justify-center overflow-hidden">

<div className="absolute w-[120%] h-[1px] bg-white/40 rotate-[23.5deg]"></div>

<div className="w-full h-8 border-y border-white/20 rounded-full scale-y-50"></div>

<div className="absolute inset-0 rounded-full shadow-[inset_0_0_8px_rgba(173,241,208,0.3)]"></div>
</div>
<span className="font-code-xs text-[9px] text-[#adf1d0] mt-2.5 tracking-tight text-center">
                    Axial Tilt: Solstice Vector
                  </span>
</div>

<div className="bg-black/50 backdrop-blur-md rounded-[10px] p-2.5 border border-white/10">
<div className="flex items-center justify-between text-white mb-1">
<p className="font-headline-sm text-[13px] font-bold tracking-tight leading-tight">
                      Why seasons happen
                    </p>
<span className="material-symbols-outlined text-[16px] text-[#FF9F1C]">play_circle</span>
</div>

<p className="font-ui-regular text-[11px] text-white/80 leading-snug line-clamp-2">
                    &ldquo;It’s not distance from the sun—it’s the directness of solar rays...&rdquo;
                  </p>

<div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 font-code-xs text-[10px] text-white/60">
<span>0:21 / 0:58</span>
<span className="text-[#adf1d0] flex items-center gap-1 font-medium">
<span className="w-1 h-2 bg-[#adf1d0] rounded-xs animate-pulse"></span>
                      IG Reel 1080p
                    </span>
</div>
</div>
</div>

<div className="mt-2.5 flex items-center justify-between px-1">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-[#1A8F5A]"></span>
<span className="font-ui-medium text-[11px] text-[#0F2A20]">Render Ready</span>
</div>
<span className="font-code-xs text-[10px] text-[#54675D]">Instagram Sync</span>
</div>
</div>
</div>

<div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-white/80">
<span className="font-code-xs text-[11px] tracking-wide">
              Pedagogical video engine · Lesson to reel
            </span>
<div className="flex items-center gap-1 text-[11px] font-code-xs text-white/60">
<span className="material-symbols-outlined text-[14px] text-[#adf1d0]">verified</span>
<span>Invite-only beta</span>
</div>
</div>
</div>
</section>
  );
}

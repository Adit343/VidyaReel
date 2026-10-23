// Ported from the Stitch "Log In" screen (right-hand art panel).
export function LoginArt() {
  return (
<section className="lg:col-span-6 bg-solstice-forest rounded-3xl p-8 lg:p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-2xl">

<div className="absolute -top-12 -right-12 w-64 h-64 opacity-5 pointer-events-none">
<svg className="w-full h-full fill-white" viewBox="0 0 100 100">
<path d="M50 0 C20 30 20 70 50 100 C80 70 80 30 50 0 Z"/>
</svg>
</div>
<div className="absolute -bottom-16 -left-12 w-72 h-72 opacity-5 pointer-events-none rotate-45">
<svg className="w-full h-full fill-white" viewBox="0 0 100 100">
<path d="M50 0 C20 30 20 70 50 100 C80 70 80 30 50 0 Z"/>
</svg>
</div>

<div className="relative z-10 flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-martian bg-white/10 text-white border border-white/15">
<span className="w-1.5 h-1.5 rounded-full bg-solstice-saffron mr-1.5"></span>
              GRADE 6 EARTH SCIENCE
            </span>
</div>
<span className="font-martian text-[11px] text-white/60 tracking-wider">LESSON #804</span>
</div>

<div className="relative my-6 py-4 flex flex-col items-center justify-center">

<div className="w-full max-w-[480px] h-[340px] relative rounded-2xl bg-[#0e3f2d]/60 border border-white/10 p-4 overflow-hidden">
<svg className="w-full h-full" fill="none" viewBox="0 0 460 300" xmlns="http://www.w3.org/2000/svg">

<g className="transition-transform duration-700 hover:scale-105">
<circle cx="390" cy="55" fill="#FF9F1C" fillOpacity="0.2" r="32"/>
<circle cx="390" cy="55" fill="#FF9F1C" r="22"/>

<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2.5" x1="390" x2="390" y1="20" y2="12"/>
<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2.5" x1="390" x2="390" y1="90" y2="98"/>
<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2.5" x1="355" x2="347" y1="55" y2="55"/>
<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2.5" x1="425" x2="433" y1="55" y2="55"/>
<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2" x1="365" x2="359" y1="30" y2="24"/>
<line stroke="#FF9F1C" strokeLinecap="round" strokeWidth="2" x1="415" x2="421" y1="80" y2="86"/>
</g>

<g className="opacity-95">
<path d="M80 85 C70 85 60 93 60 103 C60 113 70 120 80 120 L160 120 C172 120 182 110 182 98 C182 86 172 76 160 76 C158 76 156 76 154 77 C148 64 135 55 120 55 C102 55 88 68 85 85 Z" fill="#EEF1EC" fillOpacity="0.85"/>

<g stroke="#92D4B4" strokeLinecap="round" strokeWidth="2">
<line x1="75" x2="70" y1="135" y2="148"/>
<line x1="95" x2="90" y1="138" y2="152"/>
<line x1="115" x2="110" y1="135" y2="149"/>
<line x1="135" x2="130" y1="140" y2="154"/>
<line x1="155" x2="150" y1="136" y2="150"/>
</g>
</g>

<g stroke="#FF9F1C" strokeDasharray="3 3" strokeWidth="2">
<path d="M330 220 Q 345 170 335 120"/>
<path d="M360 215 Q 375 165 365 115"/>
<path d="M300 225 Q 315 175 305 130"/>
</g>

<polygon fill="#FF9F1C" points="335,115 330,123 340,123"/>
<polygon fill="#FF9F1C" points="365,110 360,118 370,118"/>
<polygon fill="#FF9F1C" points="305,125 300,133 310,133"/>

<path d="M0 240 L70 170 L140 210 L230 145 L320 230 L460 230 L460 300 L0 300 Z" fill="#1b523c"/>

<path d="M260 250 C320 240 380 240 460 255 L460 300 L260 300 Z" fill="#146d50"/>

<line opacity="0.6" stroke="#92D4B4" strokeLinecap="round" strokeWidth="1.5" x1="290" x2="350" y1="265" y2="265"/>
<line opacity="0.6" stroke="#92D4B4" strokeLinecap="round" strokeWidth="1.5" x1="370" x2="430" y1="272" y2="272"/>

<path d="M140 210 Q 180 230 265 255" fill="none" stroke="#92D4B4" strokeWidth="2.5"/>

<rect fill="#082218" fillOpacity="0.85" height="20" rx="4" width="94" x="50" y="162"/>
<text fill="#92D4B4" fontFamily="Martian Mono" fontSize="9" fontWeight="500" x="56" y="176">PRECIPITATION</text>
<rect fill="#082218" fillOpacity="0.85" height="20" rx="4" width="108" x="150" y="222"/>
<text fill="#92D4B4" fontFamily="Martian Mono" fontSize="9" fontWeight="500" x="156" y="236">SURFACE RUNOFF</text>
<rect fill="#082218" fillOpacity="0.85" height="20" rx="4" width="144" x="290" y="85"/>
<text fill="#FF9F1C" fontFamily="Martian Mono" fontSize="8.5" fontWeight="500" x="296" y="99">EVAPORATION / TRANSPIR</text>
</svg>
</div>

<div className="absolute -bottom-4 right-4 sm:right-10 w-[190px] h-[280px] rounded-2xl bg-[#091a13]/90 border border-white/20 p-3.5 shadow-2xl backdrop-blur-md transform rotate-3 hover:rotate-0 transition-transform duration-300 flex flex-col justify-between">

<div>
<div className="flex items-center justify-between mb-2">
<span className="font-martian text-[8px] bg-solstice-saffron/20 text-solstice-saffron border border-solstice-saffron/40 px-1.5 py-0.5 rounded">9:16 REEL</span>
<span className="w-2 h-2 rounded-full bg-solstice-saffron animate-ping"></span>
</div>
<div className="font-display font-bold text-[13px] text-white leading-snug">
                How the water cycle works
              </div>
<div className="text-[10px] text-white/60 font-body-sm mt-0.5">
                Automated 60s micro-lecture
              </div>
</div>

<div className="w-full h-24 rounded-lg bg-[#0F2A20] border border-white/10 relative flex items-center justify-center overflow-hidden group/thumb cursor-pointer">

<div className="absolute inset-0 bg-gradient-to-tr from-solstice-forest to-transparent opacity-60"></div>

<div className="w-9 h-9 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white backdrop-blur-sm group-hover/thumb:scale-110 transition-transform">
<svg className="w-4 h-4 fill-current ml-0.5 text-white" viewBox="0 0 24 24">
<path d="M8 5v14l11-7z"/>
</svg>
</div>

<div className="absolute bottom-1.5 left-2 font-martian text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded">
                0:34 / 1:02
              </div>
</div>

<div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-martian text-white/70">
<span>SYNC: VOCAL</span>
<span className="text-solstice-saffron">IG READY</span>
</div>
</div>
</div>

<div className="relative z-10 pt-4 border-t border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
<p className="font-martian text-[11px] text-white/80 tracking-wide">
            Pedagogical video engine · Lesson to reel in minutes
          </p>
<span className="inline-flex items-center gap-1 font-martian text-[10px] text-solstice-saffron">
<span className="material-symbols-outlined text-[14px]">auto_awesome</span> 60s ENGINE
          </span>
</div>
</section>
  );
}

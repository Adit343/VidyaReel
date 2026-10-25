'use client';
import { useEffect, useRef, useState } from 'react';
import { clock } from '@/lib/time';

/**
 * The 9:16 player card of Stitch "Step 3: Generate" (Ready state): big play button, gradient seek bar, time,
 * mute and fullscreen over the real video. The captions are part of the picture, so there is no CC switch.
 * `onExpired` runs when the signed link stops working so the screen can ask for a fresh one.
 */
export function VideoPlayer({ src, poster, onExpired }: { src: string; poster: string | null; onExpired: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);

  useEffect(() => { setPlaying(false); setTime(0); }, [src]);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    const el = video.current;
    if (!el || !length) return;
    if ('clientX' in e) {
      const r = e.currentTarget.getBoundingClientRect();
      el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * length;
    } else if (e.key === 'ArrowRight') el.currentTime = Math.min(length, el.currentTime + 5);
    else if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 5);
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="w-full max-w-[340px] bg-white rounded-[24px] border border-[#D3DBD0] p-3.5 shadow-[0_4px_20px_-2px_rgba(20,90,65,0.06),0_2px_6px_-1px_rgba(20,90,65,0.04)]">
      <div ref={box} className="relative w-full aspect-[9/16] rounded-2xl bg-[#0F2A20] overflow-hidden shadow-inner">
        <video
          ref={video} src={src} poster={poster ?? undefined} playsInline preload="metadata" aria-label="Your finished video"
          className="absolute inset-0 w-full h-full object-contain bg-[#0F2A20]"
          onClick={toggle}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
          onError={onExpired}
        />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 backdrop-blur-md text-[10px] font-code-sm text-white/90 border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />vidyareel · 1080p
        </div>
        {!playing && (
          <button
            type="button" onClick={toggle} aria-label="Play video"
            className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-[#145A41]/90 hover:bg-[#145A41] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#145A41]"
          >
            <span className="material-symbols-outlined text-[32px] translate-x-0.5">play_arrow</span>
          </button>
        )}
        <div className="absolute z-10 left-3 right-3 bottom-3 flex flex-col gap-1.5">
          <div
            role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(length)} aria-valuenow={Math.round(time)}
            onClick={seek} onKeyDown={seek}
            className="w-full h-3 flex items-center cursor-pointer group"
          >
            <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#145A41] to-[#FF9F1C] rounded-full" style={{ width: `${length ? (time / length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-code-sm text-white/90">
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="hover:text-[#FF9F1C] transition-colors">
                <span className="material-symbols-outlined text-[16px]">{playing ? 'pause' : 'play_arrow'}</span>
              </button>
              <span>{clock(Math.floor(time))} / {clock(Math.round(length))}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <button
                type="button" aria-label={muted ? 'Unmute' : 'Mute'} className="hover:text-white"
                onClick={() => { const el = video.current; if (el) { el.muted = !el.muted; setMuted(el.muted); } }}
              >
                <span className="material-symbols-outlined text-[15px]">{muted ? 'volume_off' : 'volume_up'}</span>
              </button>
              <button type="button" aria-label="Fullscreen" className="hover:text-white" onClick={fullscreen}>
                <span className="material-symbols-outlined text-[15px]">fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center pt-3 pb-1">
        <span className="text-[11px] font-code-sm text-[#54675D]">Click the screen or the play button to hear the voiceover</span>
      </div>
    </div>
  );
}

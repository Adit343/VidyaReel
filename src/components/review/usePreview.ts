'use client';
import { useEffect, useRef, useState } from 'react';

type SampleState = { id: string; phase: 'loading' | 'playing' } | null;

/** One preview at a time (a voice sample or a music track): starting another stops the first. A preview that cannot load marks its button unavailable. */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<SampleState>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const stop = () => { audio.current?.pause(); audio.current = null; setState(null); };
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = (id: string, url: string) => {
    if (state?.id === id) return stop();
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    setState({ id, phase: 'loading' });
    const fail = () => { if (audio.current === a) { stop(); setFailed((f) => [...f, id]); } };
    a.onplaying = () => setState({ id, phase: 'playing' });
    a.onended = () => { if (audio.current === a) stop(); };
    a.onerror = fail;
    a.play().catch(fail);
  };
  return { state, failed, toggle, stop };
}

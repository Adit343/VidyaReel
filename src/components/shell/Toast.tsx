'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const Ctx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

/** Banner toasts from the Stitch shared components: green success, red error, dismissible, 4 s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = (id: number) => setItems((t) => t.filter((x) => x.id !== id));
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, kind, text }]);
    setTimeout(() => dismiss(id), 4000);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md grid gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px] overlay-ambient-shadow ${
              t.kind === 'success' ? 'bg-[#E9F7F0] border-[#BFE3D0] text-[#0F2A20]' : 'bg-[#FBEEEC] border-[#F3CFCB] text-[#C93A2E]'
            }`}
          >
            <span className={`material-symbols-outlined fill-icon text-[20px] ${t.kind === 'success' ? 'text-[#1A8F5A]' : 'text-[#C93A2E]'}`}>
              {t.kind === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="flex-1">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-[#54675D] hover:text-[#0F2A20]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

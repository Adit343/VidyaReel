'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = { value: string; label: string; hint?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** field: full-width form field. compact: small bordered chip (tables, toolbars). bare: text only, for use inside a pill. */
  variant?: 'field' | 'compact' | 'bare';
  /** Extra classes for the button, for example a width. */
  className?: string;
  placeholder?: string;
  /** Which edge the menu lines up with when it is wider than the button. */
  menuAlign?: 'left' | 'right';
};

const TRIGGER = {
  field: 'w-full rounded-[12px] border border-[#D3DBD0] bg-white px-3.5 py-2 text-[14px] text-[#0F2A20] hover:border-[#B9C5B5]',
  compact: 'rounded-lg border border-[#D3DBD0] bg-white px-2.5 py-1.5 text-xs font-ui-medium text-[#0F2A20] hover:border-[#B9C5B5] hover:bg-[#EEF1EC]',
  bare: 'rounded-md text-xs font-ui-medium text-[#0F2A20]',
} as const;

type Pos = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/**
 * A listbox dropdown in the Solstice style (replaces the browser's native select). The menu is drawn on the page
 * body, so a table or card with hidden overflow cannot clip it, and it opens upward when there is no room below.
 * Keyboard: arrows, Home, End, Enter, Escape, and the first letter of an option.
 */
export function Select({ value, onChange, options, id, ariaLabel, disabled, variant = 'field', className = '', placeholder, menuAlign = 'left' }: Props) {
  const uid = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);

  const selected = options.findIndex((o) => o.value === value);
  const current = options[selected];

  const close = useCallback(() => setOpen(false), []);
  const openMenu = () => { if (disabled || !options.length) return; setActive(Math.max(0, selected)); setOpen(true); };
  const choose = (i: number) => { const o = options[i]; if (o) onChange(o.value); close(); button.current?.focus(); };

  // Place the menu next to the button, above it when the space below is too small.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = Math.max(r.width, variant === 'field' ? r.width : 190);
    const left = Math.max(8, Math.min(menuAlign === 'right' ? r.right - width : r.left, window.innerWidth - width - 8));
    const want = Math.min(280, options.length * 44 + 12);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    if (below >= want || below >= above) setPos({ top: r.bottom + 6, left, width, maxHeight: Math.max(120, Math.min(280, below)) });
    else setPos({ bottom: window.innerHeight - r.top + 6, left, width, maxHeight: Math.max(120, Math.min(280, above)) });
  }, [open, options.length, variant, menuAlign]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) close();
    };
    const scrolled = (e: Event) => { if (!list.current?.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', away);
    window.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') close();
    else if (e.key.length === 1) {
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const any = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (any >= 0) setActive(any);
    }
  };

  return (
    <>
      <button
        ref={button} id={id} type="button" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${uid}-list` : undefined}
        aria-label={ariaLabel} aria-activedescendant={open ? `${uid}-${active}` : undefined}
        onClick={() => (open ? close() : openMenu())} onKeyDown={onKeyDown}
        className={`inline-flex min-w-0 items-center justify-between gap-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#145A41]/25 disabled:cursor-not-allowed disabled:opacity-60 ${TRIGGER[variant]} ${open && variant !== 'bare' ? 'border-[#145A41] ring-2 ring-[#145A41]/10' : ''} ${className}`}
      >
        <span className={`truncate ${current ? '' : 'text-[#54675D]'}`}>{current?.label ?? placeholder ?? 'Select'}</span>
        <span className={`material-symbols-outlined shrink-0 text-[#54675D] transition-transform duration-150 ${variant === 'field' ? 'text-[20px]' : 'text-[16px]'} ${open ? 'rotate-180' : ''}`} aria-hidden>expand_more</span>
      </button>
      {open && pos && createPortal(
        <ul
          ref={list} id={`${uid}-list`} role="listbox" aria-label={ariaLabel}
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="z-[100] overflow-y-auto rounded-xl border border-[#B9C5B5] bg-white p-1.5 shadow-[0_8px_24px_-4px_rgba(15,42,32,0.12)] animate-fade-in"
        >
          {options.map((o, i) => {
            const on = i === selected;
            return (
              <li
                key={o.value} id={`${uid}-${i}`} data-i={i} role="option" aria-selected={on}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? 'bg-[#E1E7DF]' : ''}`}
              >
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] leading-5 text-[#0F2A20] ${on ? 'font-semibold' : ''}`}>{o.label}</span>
                  {o.hint && <span className="block truncate text-[11px] leading-4 text-[#54675D]">{o.hint}</span>}
                </span>
                {on && <span className="material-symbols-outlined shrink-0 text-[18px] text-[#145A41]" aria-hidden>check</span>}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}

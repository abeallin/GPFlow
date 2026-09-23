'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { announce } from './LiveAnnouncer';

/**
 * One toast stack, mounted once (docs/ui-rules.md §7).
 * Success and info toasts last at least 6s and pause while hovered or focused.
 * Error toasts stay until closed. Every toast is also announced.
 */
export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

const SUCCESS_MS = 6000;
const MAX_VISIBLE = 5;

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(input: ToastInput): void {
  const item: ToastItem = { ...input, id: nextId++ };
  announce(input.message ? `${input.title}. ${input.message}` : input.title, input.tone === 'error' ? 'assertive' : 'polite');
  for (const l of listeners) l(item);
}

export function ToastStack() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setItems((prev) => [...prev, t]);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <section
      aria-label="Notifications"
      data-toast-stack
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))] pointer-events-none"
    >
      {items.slice(-MAX_VISIBLE).map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </section>
  );
}

const tones: Record<ToastTone, { Icon: typeof Info; accent: string; bar: string }> = {
  success: { Icon: CheckCircle, accent: 'text-accent', bar: 'border-l-accent' },
  error: { Icon: AlertTriangle, accent: 'text-error-text', bar: 'border-l-error' },
  info: { Icon: Info, accent: 'text-info', bar: 'border-l-info' },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const sticky = item.tone === 'error';
  const remaining = useRef(SUCCESS_MS);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  const resume = useCallback(() => {
    if (sticky || timer.current != null) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismissRef.current(), remaining.current);
  }, [sticky]);

  const pause = useCallback(() => {
    if (timer.current == null) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);

  useEffect(() => {
    resume();
    return () => { if (timer.current != null) clearTimeout(timer.current); };
  }, [resume]);

  const { Icon, accent, bar } = tones[item.tone];

  return (
    <div
      role={sticky ? 'alert' : 'status'}
      data-toast
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-border border-l-4 ${bar} bg-bg-raised px-4 py-3 shadow-[var(--shadow-md)]`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${accent}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{item.title}</p>
        {item.message && <p className="text-xs text-text-secondary mt-0.5">{item.message}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="shrink-0 -m-1 p-1 rounded-md text-text-muted hover:text-text-primary min-w-6 min-h-6"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

/**
 * One place for "that worked" to be heard (docs/ui-rules.md §7).
 * A module-level bus: click handlers and IPC callbacks call `announce()` and the single
 * mounted `LiveAnnouncer` speaks it. Polite for successes; assertive only where carrying on
 * under the old assumption would do harm.
 */
export type Politeness = 'polite' | 'assertive';
type Listener = (message: string, politeness: Politeness) => void;

const listeners = new Set<Listener>();

export function announce(message: string, politeness: Politeness = 'polite'): void {
  if (!message) return;
  for (const l of listeners) l(message, politeness);
}

export function LiveAnnouncer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const listener: Listener = (message, politeness) => {
      // Clear, then set a moment later, so the same message twice is announced twice.
      const set = politeness === 'assertive' ? setAssertive : setPolite;
      set('');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => set(message), 60);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{polite}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{assertive}</div>
    </>
  );
}

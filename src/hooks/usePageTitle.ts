'use client';

import { useEffect } from 'react';

/** Every route sets a unique document title (docs/ui-rules.md §8). */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · GP Flow`;
  }, [title]);
}

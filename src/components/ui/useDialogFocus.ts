'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Everything `role="dialog"` does not do (docs/ui-rules.md §5):
 *   1. focus moves into the dialog on open (to `initialFocus` if given)
 *   2. Escape closes it
 *   3. Tab and Shift+Tab wrap inside it
 *   4. focus returns to whatever opened it, unless something moved it on purpose
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose?: () => void,
  initialFocus?: string,
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    const preferred = initialFocus ? node.querySelector<HTMLElement>(initialFocus) : null;
    const first = preferred ?? focusable()[0];
    if (first) first.focus();
    else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      } else if (e.shiftKey && (active === firstItem || active === node)) {
        e.preventDefault();
        lastItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (opener && (!document.activeElement || document.activeElement === document.body || node.contains(document.activeElement))) {
        opener.focus();
      }
    };
  }, [ref, onClose, initialFocus]);
}

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/data',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: null }));

import { AppShell } from '@/components/AppShell';

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

describe('AppShell (docs/ui-rules.md §8)', () => {
  it('starts with a skip link that targets a focusable main', () => {
    render(<AppShell pathname="/data"><p>content</p></AppShell>);
    const first = document.body.querySelector('a, button, [tabindex]') as HTMLElement;
    expect(first).toHaveTextContent(/skip to main content/i);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
    fireEvent.click(first);
    expect(document.activeElement).toBe(main);
  });

  it('names icon-only controls with aria-label, never title', () => {
    render(<AppShell pathname="/data"><p>content</p></AppShell>);
    const toggle = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggle).not.toHaveAttribute('title');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^data$/i })).not.toHaveAttribute('title');
  });

  it('clicking the page background does not collapse the sidebar', () => {
    render(<AppShell pathname="/data"><p>content</p></AppShell>);
    fireEvent.click(screen.getByRole('main'));
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeTruthy();
    expect(localStorage.getItem('sidebar_collapsed')).not.toBe('true');
  });

  it('marks the current page with aria-current', () => {
    render(<AppShell pathname="/data"><p>content</p></AppShell>);
    expect(screen.getByRole('link', { name: /^data$/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /^runs$/i })).not.toHaveAttribute('aria-current');
  });

  it('mounts the notification stack and live regions once', () => {
    render(<AppShell pathname="/data"><p>content</p></AppShell>);
    expect(screen.getByRole('region', { name: /notifications/i })).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

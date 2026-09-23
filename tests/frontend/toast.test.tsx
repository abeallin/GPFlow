// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastStack, toast } from '@/components/ui/Toast';
import { LiveAnnouncer, announce } from '@/components/ui/LiveAnnouncer';

describe('toasts (docs/ui-rules.md §7)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a success toast stays at least 6 seconds and pauses while hovered', () => {
    render(<ToastStack />);
    act(() => { toast({ tone: 'success', title: 'Run started' }); });
    const item = screen.getByText('Run started');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Run started')).not.toBeNull();

    fireEvent.mouseEnter(item.closest('[data-toast]')!);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.queryByText('Run started')).not.toBeNull();

    fireEvent.mouseLeave(item.closest('[data-toast]')!);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText('Run started')).toBeNull();
  });

  it('an error toast never auto-dismisses and has a close button', () => {
    render(<ToastStack />);
    act(() => { toast({ tone: 'error', title: 'Run failed', message: 'Login failed: bad password' }); });
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByRole('alert')).toHaveTextContent(/Run failed/);
    fireEvent.click(screen.getByRole('button', { name: /close notification/i }));
    expect(screen.queryByText('Run failed')).toBeNull();
  });

  it('the stack is a stable live region; at most five toasts show', () => {
    render(<ToastStack />);
    expect(screen.getByRole('region', { name: /notifications/i })).toBeTruthy();
    act(() => { for (let i = 0; i < 7; i++) toast({ tone: 'info', title: `T${i}` }); });
    expect(screen.getAllByText(/^T\d$/)).toHaveLength(5);
  });
});

describe('announcements', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('polite and assertive regions exist once and repeat the same message twice', () => {
    render(<LiveAnnouncer />);
    const polite = screen.getByRole('status');
    const assertive = screen.getByRole('alert');
    act(() => { announce('Run complete'); vi.advanceTimersByTime(100); });
    expect(polite).toHaveTextContent('Run complete');
    act(() => { announce('Run complete'); });
    expect(polite).toHaveTextContent('');
    act(() => { vi.advanceTimersByTime(100); });
    expect(polite).toHaveTextContent('Run complete');
    act(() => { announce('Login failed', 'assertive'); vi.advanceTimersByTime(100); });
    expect(assertive).toHaveTextContent('Login failed');
  });
});

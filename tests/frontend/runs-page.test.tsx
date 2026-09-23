// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import type { ProgressEvent, RunCompleteEvent, RunErrorEvent, TwoFactorEvent } from '@/lib/ipc-client';

const { push, ipcFake, handlers } = vi.hoisted(() => {
  const handlers: {
    progress?: (e: unknown) => void;
    twoFactor?: (e: unknown) => void;
    complete?: (e: unknown) => void;
    error?: (e: unknown) => void;
  } = {};
  return {
    push: vi.fn(),
    handlers,
    ipcFake: {
      getActiveRuns: vi.fn(),
      getRuns: vi.fn(),
      stopRun: vi.fn(),
      stopAllRuns: vi.fn(),
      retryFailed: vi.fn(),
      onProgress: vi.fn((cb: (e: unknown) => void) => { handlers.progress = cb; }),
      on2faRequired: vi.fn((cb: (e: unknown) => void) => { handlers.twoFactor = cb; }),
      onRunComplete: vi.fn((cb: (e: unknown) => void) => { handlers.complete = cb; }),
      onRunError: vi.fn((cb: (e: unknown) => void) => { handlers.error = cb; }),
      removeAllListeners: vi.fn(),
    },
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/runs',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: ipcFake }));

import RunsPage from '@/app/runs/page';

function progress(runId: number, step: number, total: number, accountLabel = `acct${runId}`): ProgressEvent {
  return { runId, step, total, practice: `P${step}`, status: 'success', accountLabel, timestamp: new Date().toISOString() };
}
const twoFactor = (runId: number): TwoFactorEvent => ({ runId, accountLabel: `acct${runId}` });
const runError = (runId: number, error: string): RunErrorEvent => ({ runId, accountLabel: `acct${runId}`, error });
const complete = (runId: number): RunCompleteEvent => ({
  runId, accountLabel: `acct${runId}`, summary: { totalCount: 1, successCount: 1, failCount: 0, duration: 1 },
});

beforeEach(() => {
  push.mockReset();
  ipcFake.getActiveRuns.mockReset().mockResolvedValue([{ runId: 1, accountLabel: 'acct1' }]);
  ipcFake.getRuns.mockReset().mockResolvedValue([]);
  ipcFake.stopRun.mockReset().mockResolvedValue(undefined);
  ipcFake.stopAllRuns.mockReset().mockResolvedValue(undefined);
  delete handlers.progress; delete handlers.twoFactor; delete handlers.complete; delete handlers.error;
});
afterEach(cleanup);

describe('RunsPage', () => {
  it('(a) clicking Stop calls stopRun with the active run id, and Stop all calls stopAllRuns', async () => {
    render(<RunsPage />);
    const stop = await screen.findByRole('button', { name: /^stop acct1$/i });
    fireEvent.click(stop);
    expect(ipcFake.stopRun).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /stop all/i }));
    expect(ipcFake.stopAllRuns).toHaveBeenCalled();
  });

  it('(b) the 2FA banner appears on the 2fa event and disappears after progress for that run', async () => {
    render(<RunsPage />);
    await waitFor(() => expect(handlers.twoFactor).toBeTypeOf('function'));

    act(() => handlers.twoFactor!(twoFactor(1)));
    expect(await screen.findByText(/two-factor authentication required/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();

    act(() => handlers.progress!(progress(1, 1, 10)));
    await waitFor(() => expect(screen.queryByText(/two-factor authentication required/i)).toBeNull());
  });

  it('(c) two runs render two bars whose counts do not mix', async () => {
    render(<RunsPage />);
    await waitFor(() => expect(handlers.progress).toBeTypeOf('function'));

    act(() => {
      handlers.progress!(progress(1, 1, 10));
      handlers.progress!(progress(2, 1, 5));
      handlers.progress!(progress(1, 2, 10));
      handlers.progress!(progress(1, 3, 10));
      handlers.progress!(progress(2, 2, 5));
    });

    expect(await screen.findByText('3 / 10')).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
    expect(screen.queryByText('5 / 5')).toBeNull();
    expect(screen.queryByText('5 / 10')).toBeNull();
  });

  it('(d) a run-error event is displayed and the run leaves the active list', async () => {
    render(<RunsPage />);
    await screen.findByRole('button', { name: /^stop acct1$/i });
    await waitFor(() => expect(handlers.error).toBeTypeOf('function'));

    act(() => handlers.error!(runError(1, 'Login failed: bad password')));

    expect(await screen.findByText(/login failed: bad password/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^stop acct1$/i })).toBeNull());
  });

  it('(e) a completed run leaves the active list', async () => {
    render(<RunsPage />);
    await screen.findByRole('button', { name: /^stop acct1$/i });
    act(() => handlers.complete!(complete(1)));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^stop acct1$/i })).toBeNull());
    expect(await screen.findByText(/run complete/i)).toBeTruthy();
  });
});

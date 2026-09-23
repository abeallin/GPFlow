// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const { push, ipcFake } = vi.hoisted(() => ({
  push: vi.fn(),
  ipcFake: { getRuns: vi.fn(), retryFailed: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/runs',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: ipcFake }));

import { RunHistory } from '@/components/RunHistory';

beforeEach(() => {
  push.mockReset();
  ipcFake.getRuns.mockReset();
  ipcFake.retryFailed.mockReset();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('RunHistory', () => {
  it('clears loading and shows an error when getRuns rejects', async () => {
    ipcFake.getRuns.mockRejectedValue(new Error('db locked'));
    render(<RunHistory />);
    await waitFor(() => expect(screen.getByText(/db locked/)).toBeTruthy());
  });

  it('Retry writes the practice ids and navigates to /templates', async () => {
    ipcFake.getRuns.mockResolvedValue([
      { id: 7, started_at: new Date().toISOString(), type: 'create', success_count: 1, fail_count: 2, status: 'completed' },
    ]);
    ipcFake.retryFailed.mockResolvedValue({ practiceIds: [11, 12] });
    render(<RunHistory />);

    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates'));
    expect(ipcFake.retryFailed).toHaveBeenCalledWith(7);
    expect(JSON.parse(sessionStorage.getItem('selectedPracticeIds')!)).toEqual([11, 12]);
  });

  it('shows an error when retryFailed rejects', async () => {
    ipcFake.getRuns.mockResolvedValue([
      { id: 7, started_at: new Date().toISOString(), type: 'create', success_count: 1, fail_count: 2, status: 'completed' },
    ]);
    ipcFake.retryFailed.mockRejectedValue(new Error('retry exploded'));
    render(<RunHistory />);
    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/retry exploded/)).toBeTruthy());
    expect(push).not.toHaveBeenCalled();
  });
});

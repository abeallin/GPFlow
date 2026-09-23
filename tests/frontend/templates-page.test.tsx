// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const { push, ipcFake } = vi.hoisted(() => ({
  push: vi.fn(),
  ipcFake: {
    startRun: vi.fn(),
    getCredentials: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/templates',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: ipcFake }));

import TemplatesPage from '@/app/templates/page';

const accounts = [
  { id: 'acc1', label: 'one', username: 'one@nhs.net' },
  { id: 'acc2', label: 'two', username: 'two@nhs.net' },
];
const practices = [
  { id: 1, name: 'Alpha', accurx_id: 'X1', source_file: 'a.csv' },
  { id: 2, name: 'Beta', accurx_id: 'X2', source_file: 'b.csv' },
];

function seed(opts: { assignments?: Record<string, string>; selected?: number[] } = {}) {
  localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
  localStorage.setItem('gpflow_practices', JSON.stringify(practices));
  localStorage.setItem('gpflow_assignments', JSON.stringify(
    opts.assignments ?? { 'a.csv::X1': 'acc1', 'b.csv::X2': 'acc2' },
  ));
  sessionStorage.setItem('selectedPracticeIds', JSON.stringify(opts.selected ?? [1, 2]));
}

async function submitCreate() {
  const nameInput = await screen.findByPlaceholderText(/enter template name/i);
  fireEvent.change(nameInput, { target: { value: 'Flu 2026' } });
  fireEvent.change(screen.getByPlaceholderText(/enter the template message/i), { target: { value: 'Hello' } });
  const button = screen.getByRole('button', { name: /bulk create template/i });
  fireEvent.click(button);
  return button as HTMLButtonElement;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  push.mockReset();
  ipcFake.startRun.mockReset();
  ipcFake.getCredentials.mockReset();
  ipcFake.getCredentials.mockResolvedValue({ username: 'u', password: 'pw', licenseKey: '' });
});
afterEach(cleanup);

describe('TemplatesPage run start', () => {
  it('(a) starts a run for every account concurrently, before any of them resolves', async () => {
    seed();
    ipcFake.startRun.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    const button = await submitCreate();

    await waitFor(() => expect(ipcFake.startRun).toHaveBeenCalledTimes(2));
    expect(button.disabled).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('(b) refuses to start with no assigned practices and shows an error', async () => {
    seed({ assignments: {} });
    render(<TemplatesPage />);
    await screen.findByText(/unassigned: 2/i);

    await submitCreate();

    await waitFor(() => expect(screen.getByText(/no assigned practices/i)).toBeTruthy());
    expect(ipcFake.startRun).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('(c) shows a rejected startRun reason and still navigates when another succeeds', async () => {
    seed();
    ipcFake.startRun
      .mockRejectedValueOnce(new Error('browser launch failed'))
      .mockResolvedValueOnce({ runId: 42 });
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    await submitCreate();

    await waitFor(() => expect(screen.getByText(/browser launch failed/)).toBeTruthy());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/runs'));
  });

  it('(c2) does not navigate when every startRun rejects', async () => {
    seed();
    ipcFake.startRun.mockRejectedValue(new Error('nope'));
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    await submitCreate();

    await waitFor(() => expect(screen.getAllByText(/nope/).length).toBeGreaterThan(0));
    expect(push).not.toHaveBeenCalled();
  });

  it('(d) sends full practice records and the account label in each payload', async () => {
    seed();
    ipcFake.startRun.mockResolvedValue({ runId: 1 });
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    await submitCreate();

    await waitFor(() => expect(ipcFake.startRun).toHaveBeenCalledTimes(2));
    const payloads = ipcFake.startRun.mock.calls.map((c) => c[0]);
    const one = payloads.find((p) => p.accountLabel === 'one');
    const two = payloads.find((p) => p.accountLabel === 'two');
    expect(one).toBeTruthy();
    expect(two).toBeTruthy();
    expect(one.practices).toEqual([{ id: 1, name: 'Alpha', accurx_id: 'X1' }]);
    expect(two.practices).toEqual([{ id: 2, name: 'Beta', accurx_id: 'X2' }]);
    expect(one.credentials).toEqual({ username: 'one@nhs.net', password: 'pw' });
    expect(one.type).toBe('create');
    expect(one.templateConfig.template_name).toBe('Flu 2026');
    expect(one).not.toHaveProperty('practiceIds');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/runs'));
  });

  it('(e) refuses to start when an account has no stored password', async () => {
    seed();
    ipcFake.getCredentials.mockResolvedValue(null);
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    await submitCreate();

    await waitFor(() => expect(screen.getByText(/password/i)).toBeTruthy());
    expect(ipcFake.startRun).not.toHaveBeenCalled();
  });
});

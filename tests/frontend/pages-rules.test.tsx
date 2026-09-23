// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

const { push, ipcFake } = vi.hoisted(() => ({
  push: vi.fn(),
  ipcFake: {
    startRun: vi.fn(),
    getCredentials: vi.fn(),
    getPractices: vi.fn(),
    clearPractices: vi.fn(),
    onPracticesUpdated: vi.fn(),
    removeAllListeners: vi.fn(),
    getRuns: vi.fn(),
    getActiveRuns: vi.fn(),
    stopRun: vi.fn(),
    stopAllRuns: vi.fn(),
    retryFailed: vi.fn(),
    deleteCredentials: vi.fn(),
    onProgress: vi.fn(),
    on2faRequired: vi.fn(),
    onRunComplete: vi.fn(),
    onRunError: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/templates',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: ipcFake }));

import TemplatesPage from '@/app/templates/page';
import DataPage from '@/app/data/page';
import RunsPage from '@/app/runs/page';
import { LoginForm } from '@/components/LoginForm';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';

const accounts = [
  { id: 'acc1', label: 'one', username: 'one@nhs.net' },
  { id: 'acc2', label: 'two', username: 'two@nhs.net' },
];
const practices = [
  { id: 1, name: 'Alpha', accurx_id: 'X1', source_file: 'a.csv' },
  { id: 2, name: 'Beta', accurx_id: 'X2', source_file: 'b.csv' },
];

function seedTemplates() {
  localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
  localStorage.setItem('gpflow_practices', JSON.stringify(practices));
  localStorage.setItem('gpflow_assignments', JSON.stringify({ 'a.csv::X1': 'acc1', 'b.csv::X2': 'acc2' }));
  sessionStorage.setItem('selectedPracticeIds', JSON.stringify([1, 2]));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  push.mockReset();
  for (const fn of Object.values(ipcFake)) fn.mockReset();
  ipcFake.getCredentials.mockResolvedValue({ username: 'u', password: 'pw', licenseKey: '' });
  ipcFake.startRun.mockResolvedValue({ runId: 1 });
  ipcFake.getPractices.mockResolvedValue([]);
  ipcFake.getRuns.mockResolvedValue([]);
  ipcFake.getActiveRuns.mockResolvedValue([]);
  ipcFake.clearPractices.mockResolvedValue(undefined);
  ipcFake.deleteCredentials.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Templates page: bulk actions confirm (docs/ui-rules.md §5)', () => {
  it('bulk delete opens a confirmation naming the template and the count; nothing starts until confirmed', async () => {
    seedTemplates();
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);

    fireEvent.click(screen.getByRole('tab', { name: /delete template/i }));
    const panel = screen.getByRole('tabpanel', { name: /delete template/i });
    fireEvent.change(within(panel).getByLabelText(/template name/i), { target: { value: 'Flu 2024' } });
    fireEvent.click(within(panel).getByRole('button', { name: /bulk delete template/i }));

    const dialog = await screen.findByRole('alertdialog', { name: /delete 'flu 2024' from 2 practices\?/i });
    expect(ipcFake.startRun).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /delete on 2 practices/i }));
    await waitFor(() => expect(ipcFake.startRun).toHaveBeenCalledTimes(2));
  });

  it('cancel closes the dialog without starting anything', async () => {
    seedTemplates();
    render(<TemplatesPage />);
    await screen.findByText(/one: 1/);
    fireEvent.change(screen.getByLabelText(/template name/i, { selector: 'input:not([hidden] *)' }), { target: { value: 'Flu' } });
    fireEvent.change(screen.getByLabelText(/message body/i), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /bulk create template/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(ipcFake.startRun).not.toHaveBeenCalled();
  });

  it('sets the document title', async () => {
    seedTemplates();
    render(<TemplatesPage />);
    await waitFor(() => expect(document.title).toBe('Templates · GP Flow'));
  });
});

describe('Data page: unknown is not empty; destructive actions confirm', () => {
  it('renders a load error with Retry (not the empty state) when practices cannot be loaded', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
    ipcFake.getPractices.mockRejectedValueOnce(new Error('database is locked')).mockResolvedValueOnce([]);
    render(<DataPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn't load practices/i);
    expect(screen.queryByText(/no practices loaded/i)).toBeNull();

    fireEvent.click(within(alert).getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(ipcFake.getPractices).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('Continue states why it is unavailable instead of fading', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
    ipcFake.getPractices.mockResolvedValue(practices);
    render(<DataPage />);
    const btn = await screen.findByRole('button', { name: /continue/i });
    expect(btn).not.toHaveAttribute('disabled');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/select at least one assigned practice/i)).toBeTruthy();
    fireEvent.click(btn);
    expect(push).not.toHaveBeenCalled();
  });

  it('Clear all asks first and only clears on confirm', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
    ipcFake.getPractices.mockResolvedValue(practices);
    render(<DataPage />);
    await screen.findByText('Alpha');

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    const dialog = await screen.findByRole('alertdialog', { name: /remove all 2 practices\?/i });
    expect(ipcFake.clearPractices).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /remove 2 practices/i }));
    await waitFor(() => expect(ipcFake.clearPractices).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
  });
});

describe('Login form: removing an account confirms', () => {
  it('opens a dialog naming the account and removes only on confirm', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify([{ id: 'acc1', label: 'admin', username: 'admin@nhs.net' }]));
    render(<LoginForm onSuccess={() => {}} />);
    await screen.findByText('admin@nhs.net');

    fireEvent.click(screen.getByRole('button', { name: /remove account admin/i }));
    const dialog = await screen.findByRole('alertdialog', { name: /remove admin@nhs\.net\?/i });
    expect(JSON.parse(localStorage.getItem('gpflow_accounts')!)).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /remove account/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gpflow_accounts')!)).toHaveLength(0));
    expect(ipcFake.deleteCredentials).toHaveBeenCalledWith('acc1');
  });
});

describe('DataTable semantics', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, accurx_id: `X${i + 1}`, source_file: 'a.csv' }));

  it('sortable headers contain a button and the th carries aria-sort', () => {
    render(<DataTable practices={rows} selectedIds={[]} onSelectionChange={() => {}} />);
    const th = screen.getByRole('columnheader', { name: /^name/i });
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    const btn = within(th).getByRole('button', { name: /name/i });
    fireEvent.click(btn);
    expect(screen.getByRole('columnheader', { name: /^name/i })).toHaveAttribute('aria-sort', 'descending');
  });

  it('the Previous button on page 1 stays focusable and is aria-disabled', () => {
    render(<DataTable practices={rows} selectedIds={[]} onSelectionChange={() => {}} />);
    const prev = screen.getByRole('button', { name: /previous page/i });
    expect(prev).not.toHaveAttribute('disabled');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(prev);
    expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();
  });
});

describe('CsvImporter drop zone is a real control', () => {
  it('is a button with an accessible name', () => {
    render(<CsvImporter onImported={() => {}} onParsedWeb={() => {}} />);
    expect(screen.getByRole('button', { name: /choose csv files/i })).toBeTruthy();
  });
});

describe('Runs page: a zero is a claim', () => {
  it('shows dashes until run history has loaded', async () => {
    ipcFake.getRuns.mockImplementation(() => new Promise(() => {}));
    render(<RunsPage />);
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3));
    expect(screen.queryByText('Never')).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/data',
}));
// Web mode: no Electron bridge.
vi.mock('@/lib/ipc-client', () => ({ ipc: null }));

import DataPage from '@/app/data/page';

const accounts = [
  { id: 'acc1', label: 'one', username: 'one@nhs.net' },
  { id: 'acc2', label: 'two', username: 'two@nhs.net' },
];

function csvFile(name: string, text: string): File {
  return new File([text], name, { type: 'text/csv' });
}

async function drop(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

function fileRow(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`remove file ${name.replace('.', '\\.')}`, 'i') })
    .closest('li') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  push.mockReset();
  localStorage.setItem('gpflow_accounts', JSON.stringify(accounts));
});
afterEach(cleanup);

describe('DataPage assignments', () => {
  it('keeps the same accurx_id in two files on two accounts and counts assigned rows', async () => {
    localStorage.setItem('gpflow_practices', JSON.stringify([
      { id: 1, name: 'Same', accurx_id: 'X1', source_file: 'a.csv' },
      { id: 2, name: 'Same', accurx_id: 'X1', source_file: 'b.csv' },
      { id: 3, name: 'Other', accurx_id: 'X2', source_file: 'b.csv' },
    ]));
    localStorage.setItem('gpflow_uploaded_files', JSON.stringify([
      { fileName: 'a.csv', practiceCount: 1, accountId: null },
      { fileName: 'b.csv', practiceCount: 2, accountId: null },
    ]));

    render(<DataPage />);
    await screen.findByRole('button', { name: /remove file a\.csv/i });

    // Assign a.csv → one, b.csv → two via the per-file account buttons.
    fireEvent.click(within(fileRow('a.csv')).getByRole('button', { name: 'one' }));
    fireEvent.click(within(fileRow('b.csv')).getByRole('button', { name: 'two' }));

    // Stat counts rows (3), not unique accurx_ids (2).
    await waitFor(() => expect(screen.getByText('3/3')).toBeTruthy());

    const stored = JSON.parse(localStorage.getItem('gpflow_assignments')!);
    expect(stored).toEqual({ 'a.csv::X1': 'acc1', 'b.csv::X1': 'acc2', 'b.csv::X2': 'acc2' });

    // Per-account tab counts come from rows too.
    expect(screen.getByRole('button', { name: /one \(1\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /two \(2\)/ })).toBeTruthy();

    // Account column resolves each row's account from the composite key.
    const tbody = document.querySelector('tbody')!;
    expect(within(tbody).getAllByText('one')).toHaveLength(1);
    expect(within(tbody).getAllByText('two')).toHaveLength(2);
  });

  it('allocates non-overlapping ids across two consecutive drops', async () => {
    render(<DataPage />);
    await screen.findByText(/drop csv files or click to browse/i);

    await drop([csvFile('a.csv', 'accurx_id,name\nA1,Alpha\nA2,Beta\n')]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gpflow_practices')!)).toHaveLength(2));

    await drop([csvFile('b.csv', 'accurx_id,name\nB1,Gamma\nB2,Delta\n')]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gpflow_practices')!)).toHaveLength(4));

    const ids = JSON.parse(localStorage.getItem('gpflow_practices')!).map((p: { id: number }) => p.id);
    expect(new Set(ids).size).toBe(4);
    expect(localStorage.getItem('gpflow_next_practice_id')).toBe('5');
  });

  it('survives corrupt localStorage without blanking the page', async () => {
    localStorage.setItem('gpflow_practices', '{corrupt');
    localStorage.setItem('gpflow_assignments', '[1,2]');
    localStorage.setItem('gpflow_uploaded_files', 'nope');
    render(<DataPage />);
    expect(await screen.findByText(/no practices loaded/i)).toBeTruthy();
  });
});

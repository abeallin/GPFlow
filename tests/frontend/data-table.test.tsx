// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { DataTable } from '@/components/DataTable';

afterEach(cleanup);

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Practice ${String(i + 1).padStart(3, '0')}`,
    accurx_id: `X${i + 1}`,
    source_file: 'a.csv',
  }));
}

function bodyRows() {
  const tbody = document.querySelector('tbody')!;
  return within(tbody).getAllByRole('row');
}

function headerCheckbox(): HTMLInputElement {
  const thead = document.querySelector('thead')!;
  return within(thead).getByRole('checkbox') as HTMLInputElement;
}

describe('DataTable pagination', () => {
  it('renders 50 of 120 rows, shows "Page 1 of 3", and Next shows the next 50', () => {
    render(<DataTable practices={makeRows(120)} selectedIds={[]} onSelectionChange={() => {}} />);

    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
    expect(screen.getByText('Practice 001')).toBeTruthy();
    expect(screen.queryByText('Practice 051')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(/Page 2 of 3/)).toBeTruthy();
    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText('Practice 051')).toBeTruthy();
    expect(screen.getByText('Practice 100')).toBeTruthy();
    expect(screen.queryByText('Practice 001')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
  });
});

describe('DataTable header checkbox', () => {
  const rows = [
    { id: 1, name: 'Alpha 1', accurx_id: 'A1', source_file: 'a.csv' },
    { id: 2, name: 'Alpha 2', accurx_id: 'A2', source_file: 'a.csv' },
    { id: 3, name: 'Alpha 3', accurx_id: 'A3', source_file: 'a.csv' },
    { id: 4, name: 'Beta 1', accurx_id: 'B1', source_file: 'a.csv' },
    { id: 5, name: 'Beta 2', accurx_id: 'B2', source_file: 'a.csv' },
  ];

  it('reflects visible rows, not the global selection count', () => {
    // Two rows selected globally, and the filter shows two rows — none of which are selected.
    render(<DataTable practices={rows} selectedIds={[1, 2]} onSelectionChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Beta' } });
    expect(bodyRows()).toHaveLength(2);
    expect(headerCheckbox().checked).toBe(false);

    // 2 of 3 visible rows selected → still unchecked.
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Alpha' } });
    expect(bodyRows()).toHaveLength(3);
    expect(headerCheckbox().checked).toBe(false);
  });

  it('is checked when every visible row is selected', () => {
    render(<DataTable practices={rows} selectedIds={[4, 5]} onSelectionChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Beta' } });
    expect(headerCheckbox().checked).toBe(true);
  });

  it('select-all on a filtered view adds only the visible rows and keeps existing selections', () => {
    const onSelectionChange = vi.fn();
    render(<DataTable practices={rows} selectedIds={[1]} onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Beta' } });
    fireEvent.click(headerCheckbox());

    const last = onSelectionChange.mock.calls.at(-1)![0] as number[];
    expect([...last].sort()).toEqual([1, 4, 5]);
  });

  it('unselect-all on a filtered view removes only the visible rows', () => {
    const onSelectionChange = vi.fn();
    render(<DataTable practices={rows} selectedIds={[1, 4, 5]} onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Beta' } });
    expect(headerCheckbox().checked).toBe(true);
    fireEvent.click(headerCheckbox());

    const last = onSelectionChange.mock.calls.at(-1)![0] as number[];
    expect(last).toEqual([1]);
  });
});

describe('DataTable account column', () => {
  it('resolves the account from the composite key, not accurx_id alone', () => {
    const accounts = [
      { id: 'acc1', label: 'one', username: 'one@nhs.net' },
      { id: 'acc2', label: 'two', username: 'two@nhs.net' },
    ];
    const practices = [
      { id: 1, name: 'Same', accurx_id: 'X1', source_file: 'a.csv' },
      { id: 2, name: 'Same', accurx_id: 'X1', source_file: 'b.csv' },
    ];
    const assignments = { 'a.csv::X1': 'acc1', 'b.csv::X1': 'acc2' };
    render(
      <DataTable practices={practices} selectedIds={[]} onSelectionChange={() => {}} assignments={assignments} accounts={accounts} />,
    );
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
  });
});

'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from './ui/Input';
import type { Account } from '@/lib/accounts';
import { assignedAccountId, type Assignments, type PracticeLike } from '@/lib/assignments';

type Practice = PracticeLike;

interface DataTableProps {
  practices: Practice[];
  selectedIds?: number[];
  onSelectionChange: (ids: number[]) => void;
  /** Keyed by composite practice key `${source_file}::${accurx_id}`. */
  assignments?: Assignments;
  accounts?: Account[];
}

const PAGE_SIZE = 50;
const HIDDEN_COLUMNS = new Set(['id']);

function formatHeader(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DataTable({ practices, selectedIds: externalSelectedIds, onSelectionChange, assignments = {}, accounts = [] }: DataTableProps) {
  const accountMap = useMemo(() => {
    const map: Record<string, Account> = {};
    for (const a of accounts) map[a.id] = a;
    return map;
  }, [accounts]);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<number>>(new Set());
  const selectedIds = useMemo(
    () => (externalSelectedIds ? new Set(externalSelectedIds) : internalSelectedIds),
    [externalSelectedIds, internalSelectedIds],
  );
  const setSelectedIds = (ids: Set<number>) => {
    if (!externalSelectedIds) setInternalSelectedIds(ids);
    onSelectionChange([...ids]);
  };
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const columns = useMemo(() => {
    if (practices.length === 0) return [];
    const allKeys = new Set<string>();
    for (const p of practices) {
      for (const key of Object.keys(p)) {
        if (!HIDDEN_COLUMNS.has(key)) allKeys.add(key);
      }
    }
    const rest = [...allKeys].filter((k) => k !== 'accurx_id');
    const priority = allKeys.has('accurx_id') ? ['accurx_id'] : [];
    return [...priority, ...rest];
  }, [practices]);

  // Filter and sort are derived once per input change, not on every render.
  const sorted = useMemo(() => {
    const q = filter.toLowerCase();
    const filtered = q
      ? practices.filter((p) => columns.some((col) => String(p[col] || '').toLowerCase().includes(q)))
      : practices;
    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortField] || '');
      const bVal = String(b[sortField] || '');
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [practices, columns, filter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const visibleIds = sorted.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const goToPage = (next: number) => {
    if (next < 0 || next > totalPages - 1) return; // aria-disabled: refuse in the handler
    setPage(next);
  };

  const atFirst = safePage === 0;
  const atLast = safePage >= totalPages - 1;
  const pagerBtn =
    'min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-overlay transition-colors aria-disabled:text-disabled-ink aria-disabled:hover:bg-transparent aria-disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <Input
        label="Search"
        placeholder="Search across all columns"
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setPage(0); }}
        icon={<Search className="w-4 h-4 text-text-muted" />}
      />

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a named, focusable scroll region so keyboard users can scroll the table sideways */}
      <div className="overflow-x-auto rounded-xl border border-border" role="region" aria-label="Practices" tabIndex={0}>
        <table className="min-w-full text-sm">
          <thead className="bg-bg-overlay sticky top-0 z-10">
            <tr>
              <th scope="col" className="p-3 text-left w-12 sticky left-0 bg-bg-overlay z-20">
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  onChange={toggleAll}
                  checked={allVisibleSelected}
                  className="rounded accent-accent w-4 h-4"
                />
              </th>
              {accounts.length > 0 && (
                <th scope="col" className="p-3 text-left whitespace-nowrap">
                  <span className="font-semibold text-[11px] uppercase tracking-[0.06em] text-text-secondary">Account</span>
                </th>
              )}
              {columns.map((col) => {
                const active = sortField === col;
                return (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                    className="p-0 text-left whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className={`w-full min-h-10 px-3 inline-flex items-center gap-1 font-semibold text-[11px] uppercase tracking-[0.06em] transition-colors hover:bg-bg-raised ${
                        active ? 'text-accent' : 'text-text-secondary'
                      }`}
                    >
                      {formatHeader(col)}
                      {active && (sortAsc
                        ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {paged.map((practice) => (
              // Mouse convenience only: the checkbox inside is the real control.
              <tr
                key={practice.id}
                onClick={() => toggleOne(practice.id)}
                className={`cursor-pointer transition-colors duration-150 ${
                  selectedIds.has(practice.id) ? 'bg-accent-subtle/20' : 'hover:bg-bg-overlay/40'
                }`}
              >
                <td className="p-3 sticky left-0 bg-inherit" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${practice.name || practice.accurx_id}`}
                    checked={selectedIds.has(practice.id)}
                    onChange={() => toggleOne(practice.id)}
                    className="rounded accent-accent w-4 h-4"
                  />
                </td>
                {accounts.length > 0 && (
                  <td className="p-3 whitespace-nowrap">
                    {assignedAccountId(practice, assignments) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                        {accountMap[assignedAccountId(practice, assignments)!]?.label || '?'}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">Unassigned</span>
                    )}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`p-3 max-w-[250px] truncate ${
                      col === 'accurx_id' ? 'font-mono text-xs text-text-secondary' : 'text-text-primary'
                    }`}
                  >
                    {practice[col] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary tabular-nums">
          {selectedIds.size} of {sorted.length} selected
        </span>
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            aria-disabled={atFirst || undefined}
            onClick={() => goToPage(safePage - 1)}
            className={pagerBtn}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="text-text-secondary text-xs tabular-nums">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            aria-disabled={atLast || undefined}
            onClick={() => goToPage(safePage + 1)}
            className={pagerBtn}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </nav>
        <span className="text-text-secondary text-xs tabular-nums">
          {sorted.length} {sorted.length === 1 ? 'practice' : 'practices'}
        </span>
      </div>
    </div>
  );
}

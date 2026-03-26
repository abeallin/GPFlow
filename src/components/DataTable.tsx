'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from './ui/Input';

interface Practice {
  id: number;
  name: string;
  accurx_id: string;
  source_file: string;
  [key: string]: any;
}

interface DataTableProps {
  practices: Practice[];
  onSelectionChange: (ids: number[]) => void;
}

const PAGE_SIZE = 50;

// Columns to always hide
const HIDDEN_COLUMNS = new Set(['id']);

function formatHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DataTable({ practices, onSelectionChange }: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  // Dynamically discover columns from data
  const columns = useMemo(() => {
    if (practices.length === 0) return [];
    const allKeys = new Set<string>();
    for (const p of practices) {
      for (const key of Object.keys(p)) {
        if (!HIDDEN_COLUMNS.has(key)) allKeys.add(key);
      }
    }
    // Show accurx_id first (required column), then rest in CSV order
    const rest = [...allKeys].filter((k) => k !== 'accurx_id');
    const priority = allKeys.has('accurx_id') ? ['accurx_id'] : [];
    return [...priority, ...rest];
  }, [practices]);

  const filtered = practices.filter((p) => {
    const q = filter.toLowerCase();
    return columns.some((col) => String(p[col] || '').toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = String(a[sortField] || '');
    const bVal = String(b[sortField] || '');
    return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      const all = new Set(sorted.map((p) => p.id));
      setSelectedIds(all);
      onSelectionChange([...all]);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    onSelectionChange([...next]);
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search across all columns..."
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setPage(0); }}
        icon={<Search className="w-4 h-4 text-text-muted" />}
      />

      <div className="overflow-x-auto rounded-xl border border-border-subtle glass-card">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-overlay sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left w-12 sticky left-0 bg-bg-overlay z-20">
                <input
                  type="checkbox"
                  onChange={toggleAll}
                  checked={selectedIds.size === sorted.length && sorted.length > 0}
                  className="rounded accent-accent"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`p-3 text-left cursor-pointer transition-colors select-none whitespace-nowrap ${
                    sortField === col ? 'bg-bg-overlay/80' : 'hover:bg-bg-overlay/50'
                  }`}
                  onClick={() => handleSort(col)}
                >
                  <span className={`inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider ${
                    sortField === col ? 'text-accent' : 'text-text-secondary'
                  }`}>
                    {formatHeader(col)} <SortIcon field={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {paged.map((practice) => (
              <tr
                key={practice.id}
                onClick={() => toggleOne(practice.id)}
                className={`cursor-pointer transition-colors duration-150 ${
                  selectedIds.has(practice.id)
                    ? 'bg-accent-subtle/20'
                    : 'hover:bg-bg-overlay/40'
                }`}
              >
                <td className="p-3 sticky left-0 bg-inherit" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(practice.id)}
                    onChange={() => toggleOne(practice.id)}
                    className="rounded accent-accent"
                  />
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`p-3 max-w-[250px] truncate ${
                      col === 'accurx_id' ? 'font-mono text-xs text-text-secondary' : 'text-text-primary'
                    }`}
                    title={String(practice[col] || '')}
                  >
                    {practice[col] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          {selectedIds.size} of {sorted.length} selected
        </span>
        <span className="text-text-muted text-xs">
          {sorted.length} {sorted.length === 1 ? 'practice' : 'practices'}
        </span>
      </div>
    </div>
  );
}

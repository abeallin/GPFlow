'use client';

import { useState } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

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

const PAGE_SIZE = 25;

export function DataTable({ practices, onSelectionChange }: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = practices.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.accurx_id.includes(filter)
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a as any)[sortField] || '';
    const bVal = (b as any)[sortField] || '';
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
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
        placeholder="Search practices..."
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setPage(0); }}
        icon={<Search className="w-4 h-4 text-text-muted" />}
      />

      <div className="overflow-auto rounded-xl border border-border-subtle glass-card">
        <table className="w-full text-sm">
          <thead className="bg-bg-overlay sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left w-12">
                <input
                  type="checkbox"
                  onChange={toggleAll}
                  checked={selectedIds.size === sorted.length && sorted.length > 0}
                  className="rounded accent-accent"
                />
              </th>
              <th
                className={`p-3 text-left cursor-pointer transition-colors select-none ${
                  sortField === 'name' ? 'bg-bg-overlay/80' : 'hover:bg-bg-overlay/50'
                }`}
                onClick={() => handleSort('name')}
              >
                <span className={`inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider ${
                  sortField === 'name' ? 'text-accent' : 'text-text-secondary'
                }`}>
                  Name <SortIcon field="name" />
                </span>
              </th>
              <th
                className={`p-3 text-left cursor-pointer transition-colors select-none ${
                  sortField === 'accurx_id' ? 'bg-bg-overlay/80' : 'hover:bg-bg-overlay/50'
                }`}
                onClick={() => handleSort('accurx_id')}
              >
                <span className={`inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider ${
                  sortField === 'accurx_id' ? 'text-accent' : 'text-text-secondary'
                }`}>
                  Accurx ID <SortIcon field="accurx_id" />
                </span>
              </th>
              <th className="p-3 text-left">
                <span className="text-text-secondary font-semibold text-xs uppercase tracking-wider">Source</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {paged.map((practice) => (
              <tr
                key={practice.id}
                className={`transition-colors duration-150 ${
                  selectedIds.has(practice.id)
                    ? 'bg-accent-subtle/20'
                    : 'hover:bg-bg-overlay/40'
                }`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(practice.id)}
                    onChange={() => toggleOne(practice.id)}
                    className="rounded accent-accent"
                  />
                </td>
                <td className="p-3 text-text-primary font-medium">{practice.name}</td>
                <td className="p-3 font-mono text-xs text-text-secondary">{practice.accurx_id}</td>
                <td className="p-3 text-text-muted text-xs">{practice.source_file}</td>
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
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-text-muted text-xs tabular-nums">
              Page {page + 1} of {totalPages}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

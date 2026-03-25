'use client';

import { useState } from 'react';

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

export function DataTable({ practices, onSelectionChange }: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');

  const filtered = practices.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.accurx_id.includes(filter)
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a as any)[sortField] || '';
    const bVal = (b as any)[sortField] || '';
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

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

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search practices..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">
                <input type="checkbox" onChange={toggleAll} checked={selectedIds.size === sorted.length && sorted.length > 0} />
              </th>
              <th className="p-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                Name {sortField === 'name' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="p-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('accurx_id')}>
                Accurx ID {sortField === 'accurx_id' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="p-3 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((practice) => (
              <tr key={practice.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3">
                  <input type="checkbox" checked={selectedIds.has(practice.id)} onChange={() => toggleOne(practice.id)} />
                </td>
                <td className="p-3">{practice.name}</td>
                <td className="p-3 font-mono text-xs">{practice.accurx_id}</td>
                <td className="p-3 text-gray-500">{practice.source_file}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">{selectedIds.size} of {sorted.length} selected</p>
    </div>
  );
}

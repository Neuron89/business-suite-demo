'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getActionItems } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import { DSR_CATEGORY_LABELS, PSSR_CATEGORY_LABELS } from '@moc/shared';

type SortKey = 'source' | 'moc_number' | 'moc_title' | 'category' | 'moc_status' | 'action_type' | 'assigned_to_name';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'pending' | 'completed' | 'all';

export default function ActionItemsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [filterSource, setFilterSource] = useState<'all' | 'dsr' | 'pssr'>('all');
  const [filterMoc, setFilterMoc] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('moc_number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Always fetch the full set so the pending/completed/all toggle is purely
  // client-side. Items are scoped per-user server-side.
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getActionItems(token, true)
      .then(setItems)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter === 'pending') {
      result = result.filter((i) => !i.action_resolved);
    } else if (statusFilter === 'completed') {
      result = result.filter((i) => i.action_resolved);
    }
    if (filterSource !== 'all') {
      result = result.filter((i) => i.source === filterSource);
    }
    if (filterMoc) {
      const q = filterMoc.toLowerCase();
      result = result.filter((i) =>
        (i.moc_number || '').toLowerCase().includes(q) ||
        (i.moc_title || '').toLowerCase().includes(q)
      );
    }
    // Sort
    result = [...result].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, statusFilter, filterSource, filterMoc, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const unresolvedCount = items.filter((i) => !i.action_resolved).length;
  const resolvedCount = items.filter((i) => i.action_resolved).length;

  const STATUS_OPTIONS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'pending', label: 'Pending', count: unresolvedCount },
    { value: 'completed', label: 'Completed', count: resolvedCount },
    { value: 'all', label: 'All', count: items.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">My Action Items</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {unresolvedCount} pending, {resolvedCount} completed
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
        <div className="flex gap-1 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
          {(['all', 'dsr', 'pssr'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterSource(s)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterSource === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {s === 'all' ? 'All' : s.toUpperCase()}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search MOC number or title..."
          value={filterMoc}
          onChange={(e) => setFilterMoc(e.target.value)}
          className="input-field text-sm w-64 ml-auto"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-gray-500 text-lg">No action items</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {items.length === 0 ? 'You have no assigned action items.' : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('source')}>
                    Source{sortIndicator('source')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('moc_number')}>
                    MOC{sortIndicator('moc_number')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('moc_title')}>
                    MOC Title{sortIndicator('moc_title')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('category')}>
                    Category{sortIndicator('category')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('moc_status')}>
                    MOC Status{sortIndicator('moc_status')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('assigned_to_name')}>
                    Assigned To{sortIndicator('assigned_to_name')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const catLabel = item.source === 'dsr'
                    ? (DSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category
                    : (PSSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category;

                  return (
                    <tr
                      key={`${item.source}-${item.id}`}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                        item.action_resolved ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          item.source === 'dsr'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        }`}>
                          {item.source.toUpperCase()}
                        </span>
                        {item.source === 'pssr' && item.action_type && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ml-1 ${
                            item.action_type === 'post_startup'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                          }`}>
                            {item.action_type === 'post_startup' ? 'Post' : 'Pre'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/moc/${item.moc_id}?tab=action_items`} className="text-brand-600 hover:text-brand-800 font-medium">
                          {item.moc_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <Link href={`/moc/${item.moc_id}?tab=action_items`} className="text-gray-800 dark:text-gray-200 hover:text-brand-600 truncate block">
                          {item.moc_title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">{catLabel}</td>
                      <td className="py-3 px-4 max-w-[250px]">
                        <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{item.description}</p>
                        {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 truncate italic mt-0.5">{item.notes}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={item.moc_status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                        {item.assigned_to_name || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="py-3 px-4">
                        {item.action_resolved ? (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">RESOLVED</span>
                        ) : (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">OPEN</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

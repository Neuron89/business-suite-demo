'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMocs, getMyDrafts, getMyActionItems } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import RiskBadge from '@/components/shared/RiskBadge';
import { MOC_STATUSES, MOC_TYPES, CRF_RISK_LEVEL_COLORS } from '@moc/shared';
import type { CrfRiskLevel } from '@moc/shared';

const EXCLUDE_STATUS_LABELS: Record<string, string> = {
  'closed,draft': 'Open MOCs',
};

export default function MocListPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    change_type: '',
    exclude_status: '',
    search: '',
    page: '1',
  });

  // Read URL search params on mount
  useEffect(() => {
    const status = searchParams.get('status') || '';
    const change_type = searchParams.get('change_type') || '';
    const exclude_status = searchParams.get('exclude_status') || '';
    const search = searchParams.get('search') || '';
    const page = searchParams.get('page') || '1';
    setFilters({ status, change_type, exclude_status, search, page });
    setInitialized(true);
  }, [searchParams]);

  const fetchMocs = useCallback(async () => {
    if (!token || !initialized) return;
    try {
      const params: Record<string, string> = {};
      if (filters.status) params.status = filters.status;
      if (filters.change_type) params.change_type = filters.change_type;
      if (filters.exclude_status) params.exclude_status = filters.exclude_status;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      const result = await getMocs(token, params);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, filters, initialized]);

  useEffect(() => {
    fetchMocs();
  }, [fetchMocs]);

  // Fetch user's drafts and action items
  useEffect(() => {
    if (!token) return;
    getMyDrafts(token).then(setDrafts).catch(console.error);
    getMyActionItems(token).then(setActionItems).catch(console.error);
  }, [token]);

  // Sync filters back to URL
  function updateFilters(newFilters: typeof filters) {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.change_type) params.set('change_type', newFilters.change_type);
    if (newFilters.exclude_status) params.set('exclude_status', newFilters.exclude_status);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.page && newFilters.page !== '1') params.set('page', newFilters.page);
    const qs = params.toString();
    router.replace(`/moc${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  function clearFilters() {
    const cleared = { status: '', change_type: '', exclude_status: '', search: '', page: '1' };
    setFilters(cleared);
    router.replace('/moc', { scroll: false });
  }

  const activeExcludeLabel = filters.exclude_status
    ? EXCLUDE_STATUS_LABELS[filters.exclude_status] || `Excluding: ${filters.exclude_status.replace(/,/g, ', ')}`
    : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MOC Requests</h1>
        <Link href="/moc/new" className="btn-primary">New MOC Request</Link>
      </div>

      {/* My Action Items */}
      {actionItems.length > 0 && (
        <div className="mb-4 card bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
              My Action Items ({actionItems.length})
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {actionItems.map((item: any, idx: number) => (
              <Link
                key={`${item.moc_id}-${item.type}-${idx}`}
                href={`/moc/${item.moc_id}?tab=${item.tab || 'overview'}`}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/50 hover:ring-2 hover:ring-red-400 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.moc_number || `#${item.moc_id}`} — {item.title}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {item.description}
                  </p>
                </div>
                <span className="text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap ml-2">
                  View &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* My Drafts banner */}
      {drafts.length > 0 && (
        <div className="mb-4 card bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              My Drafts ({drafts.length})
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {drafts.map((d: any) => (
              <Link
                key={d.id}
                href={`/moc/new?draft=${d.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50 hover:ring-2 hover:ring-amber-400 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {d.title || 'Untitled Draft'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {d.template_name || 'No template'}
                    {' \u00B7 '}
                    {new Date(d.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {d.crf_risk_level && d.crf_risk_level !== '---' && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[d.crf_risk_level as CrfRiskLevel] || '#9ca3af' }}
                    >
                      {d.crf_risk_level}
                    </span>
                  )}
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    Continue &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active filter banner */}
      {activeExcludeLabel && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-blue-500/10 border border-blue-500/20">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Filtered: {activeExcludeLabel}
          </span>
          <button
            onClick={clearFilters}
            className="ml-auto text-xs font-semibold text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilters({ ...filters, search: e.target.value, page: '1' })}
              className="input-field"
              placeholder="Search MOCs..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ ...filters, status: e.target.value, exclude_status: '', page: '1' })}
              className="input-field"
            >
              <option value="">All Statuses</option>
              {MOC_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Change Type</label>
            <select
              value={filters.change_type}
              onChange={(e) => updateFilters({ ...filters, change_type: e.target.value, page: '1' })}
              className="input-field"
            >
              <option value="">All Types</option>
              {MOC_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Table */}
      {data ? (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Risk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">PSM</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Created By</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((moc: any) => (
                    <tr
                      key={moc.id}
                      onClick={() => router.push(`/moc/${moc.id}`)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-brand-600">{moc.moc_number || `#${moc.id}`}</td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{moc.title}</td>
                      <td className="py-3 px-4"><StatusBadge status={moc.status} /></td>
                      <td className="py-3 px-4">{moc.risk_level ? <RiskBadge level={moc.risk_level} /> : <span className="text-gray-300 dark:text-gray-500 text-xs">--</span>}</td>
                      <td className="py-3 px-4 capitalize text-gray-600 dark:text-gray-300">{moc.change_type?.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4">
                        {moc.is_psm_relevant && <span className="badge bg-red-100 text-red-700">PSM</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{moc.creator_name}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">{new Date(moc.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {data.data.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 dark:text-gray-500">
                        No MOC requests found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center mt-4 space-x-2">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => updateFilters({ ...filters, page: String(p) })}
                  className={`px-3 py-1 rounded text-sm ${
                    p === data.page
                      ? 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</div>
      )}
    </div>
  );
}

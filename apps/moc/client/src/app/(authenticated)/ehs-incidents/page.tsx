'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getEhsIncidents, exportEhsIncidents } from '@/lib/api';
import {
  EHS_INCIDENT_TYPES,
  EHS_INCIDENT_SEVERITIES,
  EHS_INCIDENT_STATUSES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '@moc/shared';

export default function EhsIncidentsPage() {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    incident_type: '',
    severity: '',
    search: '',
  });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params: Record<string, string> = { page: String(page) };
    if (filters.status) params.status = filters.status;
    if (filters.incident_type) params.incident_type = filters.incident_type;
    if (filters.severity) params.severity = filters.severity;
    if (filters.search) params.search = filters.search;

    getEhsIncidents(token, params)
      .then((res) => {
        setIncidents(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, page, filters]);

  function handleFilterChange(key: string, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EHS Incidents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} incident{total !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!token) return;
              setExporting(true);
              try {
                const params: Record<string, string> = {};
                if (filters.status) params.status = filters.status;
                if (filters.incident_type) params.incident_type = filters.incident_type;
                if (filters.severity) params.severity = filters.severity;
                if (filters.search) params.search = filters.search;
                await exportEhsIncidents(token, params);
              } catch (err: any) {
                alert(err.message || 'Export failed');
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <Link href="/ehs-incidents/new" className="btn-primary">
            Report Incident
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input-field text-sm"
              placeholder="Search incidents..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Statuses</option>
              {EHS_INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filters.incident_type}
              onChange={(e) => handleFilterChange('incident_type', e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Types</option>
              {EHS_INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Severities</option>
              {EHS_INCIDENT_SEVERITIES.map((s) => (
                <option key={s} value={s}>{INCIDENT_SEVERITY_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</p>
      ) : incidents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-gray-500 mb-4">No incidents found</p>
          <Link href="/ehs-incidents/new" className="btn-primary">Report First Incident</Link>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Severity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Reported By</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                        <Link href={`/ehs-incidents/${inc.id}`} className="text-brand-600 hover:underline">
                          #{inc.id}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/ehs-incidents/${inc.id}`} className="font-medium text-gray-800 dark:text-gray-100 hover:text-brand-600">
                          {inc.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 capitalize text-gray-600 dark:text-gray-300">
                        {inc.incident_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="badge text-white text-xs"
                          style={{ backgroundColor: INCIDENT_SEVERITY_COLORS[inc.severity as keyof typeof INCIDENT_SEVERITY_COLORS] }}
                        >
                          {INCIDENT_SEVERITY_LABELS[inc.severity as keyof typeof INCIDENT_SEVERITY_LABELS]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="badge text-white text-xs"
                          style={{ backgroundColor: INCIDENT_STATUS_COLORS[inc.status as keyof typeof INCIDENT_STATUS_COLORS] }}
                        >
                          {INCIDENT_STATUS_LABELS[inc.status as keyof typeof INCIDENT_STATUS_LABELS]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {new Date(inc.incident_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{inc.reporter_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

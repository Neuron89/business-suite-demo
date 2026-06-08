'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { complaintApi } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import SeverityBadge from '@/components/shared/SeverityBadge';

const STATUSES = ['', 'submitted', 'under_review', 'resolved', 'closed', 'rejected', 'returned'];
const TYPES = ['', 'quality', 'delivery', 'packaging', 'documentation', 'contamination', 'other'];
const SEVERITIES = ['', 'low', 'medium', 'high', 'critical'];

export default function ComplaintsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1, limit: 20, status: '', complaint_type: '', severity: '', search: '',
    sort_by: 'created_at', sort_order: 'desc',
  });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const result = await complaintApi.list(filters);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Complaints</h1>
        <Link href="/complaints/new" className="btn-primary">+ New Complaint</Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search..."
            className="input-field"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
          <select className="input-field" value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select className="input-field" value={filters.complaint_type}
            onChange={(e) => setFilters({ ...filters, complaint_type: e.target.value, page: 1 })}>
            <option value="">All Types</option>
            {TYPES.filter(Boolean).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="input-field" value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value, page: 1 })}>
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="input-field" value={`${filters.sort_by}:${filters.sort_order}`}
            onChange={(e) => {
              const [sort_by, sort_order] = e.target.value.split(':');
              setFilters({ ...filters, sort_by, sort_order, page: 1 });
            }}>
            <option value="created_at:desc">Newest First</option>
            <option value="created_at:asc">Oldest First</option>
            <option value="updated_at:desc">Recently Updated</option>
            <option value="severity:desc">Severity (High first)</option>
            <option value="complaint_number:desc">Number (Desc)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No complaints found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['#', 'Title', 'Customer', 'Type', 'Severity', 'Status', 'Assigned To', 'Created'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c: any) => (
                    <tr key={c.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      onClick={() => window.location.href = `/complaints/${c.id}`}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--accent)' }}>{c.complaint_number}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.customer_name}</td>
                      <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{c.complaint_type}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.assigned_to_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" disabled={data.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
                  <button className="btn-secondary text-sm" disabled={data.page >= data.totalPages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

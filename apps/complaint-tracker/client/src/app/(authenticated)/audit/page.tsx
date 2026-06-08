'use client';

import { useState, useEffect, useCallback } from 'react';
import { auditApi } from '@/lib/api';

export default function AuditPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditApi.list({
        page: String(page),
        limit: '30',
        entity_type: entityFilter,
        action: actionFilter,
      });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter, actionFilter]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Trail</h1>

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="input-field" value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}>
            <option value="">All Entities</option>
            <option value="complaint">Complaints</option>
            <option value="user">Users</option>
            <option value="attachment">Attachments</option>
          </select>
          <select className="input-field" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="transition">Transition</option>
            <option value="comment">Comment</option>
            <option value="assign">Assign</option>
            <option value="upload">Upload</option>
            <option value="delete">Delete</option>
          </select>
          <div className="text-sm flex items-center" style={{ color: 'var(--text-secondary)' }}>
            {data && `${data.total} entries`}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No audit entries found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Changes'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry: any) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{entry.user_name || '—'}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--accent)' }}>{entry.action}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{entry.entity_type}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{entry.entity_id || '—'}</td>
                    <td className="px-4 py-3 max-w-[300px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {entry.changes ? JSON.stringify(entry.changes) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}>Previous</button>
                  <button className="btn-secondary text-sm" disabled={page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

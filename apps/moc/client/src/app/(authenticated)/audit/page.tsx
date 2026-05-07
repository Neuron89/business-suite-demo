'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getAuditLog } from '@/lib/api';

export default function AuditLogPage() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ page: '1', entity_type: '', action: '' });

  const fetch = useCallback(async () => {
    if (!token) return;
    try {
      const params: Record<string, string> = { page: filters.page };
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.action) params.action = filters.action;
      const result = await getAuditLog(token, params);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Audit Log</h1>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entity Type</label>
            <select value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value, page: '1' })} className="input-field">
              <option value="">All</option>
              <option value="moc_request">MOC Request</option>
              <option value="risk_assessment">Risk Assessment</option>
              <option value="user">User</option>
              <option value="pssr_checklist">PSSR Checklist</option>
              <option value="pssr_item">PSSR Item</option>
              <option value="attachment">Attachment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value, page: '1' })} className="input-field">
              <option value="">All</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="transition">Transition</option>
              <option value="review">Review</option>
              <option value="login">Login</option>
              <option value="upload">Upload</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ page: '1', entity_type: '', action: '' })} className="btn-secondary w-full">Clear</button>
          </div>
        </div>
      </div>

      {data ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Entity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Changes</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4 font-medium">{log.user_name}</td>
                    <td className="py-3 px-4"><span className="badge bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 capitalize">{log.action}</span></td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{log.entity_type} #{log.entity_id}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {typeof log.changes === 'object' ? JSON.stringify(log.changes) : log.changes}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400 dark:text-gray-500">No audit entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex justify-center py-4 space-x-2">
              {Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters({ ...filters, page: String(p) })}
                  className={`px-3 py-1 rounded text-sm ${
                    p === data.page ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</div>
      )}
    </div>
  );
}

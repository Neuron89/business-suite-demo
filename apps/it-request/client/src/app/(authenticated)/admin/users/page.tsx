'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getUsers } from '@/lib/api';

export default function AdminUsersPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || user?.role !== 'it_admin') return;
    getUsers(token).then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, [token, user]);

  if (user?.role !== 'it_admin') return <div className="card"><p className="text-theme-muted">Access denied.</p></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <h1 className="text-2xl font-extrabold text-theme-primary">Manage Users</h1>
      <div className="card p-0">
        {loading ? (
          <div className="p-6"><p className="text-theme-muted">Loading...</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-table-head">
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Email</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Role</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Department</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Manager</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-theme hover:bg-card-hover-surface transition-colors">
                    <td className="px-4 py-3 font-semibold text-theme-primary">{u.name}</td>
                    <td className="px-4 py-3 text-theme-secondary">{u.email}</td>
                    <td className="px-4 py-3"><span className="badge capitalize" style={{ background: 'var(--sidebar-active)', color: 'var(--accent)' }}>{u.role.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-theme-secondary">{u.department || '-'}</td>
                    <td className="px-4 py-3 text-theme-secondary">{u.manager_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={{ background: u.is_active ? '#22c55e20' : '#ef444420', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

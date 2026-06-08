'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userApi, ApiError } from '@/lib/api';

const ROLES = ['admin', 'operations', 'qc'];

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'operations' });

  const loadUsers = async () => {
    try {
      const data = await userApi.list();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  if (currentUser?.role !== 'admin') {
    return <div style={{ color: 'var(--text-secondary)' }}>Access denied. Admin only.</div>;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await userApi.create(form);
      setForm({ email: '', password: '', name: '', role: 'operations' });
      setShowCreate(false);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user');
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await userApi.update(userId, { is_active: !isActive });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user');
    }
  };

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await userApi.update(userId, { role });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>{error}</div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Create User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="input-field" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{u.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <select className="input-field py-1 text-xs" value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{
                      backgroundColor: u.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: u.is_active ? '#22c55e' : '#ef4444',
                    }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(u.id, u.is_active)}
                      className="text-xs" style={{ color: u.is_active ? 'var(--danger)' : 'var(--success)' }}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

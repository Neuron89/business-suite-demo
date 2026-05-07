'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime } from '@/lib/format';
import DataTable from '@/components/shared/DataTable';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface Carrier {
  id: number;
  name: string;
  code: string | null;
  mode_default: string | null;
  active: boolean;
}

interface SyncRun {
  id: number;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_upserted: number | null;
  message: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [syncs, setSyncs] = useState<SyncRun[]>([]);
  const [iqmsStatus, setIqmsStatus] = useState<string>('unknown');
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const isAdmin = user?.role === 'admin';

  async function load() {
    try {
      const [c, s] = await Promise.all([
        api.get<{ data: Carrier[] }>('/carriers'),
        api.get<{ data: SyncRun[] }>('/sync/status'),
      ]);
      setCarriers(c.data);
      setSyncs(s.data);
    } catch (e: any) {
      setError(e.message);
    }
    if (isAdmin) {
      try {
        const u = await api.get<{ data: User[] }>('/users');
        setUsers(u.data);
      } catch {}
    }
  }

  async function testIqms() {
    try {
      const r = await api.get<{ ok: boolean; message?: string }>('/sync/test-iqms');
      setIqmsStatus(r.ok ? 'connected' : `error: ${r.message}`);
    } catch (e: any) {
      setIqmsStatus(`error: ${e.message}`);
    }
  }

  useEffect(() => {
    load();
    testIqms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      await api.post('/users', newUser);
      setNewUser({ email: '', name: '', password: '', role: 'viewer' });
      setInfo('User created.');
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
    }
  }

  async function runIqmsSync() {
    setInfo('');
    setError('');
    try {
      const r = await api.post<{ shipments?: any; inventory?: any }>('/sync/run/all', {});
      const rows =
        (r.shipments?.rows_upserted ?? 0) + (r.inventory?.rows_upserted ?? 0);
      setInfo(`IQMS sync complete: ${rows} rows.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-navy-800 dark:text-white">Settings</h2>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {info && <div className="text-sm text-green-600">{info}</div>}

      <div className="card">
        <h3 className="font-semibold text-navy-800 dark:text-white mb-3">Integrations</h3>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <div className="text-xs text-navy-500 dark:text-navy-300">IQMS Oracle</div>
            <div
              className={
                iqmsStatus === 'connected'
                  ? 'text-green-600 font-medium'
                  : iqmsStatus === 'unknown'
                    ? 'text-navy-500'
                    : 'text-red-600'
              }
            >
              {iqmsStatus}
            </div>
          </div>
          <button className="btn btn-secondary text-xs" onClick={testIqms}>
            Test
          </button>
          <button className="btn btn-primary text-xs" onClick={runIqmsSync}>
            Run sync now
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-navy-800 dark:text-white mb-3">Carriers</h3>
        <DataTable
          rows={carriers}
          rowKey={(r) => r.id}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'mode_default', label: 'Default mode' },
            {
              key: 'active',
              label: 'Active',
              render: (r) => (r.active ? 'Yes' : 'No'),
            },
          ]}
        />
      </div>

      <div className="card">
        <h3 className="font-semibold text-navy-800 dark:text-white mb-3">Sync history</h3>
        <DataTable
          rows={syncs}
          rowKey={(r) => r.id}
          columns={[
            { key: 'source', label: 'Source' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span
                  className={
                    r.status === 'ok'
                      ? 'text-green-600'
                      : r.status === 'error'
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }
                >
                  {r.status}
                </span>
              ),
            },
            {
              key: 'started_at',
              label: 'Started',
              render: (r) => fmtDateTime(r.started_at),
            },
            {
              key: 'finished_at',
              label: 'Finished',
              render: (r) => fmtDateTime(r.finished_at),
            },
            { key: 'rows_upserted', label: 'Rows', align: 'right' },
            { key: 'message', label: 'Message' },
          ]}
          empty="No syncs have run yet."
        />
      </div>

      {isAdmin && (
        <>
          <div className="card">
            <h3 className="font-semibold text-navy-800 dark:text-white mb-3">Users</h3>
            <DataTable
              rows={users}
              rowKey={(r) => r.id}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (r) => fmtDateTime(r.created_at),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="font-semibold text-navy-800 dark:text-white mb-3">Add user</h3>
            <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="input"
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
              <select
                className="input"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="shipping_head">Shipping head</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="md:col-span-4">
                <button className="btn btn-primary text-xs" type="submit">
                  Create user
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

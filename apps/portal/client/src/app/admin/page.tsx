'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminOnboardingItem } from '@portal/shared';
import { MODULES, type ModuleKey } from '@portal/shared';
import { useAuth } from '@/lib/auth-context';
import { getAdminEmployees, getOnboardingQueue, patchAdminAccess } from '@/lib/api';
import PortalShell from '@/components/layout/PortalShell';
import HolidaysAdmin from '@/components/HolidaysAdmin';

interface DirectoryRow {
  email: string;
  full_name: string;
  department?: string | null;
  title?: string | null;
  portal_role: 'employee' | 'manager' | 'hr' | 'admin';
  access: Record<ModuleKey, boolean>;
}

// Short, hand-tuned column labels for the access matrix. Falls back to the
// first word of the full label for any module that isn't mapped here.
const SHORT_LABELS: Partial<Record<ModuleKey, string>> = {
  moc: 'MOC',
  it: 'IT',
  it_test: 'Test',
  complaint: 'Comp',
  qc: 'QC',
  sds: 'SDS',
  iqms_chat: 'IQMS',
  employee_db: 'Dir',
  shipping: 'Ship',
};

export default function AdminPage() {
  const { token, employee, loading: authLoading } = useAuth();
  const router = useRouter();
  const [onboarding, setOnboarding] = useState<{ items: AdminOnboardingItem[]; note?: string } | null>(
    null
  );
  const [employees, setEmployees] = useState<DirectoryRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !employee) {
      router.replace('/login');
      return;
    }
    if (!['admin', 'hr'].includes(employee.portal_role)) {
      router.replace('/home');
      return;
    }

    Promise.all([getOnboardingQueue(token), getAdminEmployees(token)])
      .then(([q, dir]) => {
        setOnboarding(q);
        setEmployees(dir.employees);
      })
      .catch((err) => setError((err as Error).message));
  }, [token, employee, authLoading, router]);

  async function toggleFlag(row: DirectoryRow, flag: ModuleKey, value: boolean) {
    if (!token) return;
    setSavingEmail(row.email);
    try {
      const res = await patchAdminAccess(token, {
        email: row.email,
        access: { [flag]: value },
      });
      setEmployees(
        (employees || []).map((e) =>
          e.email === row.email ? { ...e, access: res.employee.access } : e
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingEmail(null);
    }
  }

  async function changeRole(row: DirectoryRow, role: DirectoryRow['portal_role']) {
    if (!token) return;
    setSavingEmail(row.email);
    try {
      const res = await patchAdminAccess(token, { email: row.email, portal_role: role });
      setEmployees(
        (employees || []).map((e) =>
          e.email === row.email ? { ...e, portal_role: res.employee.portal_role } : e
        )
      );
    } finally {
      setSavingEmail(null);
    }
  }

  const filteredEmployees =
    employees?.filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.email.toLowerCase().includes(q) ||
        (e.full_name || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }) || [];

  return (
    <PortalShell>
      {/*
       * No `animate-fade-in-up` here: that animation ends in a
       * `transform: translateY(0)` that persists with `fill-mode: both`,
       * which creates a containing block and breaks `position: sticky`
       * on the access-matrix thead below.
       */}
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold text-theme-primary">Admin tools</h1>
          <p className="text-sm text-theme-muted mt-1">
            Onboarding queue + per-employee access management.
          </p>
        </header>

        {error && (
          <div className="card border-l-4 border-red-500 text-sm text-red-600">{error}</div>
        )}

        <section>
          <h2 className="text-lg font-bold text-theme-primary mb-3">HR onboarding queue</h2>
          {onboarding === null ? (
            <div className="card text-sm text-theme-muted">Loading…</div>
          ) : onboarding.items.length === 0 ? (
            <div className="card text-sm text-theme-muted">
              {onboarding.note || 'No pending onboarding tickets.'}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head">
                  <tr>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">#</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Employee</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Manager</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Start</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {onboarding.items.map((it) => (
                    <tr key={it.ticket_id} className="border-t border-theme">
                      <td className="px-3 py-2">
                        <a href={it.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          {it.request_number}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-theme-primary">{it.full_name}</td>
                      <td className="px-3 py-2 text-theme-secondary">{it.manager_name || '—'}</td>
                      <td className="px-3 py-2 text-theme-secondary">
                        {it.start_date ? new Date(it.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2">{it.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-lg font-bold text-theme-primary">System access</h2>
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field max-w-sm"
            />
          </div>
          {employees === null ? (
            <div className="card text-sm text-theme-muted">Loading directory…</div>
          ) : (
            // Sticky thead requires three things to all hold:
            //  1. Table must use `border-collapse: separate` — Tailwind's default
            //     `collapse` silently disables sticky on <thead>.
            //  2. No ancestor between <thead> and the page can have non-visible
            //     overflow — `.card` applies `overflow-hidden`, so we override.
            //  3. Sticky lives on each <th> for cross-browser reliability.
            <div className="card p-0" style={{ overflow: 'visible' }}>

              <table
                className="w-full text-sm"
                style={{ borderCollapse: 'separate', borderSpacing: 0 }}
              >
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold bg-table-head sticky top-0 z-20 shadow-sm">Employee</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold bg-table-head sticky top-0 z-20 shadow-sm">Role</th>
                    {MODULES.filter((m) => !m.external || m.adminOnly).map((m) => (
                      <th
                        key={m.key}
                        className="text-center px-2 py-2 text-theme-muted font-semibold bg-table-head sticky top-0 z-20 shadow-sm"
                        title={m.label}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="h-6 w-6 rounded flex items-center justify-center text-white font-extrabold text-[0.7rem]"
                            style={{ background: m.color }}
                          >
                            {m.glyph}
                          </span>
                          <span className="text-[0.6rem] uppercase tracking-wider text-theme-muted">
                            {SHORT_LABELS[m.key] || m.label.split(' ')[0]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((row) => (
                    // border-collapse:separate means <tr> borders don't render —
                    // put the row separator on each cell as a top border instead.
                    <tr key={row.email}>
                      <td className="px-3 py-2 border-t border-theme">
                        <p className="font-semibold text-theme-primary">{row.full_name}</p>
                        <p className="text-xs text-theme-muted">
                          {row.email} · {row.department || 'no dept'}
                        </p>
                      </td>
                      <td className="px-3 py-2 border-t border-theme">
                        <select
                          value={row.portal_role}
                          disabled={savingEmail === row.email}
                          onChange={(e) =>
                            changeRole(row, e.target.value as DirectoryRow['portal_role'])
                          }
                          className="input-field py-1 px-2 text-xs"
                        >
                          <option value="employee">employee</option>
                          <option value="manager">manager</option>
                          <option value="hr">hr</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      {MODULES.filter((m) => !m.external || m.adminOnly).map((m) => (
                        <td key={m.key} className="text-center px-2 py-2 border-t border-theme">
                          <input
                            type="checkbox"
                            checked={!!row.access[m.key]}
                            disabled={savingEmail === row.email}
                            onChange={(e) => toggleFlag(row, m.key, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-theme-faint mt-2">
            Columns: {MODULES.filter((m) => !m.external || m.adminOnly).map((m) => `${m.glyph}=${m.label}`).join(' · ')}
          </p>
        </section>

        {token && <HolidaysAdmin token={token} />}

        <section>
          <h2 className="text-lg font-bold text-theme-primary mb-3">Banner announcements</h2>
          <p className="text-xs text-theme-muted">
            Active announcements show in the home-page ticker. Manage them on the{' '}
            <a href="/announcements" className="text-accent hover:underline">
              Announcements page
            </a>
            .
          </p>
        </section>
      </div>
    </PortalShell>
  );
}

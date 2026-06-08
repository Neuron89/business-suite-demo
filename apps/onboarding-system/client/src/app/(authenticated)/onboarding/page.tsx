'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTickets, getMyPings, resolvePing, type Ping } from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS } from '@onb/shared';
import Link from 'next/link';

const URGENCY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

// Filter pills correspond to v2 pipeline phases. "Open" still works as a
// catch-all for anyone scanning the whole pipeline.
type FilterKey = 'open' | 'hr_fill' | 'it_close' | 'closed' | 'all';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'open',     label: 'All Open' },
  { key: 'hr_fill',  label: 'Needs HR' },
  { key: 'it_close', label: 'Needs IT Close' },
  { key: 'closed',   label: 'Closed' },
  { key: 'all',      label: 'All' },
];

export default function OnboardingListPage() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const initialFilter: FilterKey =
    (FILTERS.find((f) => f.key === searchParams.get('status'))?.key) || 'open';
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [pings, setPings] = useState<Ping[]>([]);
  function loadPings() {
    if (!token) return;
    getMyPings(token).then(setPings).catch(() => {});
  }
  useEffect(loadPings, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getTickets(token, { type: 'onboarding', limit: '100' })
      .then((r) => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = tickets.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'hr_fill') return t.status === 'hr_fill';
    if (filter === 'it_close') return t.status === 'it_close';
    const closed = ['completed', 'cancelled', 'denied'].includes(t.status);
    return filter === 'open' ? !closed : closed;
  });

  // v2 — anyone with onboarding access (managers, HR, IT) can submit.
  const canCreate = user?.role === 'manager' || user?.role === 'hr' || user?.role === 'it_admin';

  async function handleResolvePing(id: number) {
    if (!token) return;
    try { await resolvePing(token, id); loadPings(); }
    catch (err: any) { alert(err.message); }
  }

  return (
    <div className="animate-fade-in-up space-y-6">
        {pings.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
            <h2 className="text-lg font-bold text-theme-primary mb-3">⚡ Action needed ({pings.length})</h2>
            <div className="space-y-2">
              {pings.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
                  <div className="text-sm">
                    <p className="text-theme-primary font-semibold">{p.message}</p>
                    <p className="text-theme-muted text-xs mt-1">
                      {p.from_name || 'IT'} ·{' '}
                      <Link href={`/onboarding/${p.ticket_id}`} className="text-accent hover:underline">{p.request_number || `Ticket #${p.ticket_id}`}</Link>
                      {p.ticket_title ? ` — ${p.ticket_title}` : ''} · {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => handleResolvePing(p.id)} className="btn-secondary whitespace-nowrap text-sm">Mark done</button>
                </div>
              ))}
            </div>
          </div>
        )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-theme-primary">Onboarding</h1>
          <p className="text-sm text-theme-muted mt-1">New hire requisitions — managers submit, HR fills, IT closes</p>
        </div>
        {canCreate && <Link href="/onboarding/new" className="btn-accent">New Hire Requisition</Link>}
      </div>

      <div className="card">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filter === f.key ? 'text-white' : 'text-theme-muted'}`}
              style={{ background: filter === f.key ? 'var(--accent)' : 'var(--bg-card-hover)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="p-6"><p className="text-theme-muted">Loading...</p></div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-table-head">
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">#</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">New Hire</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Job Title</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Department</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Start Date</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Urgency</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : r.onboarding_details || {};
                  // v2: HR adds start_date after the requisition; until then we
                  // display target_start_date from the manager's submission.
                  const startDate = (od.start_date || od.target_start_date) ? new Date(od.start_date || od.target_start_date) : null;
                  const daysToStart = startDate ? Math.ceil((startDate.getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={r.id} className="border-t border-theme hover:bg-card-hover-surface transition-colors">
                      <td className="px-4 py-3"><Link href={`/onboarding/${r.id}`} className="text-accent font-semibold hover:underline">{r.request_number}</Link></td>
                      <td className="px-4 py-3 text-theme-primary font-medium">
                        {od.full_name ? od.full_name : <span className="text-theme-faint italic">awaiting HR — {od.job_title || 'role TBD'}</span>}
                      </td>
                      <td className="px-4 py-3 text-theme-secondary">{od.job_title || '-'}</td>
                      <td className="px-4 py-3 text-theme-secondary">{od.department || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-theme-primary">{startDate ? startDate.toLocaleDateString() : '-'}</span>
                        {daysToStart !== null && daysToStart >= 0 && daysToStart <= 14 && (
                          <span className="block text-[10px] font-bold uppercase mt-0.5" style={{ color: daysToStart <= 3 ? '#ef4444' : '#f59e0b' }}>
                            in {daysToStart} day{daysToStart === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className="badge" style={{ background: `${URGENCY_COLORS[r.urgency]}20`, color: URGENCY_COLORS[r.urgency] }}>{r.urgency}</span></td>
                      <td className="px-4 py-3"><span className="badge" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td className="px-4 py-3 text-theme-secondary">{r.assignee_name || <span className="text-theme-faint italic">unassigned</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6"><p className="text-theme-muted">No onboarding tickets {filter !== 'all' ? `(${filter})` : ''}.</p></div>
        )}
      </div>
    </div>
  );
}

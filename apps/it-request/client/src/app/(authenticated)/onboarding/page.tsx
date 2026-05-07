'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getTickets } from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS } from '@itr/shared';
import Link from 'next/link';

const URGENCY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

export default function OnboardingListPage() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');

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
    const closed = ['completed', 'cancelled', 'denied'].includes(t.status);
    return filter === 'open' ? !closed : closed;
  });

  const canCreate = user?.role === 'hr';

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-theme-primary">Onboarding</h1>
          <p className="text-sm text-theme-muted mt-1">New hire setup tickets — submitted by HR, fulfilled by IT</p>
        </div>
        {canCreate && <Link href="/onboarding/new" className="btn-accent">New Hire Intake</Link>}
      </div>

      <div className="card">
        <div className="flex gap-2">
          {(['open', 'closed', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${filter === f ? 'text-white' : 'text-theme-muted'}`}
              style={{ background: filter === f ? 'var(--accent)' : 'var(--bg-card-hover)' }}>
              {f}
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
                  const startDate = od.start_date ? new Date(od.start_date) : null;
                  const daysToStart = startDate ? Math.ceil((startDate.getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={r.id} className="border-t border-theme hover:bg-card-hover-surface transition-colors">
                      <td className="px-4 py-3"><Link href={`/tickets/${r.id}`} className="text-accent font-semibold hover:underline">{r.request_number}</Link></td>
                      <td className="px-4 py-3 text-theme-primary font-medium">{od.full_name || r.title}</td>
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDashboard } from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS } from '@itr/shared';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software', permission: 'Permission',
  access: 'Access', onboarding: 'Onboarding', other: 'Other',
};

export default function DashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === 'employee') { router.replace('/tickets'); return; }
    if (user && user.role === 'hr') { router.replace('/onboarding'); return; }
    if (!token) return;
    getDashboard(token).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token, user, router]);

  if (loading) return <div className="animate-fade-in-up"><div className="card"><p className="text-theme-muted">Loading...</p></div></div>;

  const isAdmin = user?.role === 'it_admin';

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-theme-primary">Dashboard</h1>
          <p className="text-sm text-theme-muted mt-1">Welcome back, {user?.name}</p>
        </div>
        <Link href="/tickets/new" className="btn-accent">New Ticket</Link>
      </div>

      {/* IT-admin headline cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="My Open" value={data?.myOpenTickets || 0} color="#3b82f6" href="/tickets?mine=true" />
          <StatCard label="Overdue" value={data?.overdueCount || 0} color="#ef4444" href="/tickets?overdue=true" />
          <StatCard label="Due This Week" value={data?.dueThisWeek || 0} color="#f59e0b" />
          <StatCard label="Unassigned" value={data?.unassignedOpen || 0} color="#a855f7" href="/tickets?assignee=unassigned" />
          <StatCard label="Pending IT Review" value={data?.pendingItReview || 0} color="#8b5cf6" href="/tickets?status=it_review" />
        </div>
      )}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard label="Pending Manager Review" value={data?.pendingManagerReview || 0} color="#f59e0b" />
          <StatCard label="Total Tickets" value={Object.values(data?.statusCounts || {}).reduce((a: number, b: any) => a + b, 0)} color="var(--accent)" />
        </div>
      )}

      {/* Status breakdown */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-4">Tickets by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data?.statusCounts || {}).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[status] || '#94a3b8' }} />
              <div>
                <p className="text-xs text-theme-muted">{STATUS_LABELS[status] || status}</p>
                <p className="text-lg font-bold text-theme-primary">{count as number}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type breakdown */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-4">Tickets by Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Object.entries(data?.typeCounts || {}).map(([type, count]) => (
            <div key={type} className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
              <p className="text-xs text-theme-muted">{TYPE_LABELS[type] || type}</p>
              <p className="text-2xl font-bold text-theme-primary">{count as number}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-4">Recent Tickets</h2>
        {data?.recent?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-table-head">
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">#</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Category</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Assignee</th>
                  <th className="text-left px-4 py-3 text-theme-muted font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.id} className="border-t border-theme hover:bg-card-hover-surface transition-colors">
                    <td className="px-4 py-3"><Link href={`/tickets/${r.id}`} className="text-accent font-semibold hover:underline">{r.request_number}</Link></td>
                    <td className="px-4 py-3 text-theme-primary font-medium">{r.title}</td>
                    <td className="px-4 py-3">{r.category_name && <span className="badge" style={{ background: `${r.category_color}20`, color: r.category_color }}>{r.category_name}</span>}</td>
                    <td className="px-4 py-3"><span className="badge" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>{STATUS_LABELS[r.status] || r.status}</span></td>
                    <td className="px-4 py-3 text-theme-secondary">{r.assignee_name || <span className="text-theme-faint italic">unassigned</span>}</td>
                    <td className="px-4 py-3 text-theme-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-theme-muted text-sm">No tickets yet. <Link href="/tickets/new" className="text-accent hover:underline">Create one</Link></p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const inner = (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-xs text-theme-muted font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-extrabold mt-1" style={{ color }}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block hover:translate-y-[-2px] transition-transform">{inner}</Link> : inner;
}

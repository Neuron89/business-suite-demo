'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getTickets, getCategories, getAssignableUsers } from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS, KANBAN_COLUMNS } from '@itr/shared';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software', permission: 'Permission',
  access: 'Access', onboarding: 'Onboarding', other: 'Other',
};
const URGENCY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

type ViewMode = 'table' | 'kanban';

export default function TicketsPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [view, setView] = useState<ViewMode>('table');
  const [categories, setCategories] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    getCategories(token).then(setCategories).catch(() => {});
    if (user?.role === 'it_admin') {
      getAssignableUsers(token).then(setAssignees).catch(() => {});
    }
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = { ...filters, limit: view === 'kanban' ? '100' : '20' };
    getTickets(token, params).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token, filters, view]);

  const tickets = data?.data || [];
  const isAdmin = user?.role === 'it_admin';

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-theme-primary">{isAdmin ? 'All Tickets' : 'My Tickets'}</h1>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-theme">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 text-sm font-semibold ${view === 'table' ? 'text-white' : 'text-theme-muted'}`}
              style={{ background: view === 'table' ? 'var(--accent)' : 'transparent' }}>Table</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm font-semibold ${view === 'kanban' ? 'text-white' : 'text-theme-muted'}`}
              style={{ background: view === 'kanban' ? 'var(--accent)' : 'transparent' }}>Board</button>
          </div>
          <Link href="/tickets/new" className="btn-accent">New Ticket</Link>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3">
          <select className="input-field w-auto" value={filters.status || ''} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-field w-auto" value={filters.type || ''} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-field w-auto" value={filters.category || ''} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {isAdmin && (
            <select className="input-field w-auto" value={filters.assignee || ''} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}>
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {isAdmin && (
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme cursor-pointer text-sm font-semibold text-theme-primary">
              <input type="checkbox" checked={filters.mine === 'true'} onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.checked ? 'true' : '' }))} />
              Assigned to me
            </label>
          )}
          {isAdmin && (
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme cursor-pointer text-sm font-semibold" style={{ color: filters.overdue === 'true' ? '#ef4444' : 'var(--text-primary)' }}>
              <input type="checkbox" checked={filters.overdue === 'true'} onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked ? 'true' : '' }))} />
              Overdue
            </label>
          )}
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanView tickets={tickets} loading={loading} />
      ) : (
        <TableView tickets={tickets} loading={loading} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function TableView({ tickets, loading, isAdmin }: { tickets: any[]; loading: boolean; isAdmin: boolean }) {
  return (
    <div className="card p-0">
      {loading ? (
        <div className="p-6"><p className="text-theme-muted">Loading...</p></div>
      ) : tickets.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-table-head">
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">#</th>
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Title</th>
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Category</th>
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Urgency</th>
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Status</th>
                {isAdmin && <th className="text-left px-4 py-3 text-theme-muted font-semibold">Assignee</th>}
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Due</th>
                <th className="text-left px-4 py-3 text-theme-muted font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((r) => {
                const overdue = r.due_date && new Date(r.due_date) < new Date() && !['completed', 'cancelled', 'denied'].includes(r.status);
                return (
                  <tr key={r.id} className="border-t border-theme hover:bg-card-hover-surface transition-colors">
                    <td className="px-4 py-3"><Link href={`/tickets/${r.id}`} className="text-accent font-semibold hover:underline">{r.request_number}</Link></td>
                    <td className="px-4 py-3 text-theme-primary font-medium">{r.title}</td>
                    <td className="px-4 py-3">{r.category_name && <span className="badge" style={{ background: `${r.category_color}20`, color: r.category_color }}>{r.category_name}</span>}</td>
                    <td className="px-4 py-3"><span className="badge" style={{ background: `${URGENCY_COLORS[r.urgency]}20`, color: URGENCY_COLORS[r.urgency] }}>{r.urgency}</span></td>
                    <td className="px-4 py-3"><span className="badge" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>{STATUS_LABELS[r.status] || r.status}</span></td>
                    {isAdmin && <td className="px-4 py-3 text-theme-secondary">{r.assignee_name || <span className="text-theme-faint italic">unassigned</span>}</td>}
                    <td className="px-4 py-3 text-sm" style={{ color: overdue ? '#ef4444' : 'var(--text-muted)' }}>
                      {r.due_date ? new Date(r.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-theme-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6"><p className="text-theme-muted">No tickets found.</p></div>
      )}
    </div>
  );
}

function KanbanView({ tickets, loading }: { tickets: any[]; loading: boolean }) {
  if (loading) return <div className="card"><p className="text-theme-muted">Loading...</p></div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = tickets.filter((t) => col.statuses.includes(t.status));
        return (
          <div key={col.key} className="card p-3" style={{ borderTop: `3px solid ${col.color}` }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</h3>
              <span className="badge" style={{ background: `${col.color}20`, color: col.color }}>{colTickets.length}</span>
            </div>
            <div className="space-y-2">
              {colTickets.map((t) => {
                const overdue = t.due_date && new Date(t.due_date) < new Date() && !['completed', 'cancelled', 'denied'].includes(t.status);
                return (
                  <Link key={t.id} href={`/tickets/${t.id}`} className="block p-3 rounded-lg transition-all hover:translate-y-[-1px]"
                    style={{ background: 'var(--bg-card-hover)', borderLeft: `3px solid ${URGENCY_COLORS[t.urgency]}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-accent">{t.request_number}</span>
                      {t.category_name && <span className="text-[10px] font-bold uppercase" style={{ color: t.category_color }}>{t.category_name}</span>}
                    </div>
                    <p className="text-sm font-semibold text-theme-primary line-clamp-2">{t.title}</p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-theme-muted truncate">{t.assignee_name || t.requester_name}</span>
                      {t.due_date && (
                        <span style={{ color: overdue ? '#ef4444' : 'var(--text-muted)' }}>
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {colTickets.length === 0 && <p className="text-xs text-theme-faint text-center py-4">no tickets</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  getDashboardSummary,
  createTodo,
  patchTodo,
  deleteTodo,
} from '@/lib/api';
import type { DashboardSummary } from '@/lib/dashboard-types';
import Widget from '@/components/dashboard/Widget';

const REFRESH_MS = 60_000; // refresh the whole composite every minute

export default function DashboardPage() {
  const { token, employee } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [todoText, setTodoText] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getDashboardSummary(token);
      setData(fresh);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Tick the local clock every second.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !todoText.trim()) return;
    await createTodo(token, { text: todoText.trim() });
    setTodoText('');
    refresh();
  }
  async function toggleTodo(id: number, done: boolean) {
    if (!token) return;
    await patchTodo(token, id, { done });
    refresh();
  }
  async function removeTodo(id: number) {
    if (!token) return;
    await deleteTodo(token, id);
    refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1224] via-[#0b1120] to-[#070d1a] text-slate-100 px-6 py-6">
      {/* Top bar */}
      <header className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80 font-bold">
            Acme Industries · Operations
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">
            {employee?.preferred_name || employee?.full_name?.split(' ')[0] || 'IT'} Command Center
          </h1>
          <p className="text-slate-400 mt-1">{now.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold border border-white/10"
          >
            Refresh
          </button>
          <Link
            href="/home"
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold border border-white/10"
          >
            Exit kiosk
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-6 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Counters strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Counter
          label="Open IT tickets"
          value={data?.widgets.it_tickets?.data?.open_count ?? '—'}
          color="#3b82f6"
        />
        <Counter
          label="Overdue"
          value={data?.widgets.it_tickets?.data?.overdue_count ?? '—'}
          color="#ef4444"
        />
        <Counter
          label="Network down"
          value={data?.widgets.unifi?.data?.disconnected ?? '—'}
          color="#f59e0b"
        />
        <Counter
          label="Monitors down"
          value={data?.widgets.uptime_kuma?.data?.down ?? '—'}
          color="#ef4444"
        />
        <Counter
          label="New suggestions"
          value={data?.widgets.counters.unread_suggestions ?? '—'}
          color="#8b5cf6"
        />
        <Counter
          label="Onboarding"
          value={
            data?.widgets.onboarding_queue?.state === 'ok'
              ? data.widgets.onboarding_queue.data?.length ?? 0
              : '—'
          }
          color="#22c55e"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {/* Calendar */}
        <Widget
          title="Today + Tomorrow"
          glyph="C"
          color="#22c55e"
          envelope={data?.widgets.calendar}
          span="md:col-span-2 xl:col-span-2"
        >
          <CalendarView events={data?.widgets.calendar.data || []} />
        </Widget>

        {/* Inbox */}
        <Widget
          title="Inbox"
          glyph="@"
          color="#3b82f6"
          envelope={data?.widgets.inbox}
          rightSlot={
            data?.widgets.inbox.state === 'ok' ? (
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold">
                {data.widgets.inbox.data?.filter((m) => !m.is_read).length || 0} unread
              </span>
            ) : null
          }
          span="md:col-span-2 xl:col-span-2"
        >
          <InboxView messages={data?.widgets.inbox.data || []} />
        </Widget>

        {/* IT tickets */}
        <Widget title="IT Tickets" glyph="T" color="#3b82f6" envelope={data?.widgets.it_tickets}>
          <TicketsView summary={data?.widgets.it_tickets.data} />
        </Widget>

        {/* UniFi */}
        <Widget
          title="UniFi Network"
          glyph="U"
          color="#06b6d4"
          envelope={data?.widgets.unifi}
          rightSlot={
            data?.widgets.unifi.state === 'ok' ? (
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold">
                {data.widgets.unifi.data?.connected}/{data.widgets.unifi.data?.total} up
              </span>
            ) : null
          }
        >
          <UnifiView summary={data?.widgets.unifi.data} />
        </Widget>

        {/* Uptime Kuma */}
        <Widget title="Uptime Monitors" glyph="K" color="#22c55e" envelope={data?.widgets.uptime_kuma}>
          <KumaView summary={data?.widgets.uptime_kuma.data} />
        </Widget>

        {/* System metrics */}
        <Widget title="Portal Server" glyph="S" color="#a855f7" envelope={data?.widgets.system_metrics}>
          <SystemView m={data?.widgets.system_metrics.data} />
        </Widget>

        {/* Proxmox */}
        <Widget title="Proxmox" glyph="P" color="#ef4444" envelope={data?.widgets.proxmox}>
          <ProxmoxView m={data?.widgets.proxmox.data} />
        </Widget>

        {/* Onboarding queue */}
        <Widget
          title="Onboarding Queue"
          glyph="O"
          color="#22c55e"
          envelope={data?.widgets.onboarding_queue}
        >
          <OnboardingView items={data?.widgets.onboarding_queue.data || []} />
        </Widget>

        {/* Todos */}
        <Widget
          title="My To-Do"
          glyph="✓"
          color="#f59e0b"
          envelope={{ state: 'ok', refreshed_at: data?.server_time || '' }}
          rightSlot={
            <span className="text-xs text-slate-400">
              {data?.widgets.todos.filter((t) => !t.done).length ?? 0} open
            </span>
          }
          span="md:col-span-2 xl:col-span-2"
        >
          <TodoView
            todos={data?.widgets.todos || []}
            onToggle={toggleTodo}
            onDelete={removeTodo}
            onAdd={addTodo}
            text={todoText}
            setText={setTodoText}
          />
        </Widget>

        {/* Grafana links */}
        <Widget title="Grafana" glyph="G" color="#fb923c" envelope={data?.widgets.grafana}>
          <GrafanaView dashboards={data?.widgets.grafana.data || []} />
        </Widget>
      </div>

      {data && (
        <footer className="mt-8 text-center text-xs text-slate-500">
          Auto-refreshing every {REFRESH_MS / 1000}s · last update{' '}
          {new Date(data.server_time).toLocaleTimeString()}
        </footer>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Counter({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="rounded-xl border border-white/5 bg-[#0f172a]/80 backdrop-blur px-4 py-3"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-3xl font-extrabold mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function CalendarView({ events }: { events: any[] }) {
  if (events.length === 0)
    return <p className="text-sm text-slate-500">Nothing scheduled. Enjoy.</p>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const groups = { today: [] as any[], tomorrow: [] as any[] };
  for (const e of events) {
    const start = new Date(e.start);
    if (start < tomorrow) groups.today.push(e);
    else groups.tomorrow.push(e);
  }
  return (
    <div className="space-y-4">
      {(['today', 'tomorrow'] as const).map((day) =>
        groups[day].length > 0 ? (
          <div key={day}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {day}
            </p>
            <ul className="space-y-1.5">
              {groups[day].map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="text-xs text-amber-300 font-mono w-20 flex-shrink-0">
                    {e.is_all_day
                      ? 'All day'
                      : new Date(e.start).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                  </span>
                  <span className="text-sm text-slate-100 truncate">{e.subject}</span>
                  {e.location && (
                    <span className="text-xs text-slate-500 truncate">· {e.location}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </div>
  );
}

function InboxView({ messages }: { messages: any[] }) {
  if (messages.length === 0)
    return <p className="text-sm text-slate-500">Inbox zero. (Or M365 not yet wired.)</p>;
  return (
    <ul className="space-y-2">
      {messages.slice(0, 6).map((m) => (
        <li key={m.id} className="flex items-start gap-3">
          <span
            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
              m.is_read ? 'bg-slate-700' : 'bg-blue-400'
            }`}
          />
          <a
            href={m.web_link}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-0 hover:bg-white/5 rounded-md p-1 -m-1"
          >
            <p
              className={`text-sm truncate ${
                m.is_read ? 'text-slate-400' : 'text-slate-100 font-semibold'
              }`}
            >
              {m.subject}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {m.from} · {new Date(m.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

function TicketsView({ summary }: { summary: any }) {
  if (!summary) return null;
  if (summary.recent.length === 0)
    return <p className="text-sm text-slate-500">No tickets need your attention.</p>;
  return (
    <ul className="space-y-1.5">
      {summary.recent.map((t: any) => {
        const overdue = t.due_date && new Date(t.due_date) < new Date();
        return (
          <li key={t.id} className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 rounded text-[0.65rem] font-bold uppercase ${
                overdue
                  ? 'bg-red-500/20 text-red-300'
                  : t.urgency === 'critical'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {overdue ? 'OVERDUE' : t.urgency}
            </span>
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-slate-100 truncate flex-1 hover:underline"
            >
              {t.title}
            </a>
            <span className="text-xs text-slate-500 font-mono">{t.request_number}</span>
          </li>
        );
      })}
    </ul>
  );
}

function UnifiView({ summary }: { summary: any }) {
  if (!summary) return null;
  if (summary.alerts.length > 0) {
    return (
      <ul className="space-y-1.5">
        {summary.alerts.slice(0, 6).map((a: any) => (
          <li key={a.id} className="text-sm text-red-300">
            <span className="text-xs uppercase font-bold mr-2 text-red-400">
              {a.severity}
            </span>
            {a.subject}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-3xl font-extrabold text-emerald-400">All good</div>
      <p className="text-sm text-slate-400">
        {summary.connected} of {summary.total} devices connected · 0 active alerts
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        {summary.devices.slice(0, 6).map((d: any) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                d.state === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span className="truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KumaView({ summary }: { summary: any }) {
  if (!summary) return null;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl font-extrabold text-emerald-400">{summary.up}</span>
        <span className="text-slate-500">/ {summary.total} up</span>
        {summary.down > 0 && (
          <span className="text-red-400 font-bold">· {summary.down} DOWN</span>
        )}
      </div>
      <ul className="space-y-1 text-xs">
        {summary.monitors.slice(0, 6).map((m: any) => (
          <li key={m.name} className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                m.status === 'up'
                  ? 'bg-emerald-400'
                  : m.status === 'down'
                    ? 'bg-red-400'
                    : 'bg-amber-400'
              }`}
            />
            <span className="truncate">{m.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SystemView({ m }: { m: any }) {
  if (!m) return null;
  const days = Math.floor(m.uptime_seconds / 86400);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-slate-400">Host</span>
        <span className="font-semibold">{m.hostname}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-slate-400">Uptime</span>
        <span className="font-semibold">{days}d</span>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-slate-400">Memory</span>
          <span className="font-semibold">
            {m.mem_used_gb.toFixed(1)} / {m.mem_total_gb.toFixed(1)} GB
          </span>
        </div>
        <div className="h-1.5 rounded bg-white/5 overflow-hidden">
          <div
            className="h-full bg-purple-400"
            style={{ width: `${m.mem_pct}%` }}
          />
        </div>
      </div>
      {m.disks.map((d: any) => (
        <div key={d.mount}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-slate-400">Disk {d.mount}</span>
            <span className="font-semibold">
              {d.used_gb.toFixed(0)} / {d.total_gb.toFixed(0)} GB
            </span>
          </div>
          <div className="h-1.5 rounded bg-white/5 overflow-hidden">
            <div
              className={`h-full ${d.pct > 85 ? 'bg-red-400' : 'bg-amber-400'}`}
              style={{ width: `${d.pct}%` }}
            />
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-500">
        Load {m.load_1m.toFixed(2)} / {m.load_5m.toFixed(2)} / {m.load_15m.toFixed(2)} on{' '}
        {m.cpu_count} cores
      </div>
    </div>
  );
}

function ProxmoxView({ m }: { m: any }) {
  if (!m) return null;
  return (
    <div className="space-y-3">
      {m.nodes.map((n: any) => (
        <div key={n.node}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-100">{n.node}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                n.status === 'online'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {n.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            CPU {n.cpu_pct.toFixed(0)}% · MEM {n.mem_used_gb.toFixed(1)}/{n.mem_total_gb.toFixed(0)}{' '}
            GB
          </p>
        </div>
      ))}
      <div className="border-t border-white/5 pt-2">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Guests</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {m.guests.slice(0, 8).map((g: any) => (
            <div key={g.vmid} className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  g.status === 'running' ? 'bg-emerald-400' : 'bg-slate-600'
                }`}
              />
              <span className="truncate">
                {g.vmid} {g.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingView({ items }: { items: any[] }) {
  if (items.length === 0)
    return <p className="text-sm text-slate-500">No pending onboarding tickets.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.id} className="text-sm">
          <a href={it.url} target="_blank" rel="noreferrer" className="hover:underline">
            <span className="font-semibold text-slate-100">{it.full_name}</span>
            <span className="text-slate-500"> · {it.status}</span>
            {it.start_date && (
              <span className="text-xs text-amber-300 ml-2">
                starts {new Date(it.start_date).toLocaleDateString()}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

function TodoView({
  todos,
  onToggle,
  onDelete,
  onAdd,
  text,
  setText,
}: {
  todos: any[];
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onAdd: (e: React.FormEvent) => void;
  text: string;
  setText: (s: string) => void;
}) {
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs doing?"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-sm font-bold hover:bg-amber-400"
        >
          Add
        </button>
      </form>
      <ul className="space-y-1 text-sm">
        {open.map((t) => (
          <li key={t.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={t.done}
              onChange={(e) => onToggle(t.id, e.target.checked)}
              className="accent-amber-500"
            />
            <span className="flex-1 text-slate-100">{t.text}</span>
            <button
              onClick={() => onDelete(t.id)}
              className="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
        {open.length === 0 && <li className="text-slate-500">Nothing on the list. Crush it.</li>}
        {done.length > 0 && (
          <>
            <li className="border-t border-white/5 my-2" />
            {done.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) => onToggle(t.id, e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="flex-1 text-slate-500 line-through">{t.text}</span>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </>
        )}
      </ul>
    </div>
  );
}

function GrafanaView({ dashboards }: { dashboards: any[] }) {
  if (dashboards.length === 0)
    return <p className="text-sm text-slate-500">No starred Grafana dashboards.</p>;
  return (
    <ul className="space-y-1.5">
      {dashboards.slice(0, 8).map((d) => (
        <li key={d.uid}>
          <a
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-100 hover:text-amber-400 hover:underline truncate block"
          >
            {d.title}
            {d.folder && <span className="text-xs text-slate-500"> · {d.folder}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

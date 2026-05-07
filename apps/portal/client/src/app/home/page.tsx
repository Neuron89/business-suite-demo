'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { HomeFeed, ModuleTile, PortalTask, PortalAlert } from '@portal/shared';
import { useAuth } from '@/lib/auth-context';
import { getHomeFeed, getSsoRedirect } from '@/lib/api';
import PortalShell from '@/components/layout/PortalShell';
import Banner from '@/components/Banner';

export default function HomePage() {
  const { token, employee, loading: authLoading } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !employee) {
      router.replace('/login');
      return;
    }
    if (employee.must_reset) {
      router.replace('/set-password');
      return;
    }
    getHomeFeed(token)
      .then(setFeed)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token, employee, authLoading, router]);

  if (authLoading || loading) {
    return (
      <PortalShell>
        <div className="card animate-fade-in-up">
          <p className="text-theme-muted">Loading…</p>
        </div>
      </PortalShell>
    );
  }
  if (error) {
    return (
      <PortalShell>
        <div className="card animate-fade-in-up">
          <h1 className="text-xl font-bold text-red-500">Couldn't load your home feed</h1>
          <p className="text-sm text-theme-muted mt-2">{error}</p>
        </div>
      </PortalShell>
    );
  }
  if (!feed) return null;

  return (
    <PortalShell>
      <div className="animate-fade-in-up space-y-8">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-theme-primary">{feed.greeting}</h1>
            <p className="text-sm text-theme-muted mt-1">
              {feed.tiles.length === 0
                ? "You haven't been granted access to any systems yet. Talk to IT."
                : 'Pick a system or jump straight to one of your open tasks below.'}
            </p>
          </div>
          {feed.is_admin && (
            <Link href="/admin" className="btn-secondary">
              Admin tools
            </Link>
          )}
        </header>

        {token && <Banner token={token} />}

        {feed.alerts.length > 0 && <AlertBanner alerts={feed.alerts} />}

        {feed.tiles.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-theme-primary mb-3">Your systems</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {feed.tiles.map((tile) => (
                <SystemTile key={tile.key} tile={tile} token={token!} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-theme-primary">My tasks</h2>
            <span className="text-xs text-theme-faint">
              Last refreshed {new Date(feed.last_refreshed).toLocaleTimeString()}
            </span>
          </div>
          {feed.tasks.length === 0 ? (
            <div className="card text-sm text-theme-muted">Nothing on your plate. Nice.</div>
          ) : (
            <ul className="space-y-2">
              {feed.tasks.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function SystemTile({ tile, token }: { tile: ModuleTile; token: string }) {
  const isUnconfigured = tile.url === '#';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSsoClick(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    // Pop-up blockers reject window.open() that happens after an await, so we
    // open a placeholder tab synchronously inside the click handler and
    // navigate it once the portal mints the token. Note: do NOT pass
    // 'noopener' — that makes window.open return null and we lose the handle.
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
      setErr('Pop-up blocked. Allow pop-ups for this site and click again.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Pass empty `next` so each downstream app's /sso page picks its own
      // default landing route (e.g. MOC → /dashboard, IT → /, etc.).
      const { redirect_url } = await getSsoRedirect(token, tile.key, '');
      newTab.location.href = redirect_url;
    } catch (ex) {
      newTab.close();
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inner = (
    <div
      className="card hover:translate-y-[-2px] transition-transform h-full flex flex-col"
      style={{ borderTop: `4px solid ${tile.color}` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-extrabold text-lg"
          style={{ background: tile.color }}
        >
          {tile.glyph}
        </div>
        {tile.open_task_count > 0 && (
          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {tile.open_task_count} open
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-bold text-theme-primary">{tile.label}</h3>
      <p className="text-xs text-theme-muted mt-1 flex-1">{tile.description}</p>
      {isUnconfigured && (
        <p className="text-xs text-amber-600 mt-3 font-medium">
          Link not configured yet — add {tile.key.toUpperCase()}_URL to portal env.
        </p>
      )}
      {busy && <p className="text-xs text-theme-muted mt-2">Signing in…</p>}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );

  if (isUnconfigured) return <div>{inner}</div>;
  // External tiles (SharePoint, Outlook) are plain links. Internal tiles must
  // never use a real <a target="_blank">: a stray default-action open would
  // race the SSO window.open and land the user on the downstream app's bare
  // root, which redirects to /login.
  if (tile.external) {
    return (
      <a href={tile.url} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={handleSsoClick}
      className="block w-full text-left"
      disabled={busy}
    >
      {inner}
    </button>
  );
}

function severityClasses(s: string) {
  if (s === 'critical') return 'border-l-4 border-red-500';
  if (s === 'warning') return 'border-l-4 border-amber-500';
  return 'border-l-4 border-slate-300 dark:border-slate-700';
}

function TaskItem({ task }: { task: PortalTask }) {
  return (
    <li
      className={`card flex items-start justify-between gap-4 ${severityClasses(task.severity)}`}
    >
      <div className="min-w-0">
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="text-theme-primary font-semibold hover:text-accent break-words"
        >
          {task.title}
        </a>
        <p className="text-xs text-theme-muted mt-1">
          <span className="uppercase font-bold tracking-wider mr-2">{task.module}</span>
          {task.subtitle}
        </p>
      </div>
      <div className="text-right text-xs text-theme-muted shrink-0">
        {task.due_date ? <p>Due {new Date(task.due_date).toLocaleDateString()}</p> : null}
      </div>
    </li>
  );
}

function AlertBanner({ alerts }: { alerts: PortalAlert[] }) {
  return (
    <div className="card border-l-4 border-red-500">
      <h2 className="text-base font-bold text-theme-primary">Alerts</h2>
      <ul className="mt-2 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="text-sm text-theme-secondary">
            <span className="uppercase font-bold tracking-wider mr-2 text-red-500">
              {a.module}
            </span>
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                {a.message}
              </a>
            ) : (
              a.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

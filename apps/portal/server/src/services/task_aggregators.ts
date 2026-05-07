/**
 * Task aggregators: each downstream system has a function that, given an
 * email, returns the list of items the user should see on their portal home.
 *
 * These are intentionally defensive — if the upstream system is down or not
 * yet wired up, we log and return an empty list rather than blowing up the
 * homepage.
 */
import type { ModuleKey, PortalTask, PortalAlert, TaskSeverity } from '@portal/shared';

interface AggregateResult {
  tasks: PortalTask[];
  alerts: PortalAlert[];
}

const EMPTY: AggregateResult = { tasks: [], alerts: [] };

function severityFromDueDate(due: string | null | undefined): TaskSeverity {
  if (!due) return 'info';
  const d = new Date(due);
  if (isNaN(d.getTime())) return 'info';
  const now = new Date();
  if (d < now) return 'critical';
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  if (days < 3) return 'warning';
  return 'info';
}

type AuthHeaderStyle = 'bearer' | 'integration-key';

async function fetchJson(
  url: string,
  token: string | undefined,
  style: AuthHeaderStyle = 'bearer'
): Promise<any | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      if (style === 'integration-key') {
        headers['X-Integration-Key'] = token;
      } else {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    const resp = await fetch(url, {
      headers,
      // 6s timeout via AbortController
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) {
      console.warn(`[aggregators] ${url} returned ${resp.status}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.warn(`[aggregators] ${url} failed:`, (err as Error).message);
    return null;
  }
}

export async function fetchItRequestTasks(email: string): Promise<AggregateResult> {
  const base = process.env.IT_REQUEST_API_BASE;
  const token = process.env.IT_REQUEST_SERVICE_TOKEN;
  const uiBase = process.env.IT_REQUEST_URL || 'http://localhost:3020';
  if (!base) return EMPTY;

  const data = await fetchJson(
    `${base.replace(/\/$/, '')}/api/integration/portal-tasks?email=${encodeURIComponent(email)}`,
    token,
    'bearer'
  );
  if (!data) return EMPTY;

  const tasks: PortalTask[] = (data.tickets ?? []).map((t: any) => ({
    id: `it:${t.id}`,
    module: 'it' as ModuleKey,
    title: t.title || `Ticket ${t.request_number}`,
    url: `${uiBase}/tickets/${t.id}`,
    due_date: t.due_date ?? null,
    status: t.status ?? null,
    severity: severityFromDueDate(t.due_date),
    subtitle: t.request_number ? `${t.request_number} · ${t.status}` : t.status,
  }));

  return { tasks, alerts: data.alerts ?? [] };
}

export async function fetchMocTasks(email: string): Promise<AggregateResult> {
  const base = process.env.MOC_API_BASE;
  const token = process.env.MOC_SERVICE_TOKEN;
  const uiBase = process.env.MOC_URL || 'http://localhost:3000';
  if (!base) return EMPTY;

  const data = await fetchJson(
    `${base.replace(/\/$/, '')}/api/integration/portal-tasks?email=${encodeURIComponent(email)}`,
    token,
    'integration-key'
  );
  if (!data) return EMPTY;

  const tasks: PortalTask[] = (data.items ?? []).map((t: any) => ({
    id: `moc:${t.kind}:${t.id}`,
    module: 'moc' as ModuleKey,
    title: t.title,
    url: t.url ? (t.url.startsWith('http') ? t.url : `${uiBase}${t.url}`) : `${uiBase}/`,
    due_date: t.due_date ?? null,
    status: t.status ?? null,
    severity: t.severity ?? severityFromDueDate(t.due_date),
    subtitle: t.subtitle ?? null,
  }));

  return { tasks, alerts: data.alerts ?? [] };
}

export async function fetchAllTasks(email: string): Promise<AggregateResult> {
  const results = await Promise.allSettled([
    fetchItRequestTasks(email),
    fetchMocTasks(email),
  ]);

  const tasks: PortalTask[] = [];
  const alerts: PortalAlert[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      tasks.push(...r.value.tasks);
      alerts.push(...r.value.alerts);
    }
  }

  // Sort: critical first, then by due date asc (nulls last).
  const sevRank = { critical: 0, warning: 1, info: 2 } as const;
  tasks.sort((a, b) => {
    const sa = sevRank[a.severity] - sevRank[b.severity];
    if (sa !== 0) return sa;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return { tasks, alerts };
}

/**
 * Uptime Kuma — pulls monitor status via its public status-page JSON endpoint.
 *
 * Two flavors of integration:
 *   - Set UPTIME_KUMA_STATUS_URL to the JSON of a public status page:
 *     `https://status.example.com/api/status-page/<slug>` etc. No token.
 *   - Or set UPTIME_KUMA_BASE + UPTIME_KUMA_TOKEN for the API v1 endpoints
 *     (left as a TODO — Kuma's auth API is socket.io-based and not great for
 *     polling; the status page route is the recommended scrape target).
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

export interface UptimeMonitor {
  name: string;
  status: 'up' | 'down' | 'pending' | 'unknown';
  url?: string | null;
  uptime_24h?: number | null;
}

export interface UptimeSummary {
  total: number;
  up: number;
  down: number;
  pending: number;
  monitors: UptimeMonitor[];
}

function statusFromKuma(value: number): UptimeMonitor['status'] {
  // Kuma status: 0=down, 1=up, 2=pending, 3=maintenance
  if (value === 1) return 'up';
  if (value === 0) return 'down';
  if (value === 2) return 'pending';
  return 'unknown';
}

export async function fetchUptimeKuma(): Promise<WidgetEnvelope<UptimeSummary>> {
  const url = process.env.UPTIME_KUMA_STATUS_URL;
  if (!url) {
    return notConfigured('Set UPTIME_KUMA_STATUS_URL to the JSON of a Kuma status page.');
  }
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return err(`Kuma returned ${resp.status}`);
    const json: any = await resp.json();

    // Heuristic for the kuma "heartbeat" API JSON shape — different deployments
    // ship slightly different keys. We try the common ones.
    const monitorList = json.publicGroupList?.flatMap((g: any) => g.monitorList || []) ||
      json.monitorList ||
      json.monitors ||
      [];
    const heartbeats = json.heartbeatList || {};

    const monitors: UptimeMonitor[] = monitorList.map((m: any) => {
      const id = m.id ?? m.monitorID ?? m.monitor_id;
      const recent = (heartbeats[id] || []).slice(-1)[0];
      return {
        name: m.name || `monitor ${id}`,
        url: m.url || null,
        status: statusFromKuma(recent?.status ?? -1),
        uptime_24h: json.uptimeList?.[`${id}_24`] ?? null,
      };
    });

    const summary: UptimeSummary = {
      total: monitors.length,
      up: monitors.filter((m) => m.status === 'up').length,
      down: monitors.filter((m) => m.status === 'down').length,
      pending: monitors.filter((m) => m.status === 'pending').length,
      monitors,
    };
    return ok(summary);
  } catch (e) {
    return err((e as Error).message);
  }
}

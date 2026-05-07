/**
 * Grafana — for now we just proxy a list of "starred" or favorited dashboards
 * for quick links. When the user provides a token, we can also embed panel
 * snapshots via /render/d-solo URLs. Iframe embeds work without the proxy as
 * long as the user is logged in to Grafana in the same browser.
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
  folder?: string | null;
  /** Optional pre-rendered panel image URL (requires a service token). */
  preview_url?: string | null;
}

export async function fetchGrafanaDashboards(): Promise<WidgetEnvelope<GrafanaDashboard[]>> {
  const base = (process.env.GRAFANA_URL || '').replace(/\/$/, '');
  const token = process.env.GRAFANA_TOKEN;
  if (!base) {
    return notConfigured('Set GRAFANA_URL (and optionally GRAFANA_TOKEN) for dashboard links.');
  }
  if (!token) {
    return ok([
      {
        uid: 'home',
        title: 'Grafana home',
        url: base,
        folder: null,
      },
    ]);
  }
  try {
    const resp = await fetch(`${base}/api/search?starred=true`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return err(`Grafana returned ${resp.status}`);
    const list = (await resp.json()) as any[];
    const dashboards: GrafanaDashboard[] = list.map((d) => ({
      uid: d.uid,
      title: d.title,
      url: `${base}${d.url}`,
      folder: d.folderTitle || null,
    }));
    return ok(dashboards);
  } catch (e) {
    return err((e as Error).message);
  }
}

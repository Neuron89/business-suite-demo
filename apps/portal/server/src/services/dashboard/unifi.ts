/**
 * UniFi Network Controller — polls the controller for device + alarm state.
 *
 * Auth model: UniFi controllers (UDM/UDM-Pro/Cloud Key) use cookie-based
 * auth — POST /api/auth/login with {username, password} to get a session
 * cookie, then subsequent calls reuse it. We don't bother caching the
 * cookie across processes; just relogin per fetch.
 *
 * UniFi Access (separate product): see ../employee_tech_documentation —
 * it already maps doors/policies. Not duplicated here.
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

export interface UnifiDevice {
  name: string;
  type: 'ap' | 'switch' | 'gateway' | 'camera' | 'other';
  state: 'connected' | 'disconnected' | 'pending' | 'unknown';
  model?: string | null;
  ip?: string | null;
  last_seen?: string | null;
}

export interface UnifiSummary {
  site_name: string;
  total: number;
  connected: number;
  disconnected: number;
  alerts: { id: string; subject: string; severity: string; created_at: string }[];
  devices: UnifiDevice[];
}

function classifyType(deviceType: string): UnifiDevice['type'] {
  const t = deviceType?.toLowerCase() || '';
  if (t.includes('uap')) return 'ap';
  if (t.includes('usw')) return 'switch';
  if (t.includes('ugw') || t.includes('udm')) return 'gateway';
  if (t.includes('uvc') || t.includes('camera')) return 'camera';
  return 'other';
}

export async function fetchUnifi(): Promise<WidgetEnvelope<UnifiSummary>> {
  const base = (process.env.UNIFI_BASE_URL || '').replace(/\/$/, '');
  const username = process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_PASSWORD;
  const site = process.env.UNIFI_SITE || 'default';
  if (!base || !username || !password) {
    return notConfigured(
      'Set UNIFI_BASE_URL, UNIFI_USERNAME, UNIFI_PASSWORD (and optionally UNIFI_SITE).'
    );
  }
  try {
    // Login. UDM/UDM-Pro path is /api/auth/login; older controller is /api/login.
    const loginPath = process.env.UNIFI_LOGIN_PATH || '/api/auth/login';
    const loginResp = await fetch(`${base}${loginPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      // self-signed certs are common on UDMs — if needed, set NODE_TLS_REJECT_UNAUTHORIZED=0 in env
      signal: AbortSignal.timeout(8000),
    });
    if (!loginResp.ok) return err(`UniFi login ${loginResp.status}`);
    const cookies = loginResp.headers.get('set-cookie') || '';

    const headers = { Cookie: cookies, Accept: 'application/json' };
    // UDM uses /proxy/network/api/s/<site>/...; older controllers use /api/s/<site>/...
    const apiPrefix = process.env.UNIFI_API_PREFIX || '/proxy/network/api';

    const [devicesResp, alarmsResp] = await Promise.all([
      fetch(`${base}${apiPrefix}/s/${site}/stat/device-basic`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${base}${apiPrefix}/s/${site}/stat/alarm`, { headers, signal: AbortSignal.timeout(8000) }),
    ]);

    if (!devicesResp.ok) return err(`UniFi devices ${devicesResp.status}`);
    const devicesJson = (await devicesResp.json()) as any;
    const alarmsJson = alarmsResp.ok ? ((await alarmsResp.json()) as any) : { data: [] };

    const devices: UnifiDevice[] = (devicesJson.data || []).map((d: any) => ({
      name: d.name || d.hostname || d.mac || 'unknown',
      type: classifyType(d.type),
      state: d.state === 1 ? 'connected' : d.state === 0 ? 'disconnected' : 'pending',
      model: d.model || null,
      ip: d.ip || null,
      last_seen: d.last_seen ? new Date(d.last_seen * 1000).toISOString() : null,
    }));

    const alerts = (alarmsJson.data || [])
      .filter((a: any) => !a.archived)
      .slice(0, 20)
      .map((a: any) => ({
        id: a._id,
        subject: a.subsystem ? `${a.subsystem}: ${a.msg || a.key}` : a.msg || a.key,
        severity: a.severity || 'info',
        created_at: a.time ? new Date(a.time).toISOString() : new Date().toISOString(),
      }));

    return ok({
      site_name: site,
      total: devices.length,
      connected: devices.filter((d) => d.state === 'connected').length,
      disconnected: devices.filter((d) => d.state === 'disconnected').length,
      alerts,
      devices,
    });
  } catch (e) {
    return err((e as Error).message);
  }
}

/**
 * Proxmox VE — host + guest stats. Uses an API token (recommended) to
 * authenticate. Falls back to "not configured" when env is missing.
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

export interface ProxmoxNode {
  node: string;
  status: 'online' | 'offline' | 'unknown';
  cpu_pct: number;
  mem_used_gb: number;
  mem_total_gb: number;
  uptime_seconds: number;
}

export interface ProxmoxGuest {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'paused' | 'unknown';
  type: 'qemu' | 'lxc';
  node: string;
  uptime_seconds?: number | null;
  cpu_pct?: number | null;
  mem_used_gb?: number | null;
}

export interface ProxmoxSummary {
  cluster_name?: string | null;
  nodes: ProxmoxNode[];
  guests: ProxmoxGuest[];
}

export async function fetchProxmox(): Promise<WidgetEnvelope<ProxmoxSummary>> {
  const base = (process.env.PROXMOX_BASE_URL || '').replace(/\/$/, '');
  const tokenId = process.env.PROXMOX_TOKEN_ID; // e.g. root@pam!dashboard
  const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
  if (!base || !tokenId || !tokenSecret) {
    return notConfigured(
      'Set PROXMOX_BASE_URL, PROXMOX_TOKEN_ID (e.g. root@pam!dashboard), PROXMOX_TOKEN_SECRET.'
    );
  }
  const headers = {
    Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
    Accept: 'application/json',
  };
  try {
    const resp = await fetch(`${base}/api2/json/cluster/resources`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return err(`proxmox ${resp.status}: ${await resp.text()}`);
    const json = (await resp.json()) as any;
    const items: any[] = json.data || [];

    const nodes: ProxmoxNode[] = items
      .filter((i) => i.type === 'node')
      .map((i) => ({
        node: i.node,
        status: (i.status as any) || 'unknown',
        cpu_pct: (i.cpu || 0) * 100,
        mem_used_gb: (i.mem || 0) / 1_073_741_824,
        mem_total_gb: (i.maxmem || 0) / 1_073_741_824,
        uptime_seconds: i.uptime || 0,
      }));

    const guests: ProxmoxGuest[] = items
      .filter((i) => i.type === 'qemu' || i.type === 'lxc')
      .map((i) => ({
        vmid: i.vmid,
        name: i.name || `${i.type}-${i.vmid}`,
        status: (i.status as any) || 'unknown',
        type: i.type,
        node: i.node,
        uptime_seconds: i.uptime || null,
        cpu_pct: i.cpu != null ? i.cpu * 100 : null,
        mem_used_gb: i.mem != null ? i.mem / 1_073_741_824 : null,
      }));

    return ok({ cluster_name: process.env.PROXMOX_CLUSTER_NAME || null, nodes, guests });
  } catch (e) {
    return err((e as Error).message);
  }
}

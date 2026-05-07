/**
 * Local server stats — runs shell commands on the same host the portal
 * itself is running on. No creds needed, just `df`, `free`, `uptime`,
 * `loadavg`. Always available, always cheap.
 */
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
import os from 'os';
import { ok, err, type WidgetEnvelope } from './types';

const exec = promisify(_exec);

export interface SystemMetrics {
  hostname: string;
  uptime_seconds: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  cpu_count: number;
  mem_total_gb: number;
  mem_used_gb: number;
  mem_pct: number;
  disks: { mount: string; used_gb: number; total_gb: number; pct: number }[];
}

export async function fetchSystemMetrics(): Promise<WidgetEnvelope<SystemMetrics>> {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loads = os.loadavg();
    const cpus = os.cpus().length;
    const hostname = os.hostname();
    const uptime = Math.floor(os.uptime());

    // df -h for disk usage (filter to /, /home, and big mounts)
    const { stdout: dfOut } = await exec('df -B1 --output=target,used,size /');
    const lines = dfOut.trim().split('\n').slice(1);
    const disks: SystemMetrics['disks'] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const used = parseInt(parts[1]);
      const total = parseInt(parts[2]);
      if (!Number.isFinite(used) || !Number.isFinite(total) || total === 0) continue;
      disks.push({
        mount: parts[0],
        used_gb: used / 1_073_741_824,
        total_gb: total / 1_073_741_824,
        pct: (used / total) * 100,
      });
    }

    return ok({
      hostname,
      uptime_seconds: uptime,
      load_1m: loads[0],
      load_5m: loads[1],
      load_15m: loads[2],
      cpu_count: cpus,
      mem_total_gb: totalMem / 1_073_741_824,
      mem_used_gb: (totalMem - freeMem) / 1_073_741_824,
      mem_pct: ((totalMem - freeMem) / totalMem) * 100,
      disks,
    });
  } catch (e) {
    return err((e as Error).message);
  }
}

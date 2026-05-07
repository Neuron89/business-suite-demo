/**
 * Mirrors the WidgetEnvelope shape from the server. Kept here separately
 * because the dashboard is the only consumer and we don't want to bloat
 * the cross-app shared package with widget internals.
 */
export type WidgetState = 'ok' | 'not_configured' | 'error';

export interface WidgetEnvelope<T = unknown> {
  state: WidgetState;
  message?: string;
  data?: T;
  refreshed_at: string;
}

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

export interface UnifiDevice {
  name: string;
  type: 'ap' | 'switch' | 'gateway' | 'camera' | 'other';
  state: 'connected' | 'disconnected' | 'pending' | 'unknown';
  model?: string | null;
  ip?: string | null;
}

export interface UnifiSummary {
  site_name: string;
  total: number;
  connected: number;
  disconnected: number;
  alerts: { id: string; subject: string; severity: string; created_at: string }[];
  devices: UnifiDevice[];
}

export interface MailMessage {
  id: string;
  subject: string;
  from: string;
  preview: string;
  received_at: string;
  is_read: boolean;
  web_link: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string | null;
  is_all_day: boolean;
  organizer?: string | null;
}

export interface ProxmoxNode {
  node: string;
  status: string;
  cpu_pct: number;
  mem_used_gb: number;
  mem_total_gb: number;
  uptime_seconds: number;
}

export interface ProxmoxGuest {
  vmid: number;
  name: string;
  status: string;
  type: 'qemu' | 'lxc';
  node: string;
  cpu_pct?: number | null;
  mem_used_gb?: number | null;
}

export interface ProxmoxSummary {
  cluster_name?: string | null;
  nodes: ProxmoxNode[];
  guests: ProxmoxGuest[];
}

export interface DashboardTicket {
  id: number;
  request_number: string;
  title: string;
  status: string;
  urgency: string;
  due_date: string | null;
  category_name?: string | null;
  url: string;
}

export interface DashboardTicketSummary {
  open_count: number;
  overdue_count: number;
  unassigned_count: number;
  recent: DashboardTicket[];
}

export interface DashboardOnboardingItem {
  id: number;
  request_number: string;
  full_name: string;
  start_date: string | null;
  manager_name: string | null;
  status: string;
  url: string;
}

export interface Todo {
  id: number;
  text: string;
  done: boolean;
  priority: 'low' | 'med' | 'high';
  due_date: string | null;
  sort_order: number;
}

export interface DashboardSummary {
  server_time: string;
  user: { email: string; full_name: string; portal_role: string };
  widgets: {
    system_metrics: WidgetEnvelope<SystemMetrics>;
    uptime_kuma: WidgetEnvelope<UptimeSummary>;
    grafana: WidgetEnvelope<{ uid: string; title: string; url: string; folder?: string | null }[]>;
    unifi: WidgetEnvelope<UnifiSummary>;
    inbox: WidgetEnvelope<MailMessage[]>;
    calendar: WidgetEnvelope<CalendarEvent[]>;
    proxmox: WidgetEnvelope<ProxmoxSummary>;
    it_tickets: WidgetEnvelope<DashboardTicketSummary>;
    todos: Todo[];
    onboarding_queue: WidgetEnvelope<DashboardOnboardingItem[]>;
    counters: { unread_suggestions: number; announcements_requiring_ack: number };
  };
}

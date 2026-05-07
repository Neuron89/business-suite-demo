/**
 * IT Tickets summary for the dashboard. Reuses the integration endpoint we
 * already added to it_request_system.
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

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

export async function fetchItTickets(email: string): Promise<WidgetEnvelope<DashboardTicketSummary>> {
  const base = process.env.IT_REQUEST_API_BASE;
  const token = process.env.IT_REQUEST_SERVICE_TOKEN;
  const uiBase = process.env.IT_REQUEST_URL || 'http://localhost:3020';
  if (!base || !token) {
    return notConfigured(
      'Set IT_REQUEST_API_BASE + IT_REQUEST_SERVICE_TOKEN to wire the IT ticket widget.'
    );
  }
  try {
    const resp = await fetch(
      `${base.replace(/\/$/, '')}/api/integration/portal-tasks?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) return err(`IT request ${resp.status}`);
    const data = (await resp.json()) as any;
    const tickets: any[] = data.tickets || [];
    const now = Date.now();
    const summary: DashboardTicketSummary = {
      open_count: tickets.length,
      overdue_count: tickets.filter((t) => t.due_date && new Date(t.due_date).getTime() < now).length,
      unassigned_count: tickets.filter((t) => !t.assignee_id).length,
      recent: tickets.slice(0, 8).map((t) => ({
        id: t.id,
        request_number: t.request_number,
        title: t.title,
        status: t.status,
        urgency: t.urgency,
        due_date: t.due_date || null,
        category_name: t.category_name || null,
        url: `${uiBase}/tickets/${t.id}`,
      })),
    };
    return ok(summary);
  } catch (e) {
    return err((e as Error).message);
  }
}

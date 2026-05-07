/**
 * IT Dashboard composite endpoint.
 *
 * Fans out in parallel to every integration. The widget envelope shape
 * (state: 'ok' | 'not_configured' | 'error') is identical across widgets,
 * so the frontend can render every cell the same way.
 *
 * Designed so that when an upstream integration is missing creds, the
 * widget gracefully shows a "configure me" placeholder rather than the
 * whole page failing.
 */
import { Router } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { fetchSystemMetrics } from '../services/dashboard/system_metrics';
import { fetchUptimeKuma } from '../services/dashboard/uptime_kuma';
import { fetchGrafanaDashboards } from '../services/dashboard/grafana';
import { fetchUnifi } from '../services/dashboard/unifi';
import { fetchInbox, fetchCalendar } from '../services/dashboard/m365';
import { fetchProxmox } from '../services/dashboard/proxmox';
import { fetchItTickets } from '../services/dashboard/it_tickets';

const router = Router();

router.get('/summary', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const email = req.user!.email;

  const [
    systemMetrics,
    uptimeKuma,
    grafana,
    unifi,
    inbox,
    calendar,
    proxmox,
    itTickets,
    todos,
    onboardingQueue,
    unreadSuggestions,
    pendingMocFromTickets,
  ] = await Promise.all([
    fetchSystemMetrics(),
    fetchUptimeKuma(),
    fetchGrafanaDashboards(),
    fetchUnifi(),
    fetchInbox(),
    fetchCalendar(),
    fetchProxmox(),
    fetchItTickets(email),
    db('todos')
      .where({ owner_email: email })
      .orderBy('done', 'asc')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'desc')
      .limit(20),
    fetchOnboardingQueue(),
    db('suggestions').where({ status: 'new' }).count<{ count: string }[]>('id as count').first(),
    db('announcements')
      .where('require_ack', true)
      .andWhere((qb) => qb.whereNull('expires_at').orWhere('expires_at', '>', db.fn.now()))
      .count<{ count: string }[]>('id as count')
      .first(),
  ]);

  res.json({
    server_time: new Date().toISOString(),
    user: { email, full_name: req.user!.full_name, portal_role: req.user!.portal_role },
    widgets: {
      system_metrics: systemMetrics,
      uptime_kuma: uptimeKuma,
      grafana,
      unifi,
      inbox,
      calendar,
      proxmox,
      it_tickets: itTickets,
      todos,
      onboarding_queue: onboardingQueue,
      counters: {
        unread_suggestions: parseInt((unreadSuggestions?.count as string) || '0'),
        announcements_requiring_ack: parseInt((pendingMocFromTickets?.count as string) || '0'),
      },
    },
  });
});

async function fetchOnboardingQueue() {
  const base = process.env.IT_REQUEST_API_BASE;
  const token = process.env.IT_REQUEST_SERVICE_TOKEN;
  const uiBase = process.env.IT_REQUEST_URL || 'http://localhost:3020';
  if (!base || !token) {
    return {
      state: 'not_configured' as const,
      message: 'IT_REQUEST_API_BASE not configured',
      refreshed_at: new Date().toISOString(),
    };
  }
  try {
    const resp = await fetch(
      `${base.replace(/\/$/, '')}/api/integration/onboarding-queue`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) {
      return {
        state: 'error' as const,
        message: `IT request ${resp.status}`,
        refreshed_at: new Date().toISOString(),
      };
    }
    const data = (await resp.json()) as any;
    return {
      state: 'ok' as const,
      data: (data.tickets || []).slice(0, 6).map((t: any) => ({
        id: t.id,
        request_number: t.request_number,
        full_name: t.onboarding_details?.full_name || t.title,
        start_date: t.onboarding_details?.start_date || null,
        manager_name: t.manager_name || null,
        status: t.status,
        url: `${uiBase}/tickets/${t.id}`,
      })),
      refreshed_at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      state: 'error' as const,
      message: (e as Error).message,
      refreshed_at: new Date().toISOString(),
    };
  }
}

export default router;

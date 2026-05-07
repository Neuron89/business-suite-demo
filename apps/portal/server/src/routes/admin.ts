import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listEmployees, lookupEmployee, patchAccess } from '../services/directory';
import { updateAccessSchema } from '@portal/shared';
import db from '../db/connection';

const router = Router();

/**
 * Admin-only: list everyone in the directory with their portal role + access
 * flags. Used by the access management page.
 */
router.get('/employees', authenticate, authorize('admin', 'hr'), async (_req, res) => {
  try {
    const all = await listEmployees();
    // Access grid is for real, active employees only — drop service /
    // shared-mailbox / third-party / admin-special accounts AND anyone
    // whose status isn't 'active' (offboarded users shouldn't appear).
    const employees = all.filter(
      (e) => e.status === 'active' && e.account_type === 'domain'
    );
    res.json({ employees });
  } catch (err) {
    console.error('[admin/employees] directory error:', err);
    res.status(503).json({ message: 'Directory unavailable.' });
  }
});

router.patch('/employees/access', authenticate, authorize('admin'), async (req, res) => {
  const parsed = updateAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }

  try {
    const updated = await patchAccess(parsed.data.email, {
      access: parsed.data.access,
      portal_role: parsed.data.portal_role,
    });
    await db('portal_audit_log').insert({
      email: req.user!.email,
      action: 'access_updated',
      detail: { target: parsed.data.email, change: parsed.data },
    });
    res.json({ employee: updated });
  } catch (err) {
    console.error('[admin/employees/access] error:', err);
    res.status(503).json({ message: 'Directory unavailable.' });
  }
});

/**
 * Admin/HR onboarding queue: pulls pending onboarding tickets from the IT
 * request system. If the upstream API isn't reachable, returns an empty list
 * with an explanatory note rather than failing.
 */
router.get('/onboarding-queue', authenticate, authorize('admin', 'hr'), async (_req, res) => {
  const base = process.env.IT_REQUEST_API_BASE;
  const token = process.env.IT_REQUEST_SERVICE_TOKEN;
  const uiBase = process.env.IT_REQUEST_URL || 'http://localhost:3020';
  if (!base) {
    res.json({ items: [], note: 'IT_REQUEST_API_BASE not configured.' });
    return;
  }
  try {
    const resp = await fetch(
      `${base.replace(/\/$/, '')}/api/integration/onboarding-queue`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!resp.ok) {
      res.json({ items: [], note: `Upstream returned ${resp.status}` });
      return;
    }
    const data = (await resp.json()) as { tickets?: any[] };
    const items = (data.tickets ?? []).map((t) => ({
      ticket_id: t.id,
      request_number: t.request_number,
      full_name: t.onboarding_details?.full_name || t.title,
      start_date: t.onboarding_details?.start_date || null,
      manager_name: t.manager_name || null,
      status: t.status,
      url: `${uiBase}/tickets/${t.id}`,
    }));
    res.json({ items });
  } catch (err) {
    console.warn('[admin/onboarding-queue] error:', (err as Error).message);
    res.json({ items: [], note: 'Upstream unreachable.' });
  }
});

router.get('/notes', authenticate, authorize('admin'), async (_req, res) => {
  const notes = await db('admin_notes').orderBy('pinned', 'desc').orderBy('created_at', 'desc');
  res.json({ notes });
});

router.post('/notes', authenticate, authorize('admin'), async (req, res) => {
  const body = String(req.body?.body || '').trim();
  const pinned = !!req.body?.pinned;
  if (!body) {
    res.status(400).json({ message: 'body required' });
    return;
  }
  const [note] = await db('admin_notes')
    .insert({ author_email: req.user!.email, body, pinned })
    .returning('*');
  res.json({ note });
});

router.delete('/notes/:id', authenticate, authorize('admin'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db('admin_notes').where({ id }).del();
  res.json({ message: 'deleted' });
});

export default router;

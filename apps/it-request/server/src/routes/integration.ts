/**
 * Integration endpoints — read-only API consumed by the Acme Portal to
 * surface IT request tickets on the unified home page.
 *
 * Auth: a shared service token in the `Authorization: Bearer <token>` header
 * matching the `PORTAL_SERVICE_TOKEN` env var. We deliberately do *not* reuse
 * the regular JWT auth here — the portal is acting as a service, not as a
 * specific user.
 */
import { Request, Response, NextFunction, Router } from 'express';
import db from '../db/connection';

const router = Router();

function requireServiceToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.PORTAL_SERVICE_TOKEN || '';
  if (!expected) {
    res.status(503).json({ message: 'integration api not configured' });
    return;
  }
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== expected) {
    res.status(401).json({ message: 'invalid service token' });
    return;
  }
  next();
}

router.use(requireServiceToken);

/** Return open tickets relevant to the given email — both as requester and assignee. */
router.get('/portal-tasks', async (req: Request, res: Response) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ message: 'email required' });
    return;
  }

  const user = await db('users').where({ email }).first();
  if (!user) {
    res.json({ tickets: [], alerts: [] });
    return;
  }

  const openStatuses = [
    'submitted',
    'manager_review',
    'it_review',
    'approved',
    'in_progress',
    'waiting',
  ];

  const tickets = await db('tickets')
    .select(
      'tickets.id',
      'tickets.request_number',
      'tickets.title',
      'tickets.status',
      'tickets.urgency',
      'tickets.due_date',
      'tickets.created_at',
      'tickets.request_type',
      'tickets.requester_id',
      'tickets.manager_id',
      'tickets.assignee_id'
    )
    .whereIn('status', openStatuses)
    .andWhere((qb) => {
      qb.where('requester_id', user.id)
        .orWhere('assignee_id', user.id)
        .orWhere('manager_id', user.id);
    })
    .orderBy([
      { column: 'due_date', order: 'asc', nulls: 'last' },
      { column: 'created_at', order: 'desc' },
    ]);

  // Synthesize alerts for overdue tickets the user owns.
  const now = Date.now();
  const alerts = tickets
    .filter(
      (t) =>
        t.due_date && new Date(t.due_date).getTime() < now && t.assignee_id === user.id
    )
    .slice(0, 5)
    .map((t) => ({
      id: `it-overdue-${t.id}`,
      module: 'it' as const,
      severity: 'critical' as const,
      message: `Ticket ${t.request_number} is overdue`,
      url: `${(process.env.CLIENT_URL || '').replace(/\/$/, '')}/tickets/${t.id}`,
    }));

  res.json({ tickets, alerts });
});

/** Onboarding tickets in `manager_review` or `it_review` — what HR/admin need to see. */
router.get('/onboarding-queue', async (_req: Request, res: Response) => {
  const tickets = await db('tickets')
    .leftJoin('users as manager', 'tickets.manager_id', 'manager.id')
    .leftJoin('users as requester', 'tickets.requester_id', 'requester.id')
    .select(
      'tickets.id',
      'tickets.request_number',
      'tickets.title',
      'tickets.status',
      'tickets.onboarding_details',
      'tickets.created_at',
      'tickets.due_date',
      'manager.name as manager_name',
      'manager.email as manager_email',
      'requester.name as requester_name'
    )
    .where('tickets.request_type', 'onboarding')
    .whereIn('tickets.status', [
      'submitted',
      'manager_review',
      'it_review',
      'approved',
      'in_progress',
    ])
    .orderBy('tickets.created_at', 'desc');

  res.json({ tickets });
});

export default router;

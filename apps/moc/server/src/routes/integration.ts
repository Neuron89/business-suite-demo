import { Router, Request, Response, NextFunction } from 'express';
import db from '../db/connection';

const router = Router();

// Integration API key middleware
function requireIntegrationKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-integration-key'];
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected || !key || key !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid or missing integration key' });
  }
  next();
}

router.use(requireIntegrationKey);

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, app: 'moc', version: '1.0', status: 'ok' });
});

// List MOC requests
router.get('/moc-requests', async (req: Request, res: Response) => {
  try {
    const { search, status, limit = '20' } = req.query;
    let query = db('moc_requests').select(
      'id', 'moc_number', 'title', 'status', 'change_type', 'risk_level', 'created_at', 'updated_at'
    );

    if (search) {
      query = query.where(function () {
        this.where('title', 'ilike', `%${search}%`)
          .orWhere('moc_number', 'ilike', `%${search}%`);
      });
    }
    if (status) {
      query = query.where('status', status as string);
    }

    const data = await query
      .orderBy('created_at', 'desc')
      .limit(Math.min(Number(limit), 100));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Integration moc-requests list error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Portal task aggregation: open MOC items assigned to this user.
// Used by the Acme Portal home feed.
router.get('/portal-tasks', async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'email required' });
    }
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.json({ success: true, items: [], alerts: [] });
    }

    const clientUrl = (process.env.CLIENT_URL || '').replace(/\/$/, '');

    // DSR items assigned to this user, not yet completed.
    // dsr_items has no direct moc_id — get it via dsr_checklists.
    const dsrItems = await db('dsr_items')
      .innerJoin('dsr_checklists', 'dsr_items.checklist_id', 'dsr_checklists.id')
      .leftJoin('moc_requests', 'dsr_checklists.moc_id', 'moc_requests.id')
      .select(
        'dsr_items.id',
        'dsr_items.description',
        'dsr_items.status',
        'dsr_checklists.moc_id',
        'moc_requests.moc_number'
      )
      .where('dsr_items.assigned_to', user.id)
      .whereNot('dsr_items.action_resolved', true)
      .whereNotIn('dsr_items.status', ['completed', 'resolved'])
      .orderBy('dsr_items.created_at', 'asc');

    // PSSR items assigned to this user, not yet completed.
    const pssrItems = await db('pssr_items')
      .innerJoin('pssr_checklists', 'pssr_items.checklist_id', 'pssr_checklists.id')
      .leftJoin('moc_requests', 'pssr_checklists.moc_id', 'moc_requests.id')
      .select(
        'pssr_items.id',
        'pssr_items.description',
        'pssr_items.status',
        'pssr_checklists.moc_id',
        'moc_requests.moc_number'
      )
      .where('pssr_items.assigned_to', user.id)
      .whereNot('pssr_items.action_resolved', true)
      .whereNotIn('pssr_items.status', ['completed', 'resolved'])
      .orderBy('pssr_items.created_at', 'asc');

    const items = [
      ...dsrItems.map((it: any) => ({
        id: it.id,
        kind: 'dsr',
        title: `${it.moc_number || 'MOC'}: ${it.description}`,
        url: `/moc/${it.moc_id}`,
        due_date: null,
        status: it.status,
        subtitle: 'DSR action item',
      })),
      ...pssrItems.map((it: any) => ({
        id: it.id,
        kind: 'pssr',
        title: `${it.moc_number || 'MOC'}: ${it.description}`,
        url: `/moc/${it.moc_id}`,
        due_date: null,
        status: it.status,
        subtitle: 'PSSR action item',
      })),
    ];

    const now = Date.now();
    const alerts = items
      .filter((it) => it.due_date && new Date(it.due_date).getTime() < now)
      .slice(0, 5)
      .map((it) => ({
        id: `moc-overdue-${it.kind}-${it.id}`,
        module: 'moc' as const,
        severity: 'critical' as const,
        message: `Overdue: ${it.title}`,
        url: clientUrl ? `${clientUrl}${it.url}` : it.url,
      }));

    res.json({ success: true, items, alerts });
  } catch (err) {
    console.error('Integration portal-tasks error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Single MOC request
router.get('/moc-requests/:id', async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests')
      .select(
        'id', 'moc_number', 'title', 'description', 'status',
        'change_type', 'risk_level', 'created_at', 'updated_at'
      )
      .where('id', req.params.id)
      .first();

    if (!moc) {
      return res.status(404).json({ success: false, error: 'MOC request not found' });
    }

    res.json({ success: true, data: moc });
  } catch (err) {
    console.error('Integration moc-requests detail error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import {
  shipmentFilterSchema,
  createShipmentSchema,
  updateShipmentSchema,
  canonicalState,
  STATE_FULL,
} from '@shipping/shared';
import db from '../db/connection';

const router = Router();
router.use(authenticate);

router.get('/', validate(shipmentFilterSchema, 'query'), async (req, res) => {
  const q = req.query as any;
  const query = db('shipments as s').leftJoin('carriers as c', 'c.id', 's.carrier_id');

  // Convenience params used by dashboard quick-links.
  if (q.date === 'today') query.where('s.ship_date', db.raw('CURRENT_DATE'));
  if (q.days) {
    const n = Math.min(parseInt(String(q.days), 10), 365);
    if (n > 0) query.where('s.ship_date', '>=', db.raw(`CURRENT_DATE - INTERVAL '${n} days'`));
  }

  if (q.from) query.where('s.ship_date', '>=', q.from);
  if (q.to) query.where('s.ship_date', '<=', q.to);
  if (q.customer) query.whereILike('s.customer_name', `%${q.customer}%`);
  if (q.state) {
    // Accept either abbreviation or full name — match both spellings.
    const canon = canonicalState(q.state);
    const abbr = Object.entries(STATE_FULL).find(([, v]) => v === canon)?.[0];
    const variants = [q.state, canon, abbr].filter(Boolean) as string[];
    query.whereIn('s.ship_to_state', variants);
  }
  if (q.mode) query.where('s.mode', q.mode);
  if (q.carrier_id) query.where('s.carrier_id', q.carrier_id);
  if (q.status) query.where('s.status', q.status);
  if (q.category) query.where('s.category', q.category);
  if (q.q) {
    query.where((b) =>
      b
        .whereILike('s.customer_name', `%${q.q}%`)
        .orWhereILike('s.pu_number', `%${q.q}%`)
        .orWhereILike('s.part_number', `%${q.q}%`)
        .orWhereILike('s.carrier_name_raw', `%${q.q}%`)
    );
  }

  const countRow = await query.clone().clearSelect().clearOrder().count<{ count: string }>('s.id as count').first();
  const total = Number(countRow?.count || 0);
  const offset = (q.page - 1) * q.limit;

  const data = await query
    .select(
      's.*',
      db.raw("c.name as carrier_name")
    )
    .orderBy('s.ship_date', 'desc')
    .orderBy('s.id', 'desc')
    .limit(q.limit)
    .offset(offset);

  res.json({ data, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
});

router.get('/today', async (_req, res) => {
  const rows = await db('shipments as s')
    .leftJoin('carriers as c', 'c.id', 's.carrier_id')
    .where('s.ship_date', db.raw('CURRENT_DATE'))
    .select('s.*', db.raw('c.name as carrier_name'))
    .orderBy('s.id', 'desc');
  res.json({ data: rows });
});

router.get('/:id', async (req, res) => {
  const row = await db('shipments as s')
    .leftJoin('carriers as c', 'c.id', 's.carrier_id')
    .where('s.id', req.params.id)
    .select('s.*', db.raw('c.name as carrier_name'))
    .first();
  if (!row) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.json(row);
});

router.post('/', validate(createShipmentSchema), logAudit('create', 'shipment'), async (req, res) => {
  const payload = { ...(req.body as any), source: 'manual' };
  const [row] = await db('shipments').insert(payload).returning('*');
  res.status(201).json(row);
});

router.patch('/:id', validate(updateShipmentSchema), logAudit('update', 'shipment'), async (req, res) => {
  const [row] = await db('shipments')
    .where({ id: req.params.id })
    .update({ ...(req.body as any), updated_at: db.fn.now() })
    .returning('*');
  if (!row) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.json(row);
});

router.post('/:id/confirm', logAudit('confirm', 'shipment'), async (req, res) => {
  const [row] = await db('shipments')
    .where({ id: req.params.id })
    .update({
      confirmed_by: req.user!.id,
      confirmed_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  if (!row) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.json(row);
});

export default router;

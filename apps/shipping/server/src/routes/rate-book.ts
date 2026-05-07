import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { createRateBookEntrySchema } from '@shipping/shared';
import db from '../db/connection';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { carrier_id, state, mode, active_only } = req.query as any;
  const q = db('rate_book as r').leftJoin('carriers as c', 'c.id', 'r.carrier_id');
  if (carrier_id) q.where('r.carrier_id', carrier_id);
  if (state) q.where('r.destination_state', state);
  if (mode) q.where('r.mode', mode);
  if (active_only) {
    q.where((b) =>
      b.whereNull('r.effective_to').orWhere('r.effective_to', '>=', db.raw('CURRENT_DATE'))
    );
  }
  const rows = await q.select('r.*', db.raw('c.name as carrier_name')).orderBy('r.effective_from', 'desc');
  res.json({ data: rows });
});

router.post('/', authorize('admin', 'shipping_head'), validate(createRateBookEntrySchema), logAudit('create', 'rate_book'), async (req, res) => {
  const [row] = await db('rate_book').insert(req.body as any).returning('*');
  res.status(201).json(row);
});

router.patch('/:id', authorize('admin', 'shipping_head'), logAudit('update', 'rate_book'), async (req, res) => {
  const [row] = await db('rate_book')
    .where({ id: req.params.id })
    .update({ ...(req.body as any), updated_at: db.fn.now() })
    .returning('*');
  if (!row) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.json(row);
});

router.delete('/:id', authorize('admin', 'shipping_head'), logAudit('delete', 'rate_book'), async (req, res) => {
  await db('rate_book').where({ id: req.params.id }).delete();
  res.status(204).end();
});

export default router;

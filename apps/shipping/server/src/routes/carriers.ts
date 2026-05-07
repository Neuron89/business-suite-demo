import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { createCarrierSchema } from '@shipping/shared';
import db from '../db/connection';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const rows = await db('carriers').orderBy('name');
  res.json({ data: rows });
});

router.post('/', authorize('admin', 'shipping_head'), validate(createCarrierSchema), logAudit('create', 'carrier'), async (req, res) => {
  const [row] = await db('carriers').insert(req.body as any).returning('*');
  res.status(201).json(row);
});

router.patch('/:id', authorize('admin', 'shipping_head'), logAudit('update', 'carrier'), async (req, res) => {
  const [row] = await db('carriers')
    .where({ id: req.params.id })
    .update({ ...(req.body as any), updated_at: db.fn.now() })
    .returning('*');
  if (!row) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.json(row);
});

export default router;

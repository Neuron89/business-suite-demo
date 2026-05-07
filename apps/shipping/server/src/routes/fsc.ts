import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { createFscWeeklySchema } from '@shipping/shared';
import db from '../db/connection';
import { syncEiaDiesel } from '../services/eia-fuel';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const rows = await db('fsc_weekly').orderBy('week_start', 'desc').limit(104);
  res.json({ data: rows });
});

router.post('/', authorize('admin', 'shipping_head'), validate(createFscWeeklySchema), logAudit('create', 'fsc_weekly'), async (req, res) => {
  const payload = req.body as any;
  const [row] = await db('fsc_weekly')
    .insert(payload)
    .onConflict('week_start')
    .merge(['diesel_price', 'surcharge_pct', 'source'])
    .returning('*');
  res.status(201).json(row);
});

router.post('/sync/eia', authorize('admin', 'shipping_head'), async (_req, res) => {
  try {
    const result = await syncEiaDiesel();
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ message: 'EIA sync failed', error: err.message });
  }
});

export default router;

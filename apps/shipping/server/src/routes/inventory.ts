import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db/connection';

const router = Router();
router.use(authenticate);

// Latest inventory snapshot per warehouse with optional change-since-yesterday.
router.get('/', async (req, res) => {
  const warehouse = (req.query.warehouse as string) || null;
  const q = (req.query.q as string) || '';

  const latestDateRow = await db('inventory_snapshot').max('snapshot_date as d').first<{ d: string | null }>();
  const latestDate = latestDateRow?.d;
  if (!latestDate) {
    res.json({ data: [], snapshot_date: null, previous_date: null });
    return;
  }

  const prevDateRow = await db('inventory_snapshot')
    .where('snapshot_date', '<', latestDate)
    .max('snapshot_date as d')
    .first<{ d: string | null }>();
  const prevDate = prevDateRow?.d;

  let query = db('inventory_snapshot as i')
    .leftJoin('inventory_snapshot as p', function () {
      this.on('p.part_number', '=', 'i.part_number')
        .andOn('p.warehouse', '=', 'i.warehouse')
        .andOn('p.snapshot_date', '=', db.raw('?', [prevDate]));
    })
    .where('i.snapshot_date', latestDate)
    .select(
      'i.warehouse',
      'i.part_number',
      'i.part_description',
      'i.uom',
      db.raw('i.qty_on_hand::float as qty_on_hand'),
      db.raw('COALESCE(p.qty_on_hand, 0)::float as prev_qty'),
      db.raw('(i.qty_on_hand - COALESCE(p.qty_on_hand, 0))::float as change')
    );

  if (warehouse) query = query.where('i.warehouse', warehouse);
  if (q) {
    query = query.where((b) =>
      b.whereILike('i.part_number', `%${q}%`).orWhereILike('i.part_description', `%${q}%`)
    );
  }

  const data = await query.orderBy('i.warehouse').orderBy('i.part_number').limit(2000);
  res.json({ data, snapshot_date: latestDate, previous_date: prevDate });
});

router.get('/summary', async (_req, res) => {
  const row = await db('inventory_snapshot')
    .max('snapshot_date as d')
    .first<{ d: string | null }>();
  if (!row?.d) {
    res.json({ data: [], snapshot_date: null });
    return;
  }
  const rows = await db('inventory_snapshot')
    .where('snapshot_date', row.d)
    .groupBy('warehouse')
    .select(
      'warehouse',
      db.raw('COUNT(*)::int as line_count'),
      db.raw('COALESCE(SUM(qty_on_hand), 0)::float as total_qty')
    );
  res.json({ data: rows, snapshot_date: row.d });
});

export default router;

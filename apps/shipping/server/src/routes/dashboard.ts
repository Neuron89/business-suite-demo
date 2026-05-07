import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db/connection';
import { canonicalState } from '@shipping/shared';

const router = Router();
router.use(authenticate);

// We roll state aggregations up in JS after the SQL hits the DB — the raw
// data has "NH" and "New Hampshire" side by side, so letting Postgres group
// by the literal column gives us duplicate buckets. Canonicalizing in app
// code keeps the SQL simple and the mapping testable.
function aggregateByState<T extends { state: string | null }>(
  rows: (T & { shipments: number; total_cost: number; total_lbs?: number })[]
) {
  const out = new Map<string, { state: string; shipments: number; total_cost: number; total_lbs: number }>();
  for (const r of rows) {
    const key = canonicalState(r.state);
    if (!key) continue;
    const cur = out.get(key) || { state: key, shipments: 0, total_cost: 0, total_lbs: 0 };
    cur.shipments += Number(r.shipments || 0);
    cur.total_cost += Number(r.total_cost || 0);
    cur.total_lbs += Number(r.total_lbs || 0);
    out.set(key, cur);
  }
  return Array.from(out.values()).sort((a, b) => b.shipments - a.shipments);
}

router.get('/overview', async (_req, res) => {
  const today = await db('shipments')
    .where('ship_date', db.raw('CURRENT_DATE'))
    .count<{ count: string }>('id as count')
    .first();

  // 7-day totals. $/lb is only meaningful for rows that have BOTH cost and
  // lbs — IQMS rows have lbs but no cost, so we include them in volume but
  // exclude from $/lb math (otherwise the denominator is huge, $/lb → 0).
  const last7 = await db('shipments')
    .where('ship_date', '>=', db.raw("CURRENT_DATE - INTERVAL '7 days'"))
    .select(
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs'),
      db.raw(
        'COALESCE(SUM(CASE WHEN total_cost IS NOT NULL AND total_lbs IS NOT NULL THEN total_cost END), 0)::float as cpl_cost'
      ),
      db.raw(
        'COALESCE(SUM(CASE WHEN total_cost IS NOT NULL AND total_lbs IS NOT NULL THEN total_lbs END), 0)::float as cpl_lbs'
      )
    )
    .first();

  const byCarrier = await db('shipments as s')
    .leftJoin('carriers as c', 'c.id', 's.carrier_id')
    .where('s.ship_date', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
    .groupBy('c.name', 's.carrier_name_raw')
    .select(
      db.raw("COALESCE(c.name, s.carrier_name_raw, 'Unknown') as carrier"),
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(s.total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(s.total_lbs), 0)::float as total_lbs')
    )
    .orderBy('shipments', 'desc')
    .limit(15);

  const byStateRaw = await db('shipments')
    .where('ship_date', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
    .whereNotNull('ship_to_state')
    .groupBy('ship_to_state')
    .select(
      'ship_to_state as state',
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs')
    );
  const byState = aggregateByState(byStateRaw);

  const byMode = await db('shipments')
    .where('ship_date', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
    .whereNotNull('mode')
    .groupBy('mode')
    .select(
      'mode',
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost')
    )
    .orderBy('shipments', 'desc');

  // Daily trend for the last 30 days — used by the dashboard line chart.
  const daily = await db('shipments')
    .where('ship_date', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
    .whereNotNull('ship_date')
    .groupBy('ship_date')
    .select(
      db.raw("TO_CHAR(ship_date, 'YYYY-MM-DD') as date"),
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs')
    )
    .orderBy('date', 'asc');

  const monthly = await db('shipments')
    .whereNotNull('ship_date')
    .groupBy(db.raw("TO_CHAR(ship_date, 'YYYY-MM')"))
    .select(
      db.raw("TO_CHAR(ship_date, 'YYYY-MM') as month"),
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs')
    )
    .orderBy('month', 'asc');

  const lastSyncs = await db('sync_runs')
    .select('*')
    .orderBy('started_at', 'desc')
    .limit(10);

  const fsc = await db('fsc_weekly').orderBy('week_start', 'desc').limit(16);

  const inventoryLatest = await db('inventory_snapshot')
    .select('warehouse')
    .max('snapshot_date as snapshot_date')
    .groupBy('warehouse');

  res.json({
    today_count: Number(today?.count || 0),
    last_7_days: {
      shipments: Number(last7?.shipments || 0),
      total_cost: Number(last7?.total_cost || 0),
      total_lbs: Number(last7?.total_lbs || 0),
      cpl_cost: Number(last7?.cpl_cost || 0),
      cpl_lbs: Number(last7?.cpl_lbs || 0),
    },
    by_carrier: byCarrier,
    by_state: byState.slice(0, 15),
    by_mode: byMode,
    daily,
    monthly,
    last_syncs: lastSyncs,
    fsc_recent: fsc,
    inventory_latest: inventoryLatest,
  });
});

router.get('/cost-per-customer', async (req, res) => {
  const days = Math.min(parseInt((req.query.days as string) || '30'), 365);
  const rows = await db('shipments')
    .where('ship_date', '>=', db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
    .whereNotNull('customer_name')
    .groupBy('customer_name')
    .select(
      'customer_name as customer',
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs'),
      db.raw('CASE WHEN SUM(total_lbs) > 0 THEN SUM(total_cost)/SUM(total_lbs) ELSE NULL END as cost_per_lb')
    )
    .orderBy('total_cost', 'desc');
  res.json({ data: rows, days });
});

router.get('/mmr', async (_req, res) => {
  const rows = await db('shipments')
    .select(
      db.raw("TO_CHAR(ship_date, 'YYYY-MM') as month"),
      db.raw('COUNT(*)::int as shipments'),
      db.raw('COALESCE(SUM(total_cost), 0)::float as total_cost'),
      db.raw('COALESCE(SUM(total_lbs), 0)::float as total_lbs'),
      db.raw('CASE WHEN SUM(total_lbs) > 0 THEN SUM(total_cost)/SUM(total_lbs) ELSE NULL END as cost_per_lb')
    )
    .whereNotNull('ship_date')
    .groupBy(db.raw("TO_CHAR(ship_date, 'YYYY-MM')"))
    .orderBy('month', 'desc')
    .limit(24);
  res.json({ data: rows });
});

export default router;

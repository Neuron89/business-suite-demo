import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import db from '../db/connection';
import { runAllSyncs, syncShipments, syncInventory } from '../services/iqms-sync';
import { testIqmsConnection } from '../db/iqms';

const router = Router();
router.use(authenticate);

router.get('/status', async (_req, res) => {
  const rows = await db('sync_runs').orderBy('started_at', 'desc').limit(20);
  res.json({ data: rows });
});

router.get('/test-iqms', authorize('admin', 'shipping_head'), async (_req, res) => {
  const ok = await testIqmsConnection();
  res.json({ ok });
});

router.post('/run/all', authorize('admin', 'shipping_head'), async (_req, res) => {
  try {
    const result = await runAllSyncs();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/run/shipments', authorize('admin', 'shipping_head'), async (req, res) => {
  try {
    const days = parseInt((req.body?.days as string) || '14');
    const result = await syncShipments(days);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/run/inventory', authorize('admin', 'shipping_head'), async (_req, res) => {
  try {
    const result = await syncInventory();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

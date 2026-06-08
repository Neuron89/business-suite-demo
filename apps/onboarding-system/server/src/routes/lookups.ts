/**
 * Lookups proxy — read-only forward of the Employee Tech Doc canonical
 * department + job-title catalog. The employee DB is the source of truth;
 * this proxy just bridges the client to it without exposing employee-DB
 * directly.
 */
import { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function directoryBase() {
  return (process.env.DIRECTORY_BASE_URL || 'http://localhost:5065').replace(/\/$/, '');
}

async function forward(path: string, res: Response) {
  try {
    const token = process.env.DIRECTORY_SERVICE_TOKEN || '';
    const headers: Record<string, string> = token ? { 'X-Service-Token': token } : {};
    const resp = await fetch(`${directoryBase()}${path}`, { headers });
    const text = await resp.text();
    res.status(resp.status).type(resp.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    console.error('[lookups] upstream fetch failed:', err);
    res.status(502).json({ error: 'Lookup catalog unavailable', items: [] });
  }
}

router.get('/departments', async (_req: Request, res: Response) => {
  await forward('/api/lookups/departments', res);
});

router.get('/job-titles', async (req: Request, res: Response) => {
  const deptId = req.query.department_id;
  const suffix =
    deptId != null && deptId !== ''
      ? `?department_id=${encodeURIComponent(String(deptId))}`
      : '';
  await forward(`/api/lookups/job-titles${suffix}`, res);
});

router.get('/distribution-groups', async (_req: Request, res: Response) => {
  const companyId = process.env.ETD_NYCOA_COMPANY_ID;
  const suffix = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  await forward(`/api/distribution-groups/${suffix}`, res);
});

export default router;

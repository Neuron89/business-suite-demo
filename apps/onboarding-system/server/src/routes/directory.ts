/**
 * Directory proxy — read-only forward of the Employee Tech Doc directory
 * so the client doesn't need a service token of its own.
 *
 * Used by the HR intake form's manager-email autocomplete. The full active
 * employee list is the source of truth for "who works here" — never the
 * local users table on this server, which only has people who have SSO'd
 * in plus stub rows we auto-provision as managers.
 */
import { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Read env lazily, not at module load. With ESM, `import` statements in
// index.ts are hoisted above `dotenv.config()`, so any top-level
// `process.env.X` read here would see `undefined`. Other routes follow
// the same pattern (see auth.ts `jwtSecret()`).
function directoryBase() {
  return (process.env.DIRECTORY_BASE_URL || 'http://localhost:5065').replace(/\/$/, '');
}
function serviceToken() {
  return process.env.DIRECTORY_SERVICE_TOKEN || process.env.PORTAL_SERVICE_TOKEN || '';
}

interface DirectoryEmployee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  full_name: string;
  department?: string | null;
  title?: string | null;
  status?: string | null;
  manager_email?: string | null;
}

/**
 * GET /api/directory/employees?active=1
 *
 * Returns a slim list suitable for autocomplete: { id, name, email, title,
 * department }. Filters out inactive accounts + service / shared-mailbox
 * accounts so the dropdown stays clean.
 */
router.get('/employees', async (_req: Request, res: Response) => {
  const token = serviceToken();
  if (!token) {
    res.status(503).json({ message: 'directory not configured' });
    return;
  }
  try {
    const r = await fetch(`${directoryBase()}/api/directory/employees`, {
      headers: { 'X-Service-Token': token, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      res.status(502).json({ message: `directory ${r.status}` });
      return;
    }
    const body = (await r.json()) as { employees?: DirectoryEmployee[] };
    const employees = (body.employees ?? [])
      .filter((e) => (e.status ?? 'active') === 'active')
      .filter((e) => e.email && e.email.includes('@'))
      // Drop obvious non-humans: shadow admin accounts on .onmicrosoft.com,
      // shared/service mailboxes (where first_name===last_name, e.g.
      // "admin.monica admin.monica"), and the conference room calendars.
      .filter((e) => !e.email.toLowerCase().endsWith('.onmicrosoft.com'))
      .filter((e) => !(e.first_name && e.last_name && e.first_name.trim().toLowerCase() === e.last_name.trim().toLowerCase()))
      .filter((e) => !/conference|mailbox|noreply|no-reply|do-not-reply/i.test(e.email))
      .filter((e) => !/^(admin|info|support|sales|help|it|hr|reception|office)@/i.test(e.email))
      .map((e) => ({
        id: e.id,
        name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
        email: e.email,
        title: e.title || null,
        department: e.department || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(employees);
  } catch (err: any) {
    console.error('[directory proxy] failed:', err?.message || err);
    res.status(502).json({ message: 'directory unreachable' });
  }
});

export default router;

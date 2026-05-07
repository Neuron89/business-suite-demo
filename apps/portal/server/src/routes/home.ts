import { Router } from 'express';
import { MODULES, type ModuleKey, type ModuleTile, type HomeFeed } from '@portal/shared';
import { authenticate } from '../middleware/auth';
import { lookupEmployee } from '../services/directory';
import { fetchAllTasks } from '../services/task_aggregators';

const router = Router();

function moduleUrl(envVar: string, pathSuffix?: string): string {
  const base = (process.env[envVar] || '').trim();
  if (!base) return '#';
  if (!pathSuffix) return base;
  return `${base.replace(/\/$/, '')}${pathSuffix.startsWith('/') ? '' : '/'}${pathSuffix}`;
}

function greetingFor(name: string): string {
  const h = new Date().getHours();
  const greeting =
    h < 5 ? 'Hi' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${name}`;
}

router.get('/feed', authenticate, async (req, res) => {
  const email = req.user!.email;
  let directory;
  try {
    directory = await lookupEmployee(email);
  } catch (err) {
    console.error('[home/feed] directory error:', err);
    res.status(503).json({ message: 'Directory unavailable.' });
    return;
  }
  if (!directory) {
    res.status(404).json({ message: 'Employee not found.' });
    return;
  }

  const role = directory.portal_role;
  const isAdmin = role === 'admin';

  // Build the tiles. Visible to a user if any of:
  //   (a) the tile is `external` (SharePoint/Outlook — no gating)
  //   (b) the user is a portal admin (admins see + access everything)
  //   (c) the module's `alwaysVisibleTo` includes the user's role
  //   (d) the user has the matching access flag in the directory
  const visibleModules = MODULES.filter((m) => {
    // adminOnly tiles (e.g. test sandboxes) are visible to portal admins
    // unconditionally, and to any user who has been granted the per-user
    // access flag in the directory.
    if (m.adminOnly) return isAdmin || !!directory!.access[m.key];
    if (m.external) return true;
    if (isAdmin) return true;
    if (m.alwaysVisibleTo?.includes(role)) return true;
    return !!directory!.access[m.key];
  });

  const { tasks, alerts } = await fetchAllTasks(email);

  const taskCountByModule = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.module] = (acc[t.module] || 0) + 1;
    return acc;
  }, {});

  const tiles: ModuleTile[] = visibleModules.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    color: m.color,
    glyph: m.glyph,
    url: moduleUrl(m.urlEnvVar, m.pathSuffix),
    open_task_count: taskCountByModule[m.key] || 0,
    external: !!m.external,
  }));

  const feed: HomeFeed = {
    greeting: greetingFor(directory.preferred_name || directory.first_name || 'there'),
    tiles,
    tasks,
    alerts,
    last_refreshed: new Date().toISOString(),
    is_admin: isAdmin,
  };

  res.json(feed);
});

export default router;

/**
 * Announcements module — admin/HR posts company-wide notices, employees
 * see them on the portal home page and on /announcements.
 */
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  pinned: z.boolean().optional().default(false),
  expires_at: z.string().datetime().nullable().optional(),
  audience_roles: z.array(z.string()).nullable().optional(),
  require_ack: z.boolean().optional().default(false),
});

router.get('/', authenticate, async (req, res) => {
  const role = req.user!.portal_role;
  const rows = await db('announcements')
    .where((qb) => {
      qb.whereNull('expires_at').orWhere('expires_at', '>', db.fn.now());
    })
    .andWhere((qb) => {
      qb.whereNull('audience_roles').orWhereRaw('? = ANY(audience_roles)', [role]);
    })
    .orderBy('pinned', 'desc')
    .orderBy('created_at', 'desc');

  // Tag each row with whether the requesting user has acknowledged it
  const ids = rows.map((r) => r.id);
  const acks = ids.length
    ? await db('announcement_acks')
        .whereIn('announcement_id', ids)
        .andWhere('email', req.user!.email)
        .select('announcement_id')
    : [];
  const ackedSet = new Set(acks.map((a) => a.announcement_id));
  res.json({
    announcements: rows.map((r) => ({ ...r, acknowledged: ackedSet.has(r.id) })),
  });
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('announcements')
    .insert({
      ...parsed.data,
      author_email: req.user!.email,
      author_name: req.user!.full_name,
    })
    .returning('*');
  res.json({ announcement: row });
});

router.post('/:id/ack', authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db('announcement_acks')
    .insert({ announcement_id: id, email: req.user!.email })
    .onConflict(['announcement_id', 'email'])
    .ignore();
  res.json({ acknowledged: true });
});

router.delete('/:id', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db('announcements').where({ id }).del();
  res.json({ deleted: true });
});

export default router;

/**
 * Suggestion Box (Kaizen) — anyone submits, admins/managers/HR triage.
 * Anonymous submissions are stored without the email but flagged so an
 * admin still knows it can't be replied to directly.
 */
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const SUGGESTION_STATUSES = ['new', 'under_review', 'in_progress', 'implemented', 'declined'] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  category: z.string().min(1).max(64).default('other'),
  is_anonymous: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  status: z.enum(SUGGESTION_STATUSES).optional(),
  review_notes: z.string().nullable().optional(),
});

/** Everyone sees their own; admins/managers/hr see everything. */
router.get('/', authenticate, async (req, res) => {
  const role = req.user!.portal_role;
  const canSeeAll = ['admin', 'hr', 'manager'].includes(role);

  const query = db('suggestions').orderBy('created_at', 'desc');
  if (!canSeeAll) {
    query.where('submitter_email', req.user!.email);
  }
  const rows = await query;
  // Strip submitter info for anonymous suggestions when shown to non-admins.
  const sanitized = rows.map((r) => {
    if (r.is_anonymous && !canSeeAll) {
      return { ...r, submitter_email: null, submitter_name: 'Anonymous' };
    }
    if (r.is_anonymous && canSeeAll) {
      return { ...r, submitter_name: r.submitter_name || 'Anonymous (admin only)' };
    }
    return r;
  });
  res.json({ suggestions: sanitized });
});

router.post('/', authenticate, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('suggestions')
    .insert({
      ...parsed.data,
      submitter_email: req.user!.email,
      submitter_name: req.user!.full_name,
    })
    .returning('*');
  res.json({ suggestion: row });
});

router.patch('/:id', authenticate, authorize('admin', 'hr', 'manager'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const updates: any = { ...parsed.data, updated_at: db.fn.now() };
  if (parsed.data.status) {
    updates.reviewed_by_email = req.user!.email;
    updates.reviewed_at = db.fn.now();
  }
  const [row] = await db('suggestions').where({ id }).update(updates).returning('*');
  if (!row) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json({ suggestion: row });
});

export default router;

/**
 * Training Tracker — admin defines training items, assigns to employees
 * (or to whole departments via the directory), tracks completion + expiry.
 *
 * Scope intentionally small for v1: no file uploads, no quizzes, no
 * automatic reminders. Just a record of "who needs to know X by when, and
 * have they shown they do."
 */
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { listEmployees, lookupEmployee } from '../services/directory';

const router = Router();

const itemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.string().min(1).max(64).default('other'),
  recurrence_days: z.number().int().positive().nullable().optional(),
  reference_url: z.string().url().nullable().optional(),
});

const assignSchema = z.object({
  training_item_id: z.number().int().positive(),
  employee_emails: z.array(z.string().email()).min(1),
  due_date: z.string().datetime().nullable().optional(),
});

router.get('/items', authenticate, async (_req, res) => {
  const items = await db('training_items')
    .where({ is_active: true })
    .orderBy('category')
    .orderBy('title');
  res.json({ items });
});

router.post('/items', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('training_items').insert(parsed.data).returning('*');
  res.json({ item: row });
});

router.get('/assignments', authenticate, async (req, res) => {
  const role = req.user!.portal_role;
  const canSeeAll = ['admin', 'hr', 'manager'].includes(role);
  const targetEmail = String(req.query.email || '').trim().toLowerCase();

  const query = db('training_assignments as ta')
    .leftJoin('training_items as ti', 'ta.training_item_id', 'ti.id')
    .select(
      'ta.*',
      'ti.title as training_title',
      'ti.category as training_category',
      'ti.reference_url',
      'ti.recurrence_days'
    )
    .orderBy('ta.completed_at', 'asc')
    .orderBy('ta.due_date', 'asc');

  if (targetEmail) {
    if (!canSeeAll && targetEmail !== req.user!.email) {
      res.status(403).json({ message: 'cannot view another employee' });
      return;
    }
    query.where('ta.employee_email', targetEmail);
  } else if (!canSeeAll) {
    query.where('ta.employee_email', req.user!.email);
  }

  const assignments = await query;
  res.json({ assignments });
});

router.post('/assignments', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }

  const item = await db('training_items').where({ id: parsed.data.training_item_id }).first();
  if (!item) {
    res.status(404).json({ message: 'training item not found' });
    return;
  }

  // Hydrate employee names from the directory so the assignment row is
  // useful even if the employee record changes later.
  const created: any[] = [];
  for (const email of parsed.data.employee_emails) {
    const directory = await lookupEmployee(email).catch(() => null);
    if (!directory) continue; // skip emails that aren't in the directory
    const [row] = await db('training_assignments')
      .insert({
        training_item_id: parsed.data.training_item_id,
        employee_email: directory.email,
        employee_name: directory.full_name,
        assigned_by_email: req.user!.email,
        due_date: parsed.data.due_date || null,
      })
      .onConflict(['training_item_id', 'employee_email'])
      .merge({
        due_date: parsed.data.due_date || null,
        assigned_at: db.fn.now(),
        assigned_by_email: req.user!.email,
      })
      .returning('*');
    created.push(row);
  }

  res.json({ assignments: created });
});

router.post('/assignments/:id/complete', authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const assignment = await db('training_assignments').where({ id }).first();
  if (!assignment) {
    res.status(404).json({ message: 'not found' });
    return;
  }

  // Employees can mark their own training complete; admin/HR can mark any.
  const role = req.user!.portal_role;
  const isAdmin = ['admin', 'hr'].includes(role);
  if (!isAdmin && assignment.employee_email !== req.user!.email) {
    res.status(403).json({ message: 'cannot complete another employee\'s training' });
    return;
  }

  const item = await db('training_items').where({ id: assignment.training_item_id }).first();
  const recurrenceDays: number | null = item?.recurrence_days ?? null;
  const completedAt = new Date();
  const expiresAt = recurrenceDays
    ? new Date(completedAt.getTime() + recurrenceDays * 86_400_000)
    : null;

  const [row] = await db('training_assignments')
    .where({ id })
    .update({
      completed_at: completedAt,
      completed_by_email: req.user!.email,
      expires_at: expiresAt,
    })
    .returning('*');
  res.json({ assignment: row });
});

/** Roster view: which employees have access flag X with their training summary. */
router.get('/roster', authenticate, authorize('admin', 'hr'), async (_req, res) => {
  try {
    const employees = await listEmployees();
    const assignments = await db('training_assignments').select(
      'employee_email',
      'completed_at',
      'expires_at'
    );

    const now = Date.now();
    const summary: Record<string, { open: number; overdue: number; expiring_soon: number }> = {};
    for (const a of assignments) {
      const slot = (summary[a.employee_email] = summary[a.employee_email] || {
        open: 0,
        overdue: 0,
        expiring_soon: 0,
      });
      if (!a.completed_at) {
        slot.open += 1;
      } else if (a.expires_at && new Date(a.expires_at).getTime() < now) {
        slot.overdue += 1;
      } else if (
        a.expires_at &&
        new Date(a.expires_at).getTime() - now < 30 * 86_400_000
      ) {
        slot.expiring_soon += 1;
      }
    }

    res.json({
      employees: employees.map((e) => ({
        email: e.email,
        full_name: e.full_name,
        department: e.department,
        title: e.title,
        ...summary[e.email],
        open: summary[e.email]?.open || 0,
        overdue: summary[e.email]?.overdue || 0,
        expiring_soon: summary[e.email]?.expiring_soon || 0,
      })),
    });
  } catch (err) {
    res.status(503).json({ message: 'directory unavailable' });
  }
});

export default router;

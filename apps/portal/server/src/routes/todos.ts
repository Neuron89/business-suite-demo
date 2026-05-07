/**
 * Personal todo list. Per-user (keyed on email). Used by the IT Dashboard
 * widget but also nice as a standalone page.
 */
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  text: z.string().min(1).max(500),
  priority: z.enum(['low', 'med', 'high']).optional().default('med'),
  due_date: z.string().datetime().nullable().optional(),
});

const updateSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
  priority: z.enum(['low', 'med', 'high']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  sort_order: z.number().int().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const rows = await db('todos')
    .where({ owner_email: req.user!.email })
    .orderBy('done', 'asc')
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'desc');
  res.json({ todos: rows });
});

router.post('/', authenticate, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('todos')
    .insert({ ...parsed.data, owner_email: req.user!.email })
    .returning('*');
  res.json({ todo: row });
});

router.patch('/:id', authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('todos')
    .where({ id, owner_email: req.user!.email })
    .update({ ...parsed.data, updated_at: db.fn.now() })
    .returning('*');
  if (!row) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json({ todo: row });
});

router.delete('/:id', authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db('todos').where({ id, owner_email: req.user!.email }).del();
  res.json({ deleted: true });
});

export default router;

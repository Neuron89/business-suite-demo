import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  kind: z.enum(['federal', 'company']).optional().default('company'),
});

const updateSchema = createSchema.partial();

router.get('/', authenticate, async (_req, res) => {
  const rows = await db('holidays').orderBy('date', 'asc');
  res.json({ holidays: rows });
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('holidays')
    .insert({
      name: parsed.data.name,
      date: parsed.data.date,
      kind: parsed.data.kind,
      created_by: req.user!.email,
    })
    .returning('*')
    .onConflict(['date', 'name'])
    .ignore();
  if (!row) {
    res.status(409).json({ message: 'Holiday with that name + date already exists.' });
    return;
  }
  res.status(201).json({ holiday: row });
});

router.patch('/:id', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const [row] = await db('holidays').where({ id }).update(parsed.data).returning('*');
  if (!row) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json({ holiday: row });
});

router.delete('/:id', authenticate, authorize('admin', 'hr'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }
  const n = await db('holidays').where({ id }).delete();
  res.json({ deleted: n });
});

export default router;

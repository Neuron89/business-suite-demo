import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { createUserSchema, updateUserSchema } from '@complaint/shared';

const router = Router();
router.use(authenticate());

// GET /api/users — list all
router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'name', 'role', 'is_active', 'created_at', 'updated_at')
      .orderBy('id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — create (admin only)
router.post('/', authorize('admin'), validate(createUserSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users')
      .insert({ email, password_hash, name, role })
      .returning(['id', 'email', 'name', 'role', 'is_active', 'created_at', 'updated_at']);

    await logAudit(req, 'create', 'user', user.id);
    res.status(201).json(user);
  } catch (err) {
    console.error('Failed to create user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — update (admin only)
router.put('/:id', authorize('admin'), validate(updateUserSchema), async (req: Request, res: Response) => {
  try {
    const [user] = await db('users')
      .where('id', req.params.id)
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning(['id', 'email', 'name', 'role', 'is_active', 'created_at', 'updated_at']);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logAudit(req, 'update', 'user', user.id, req.body);
    res.json(user);
  } catch (err) {
    console.error('Failed to update user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;

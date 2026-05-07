import { Router } from 'express';
import bcrypt from 'bcrypt';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { createUserSchema } from '@shipping/shared';
import db from '../db/connection';

const router = Router();
router.use(authenticate);

router.get('/', authorize('admin'), async (_req, res) => {
  const rows = await db('users').select('id', 'email', 'name', 'role', 'created_at', 'updated_at').orderBy('name');
  res.json({ data: rows });
});

router.post('/', authorize('admin'), validate(createUserSchema), logAudit('create', 'user'), async (req, res) => {
  const { email, name, password, role } = req.body as any;
  const password_hash = await bcrypt.hash(password, 10);
  const [row] = await db('users')
    .insert({ email, name, password_hash, role })
    .returning(['id', 'email', 'name', 'role', 'created_at', 'updated_at']);
  res.status(201).json(row);
});

export default router;

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all users (admin)
router.get('/', authenticate, authorize('it_admin'), async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('users as mgr', 'users.manager_id', 'mgr.id')
      .select(
        'users.id', 'users.email', 'users.name', 'users.role',
        'users.is_active', 'users.created_at',
        'departments.name as department',
        'mgr.name as manager_name', 'mgr.email as manager_email'
      )
      .orderBy('users.name');
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get managers list (for dropdowns)
router.get('/managers', authenticate, async (_req: Request, res: Response) => {
  try {
    const managers = await db('users')
      .whereIn('role', ['manager', 'it_admin'])
      .andWhere({ is_active: true })
      .select('id', 'name', 'email')
      .orderBy('name');
    res.json(managers);
  } catch (err) {
    console.error('Get managers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assignable users (IT only — for ticket assignment dropdowns)
router.get('/assignable', authenticate, async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .whereIn('role', ['it_admin'])
      .andWhere({ is_active: true })
      .select('id', 'name', 'email')
      .orderBy('name');
    res.json(users);
  } catch (err) {
    console.error('Get assignable error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create user (admin)
router.post('/', authenticate, authorize('it_admin'), async (req: Request, res: Response) => {
  try {
    const { email, name, password, role, department_id, manager_id } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const [user] = await db('users').insert({
      email, name, password_hash: hash, role,
      department_id: department_id || null,
      manager_id: manager_id || null,
    }).returning(['id', 'email', 'name', 'role', 'is_active']);

    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ message: 'Email already exists' });
      return;
    }
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (admin)
router.put('/:id', authenticate, authorize('it_admin'), async (req: Request, res: Response) => {
  try {
    const { name, role, department_id, manager_id, is_active } = req.body;
    await db('users').where({ id: req.params.id }).update({
      name, role, department_id, manager_id, is_active, updated_at: new Date(),
    });
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

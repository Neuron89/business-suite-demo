import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { createUserSchema, updateUserSchema } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';

const router = Router();

// GET /api/users/names — lightweight list for dropdowns (any authenticated user)
router.get('/names', authenticate, async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .select('id', 'name', 'role')
      .where('is_active', true)
      .orderBy('name', 'asc');
    res.json(users);
  } catch (err) {
    console.error('Users names error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users
router.get('/', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'name', 'role', 'secondary_roles', 'is_active', 'admin_access', 'is_approver', 'created_at', 'updated_at')
      .orderBy('created_at', 'asc');

    // Fetch all user_locations in one query
    const locations = await db('user_locations').select('user_id', 'area');
    const locationMap: Record<number, string[]> = {};
    for (const loc of locations) {
      if (!locationMap[loc.user_id]) locationMap[loc.user_id] = [];
      locationMap[loc.user_id].push(loc.area);
    }

    const usersWithAreas = users.map((u: any) => ({
      ...u,
      assigned_areas: locationMap[u.id] || [],
    }));

    res.json(usersWithAreas);
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', authenticate, authorize('admin'), validate(createUserSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, assigned_areas } = req.body;

    // Admins cannot create other admins or super_admins — only super_admins can
    if (['admin', 'super_admin'].includes(role) && req.user!.role !== 'super_admin') {
      res.status(403).json({ message: 'Only super admins can create admin users' });
      return;
    }

    const existing = await db('users').where('email', email).first();
    if (existing) {
      res.status(409).json({ message: 'Email already exists' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db('users')
      .insert({ email, password_hash, name, role })
      .returning(['id', 'email', 'name', 'role', 'is_active', 'created_at']);

    // Insert user_locations if provided
    if (assigned_areas && assigned_areas.length > 0) {
      await db('user_locations').insert(
        assigned_areas.map((area: string) => ({ user_id: user.id, area }))
      );
    }

    await logAudit(req, 'create', 'user', user.id, { email, name, role, assigned_areas });

    res.status(201).json({ ...user, assigned_areas: assigned_areas || [] });
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, authorize('admin'), validate(updateUserSchema), async (req: Request, res: Response) => {
  try {
    const { assigned_areas, ...userData } = req.body;

    // Admins cannot modify other admins/super_admins — only super_admins can
    const targetUser = await db('users').where('id', req.params.id).first();
    if (targetUser && ['admin', 'super_admin'].includes(targetUser.role) && req.user!.role !== 'super_admin') {
      res.status(403).json({ message: 'Only super admins can modify admin users' });
      return;
    }
    // Admins cannot promote users to admin/super_admin
    if (userData.role && ['admin', 'super_admin'].includes(userData.role) && req.user!.role !== 'super_admin') {
      res.status(403).json({ message: 'Only super admins can assign admin roles' });
      return;
    }

    const [user] = await db('users')
      .where('id', req.params.id)
      .update({ ...userData, updated_at: db.fn.now() })
      .returning(['id', 'email', 'name', 'role', 'secondary_roles', 'is_active', 'admin_access', 'is_approver', 'created_at', 'updated_at']);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Update user_locations if provided
    if (assigned_areas !== undefined) {
      const userId = parseInt(String(req.params.id));
      await db('user_locations').where('user_id', userId).del();
      if (assigned_areas.length > 0) {
        await db('user_locations').insert(
          assigned_areas.map((area: string) => ({ user_id: userId, area }))
        );
      }
    }

    await logAudit(req, 'update', 'user', parseInt(String(req.params.id)), req.body);

    // Return with current areas
    const areas = await db('user_locations').where('user_id', user.id).pluck('area');
    res.json({ ...user, assigned_areas: areas });
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

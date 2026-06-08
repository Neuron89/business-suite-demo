import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate());

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { entity_type, entity_id, user_id, action } = req.query;

    let query = db('audit_log')
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .select('audit_log.*', 'users.name as user_name');

    if (entity_type) query = query.where('audit_log.entity_type', entity_type);
    if (entity_id) query = query.where('audit_log.entity_id', entity_id);
    if (user_id) query = query.where('audit_log.user_id', user_id);
    if (action) query = query.where('audit_log.action', action);

    const countResult = await query.clone().clearSelect().clearOrder().count('audit_log.id as total').first();
    const total = Number(countResult?.total || 0);

    const data = await query
      .orderBy('audit_log.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Failed to get audit log:', err);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

export default router;

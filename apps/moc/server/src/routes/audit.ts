import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET /api/audit
router.get('/', authenticate, authorize('admin', 'ehs'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 100);
    const entity_type = req.query.entity_type as string | undefined;
    const entity_id = req.query.entity_id ? parseInt(String(req.query.entity_id)) : undefined;
    const user_id = req.query.user_id ? parseInt(String(req.query.user_id)) : undefined;
    const action = req.query.action as string | undefined;

    let query = db('audit_log')
      .join('users', 'audit_log.user_id', 'users.id')
      .select('audit_log.*', 'users.name as user_name');

    if (entity_type) query = query.where('audit_log.entity_type', entity_type);
    if (entity_id) query = query.where('audit_log.entity_id', entity_id);
    if (user_id) query = query.where('audit_log.user_id', user_id);
    if (action) query = query.where('audit_log.action', action);

    const countResult = await query.clone().clearSelect().count('audit_log.id as total').first();
    const total = parseInt(String(countResult?.total || '0'));

    const data = await query
      .orderBy('audit_log.created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

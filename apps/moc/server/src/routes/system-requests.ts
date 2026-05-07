import { Router, Request, Response } from 'express';
import { createSystemRequestSchema, updateSystemRequestSchema } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { emailRoleUsers } from '../services/notifications';
import { mocStatusEmail } from '../services/email';

const router = Router();

// POST / — any authenticated user can submit feedback
router.post('/', authenticate, validate(createSystemRequestSchema), async (req: Request, res: Response) => {
  try {
    const [request] = await db('system_requests')
      .insert({
        user_id: req.user!.id,
        description: req.body.description,
        screenshot_data: req.body.screenshot_data || null,
        page_url: req.body.page_url,
      })
      .returning('*');

    await logAudit(req, 'create', 'system_request', request.id, {
      description: req.body.description.substring(0, 100),
      page_url: req.body.page_url,
    });

    // Email admin about new feedback ticket
    const userName = req.user!.name || req.user!.email;
    await emailRoleUsers('admin', `New Feedback Ticket #${request.id}`, mocStatusEmail(request.id, `Feedback from ${userName}`, 'New', req.body.description.substring(0, 200)));

    res.status(201).json(request);
  } catch (err) {
    console.error('System request create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET / — admin only, list all requests
router.get('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    let query = db('system_requests')
      .join('users', 'system_requests.user_id', 'users.id')
      .select(
        'system_requests.id',
        'system_requests.user_id',
        'system_requests.description',
        'system_requests.page_url',
        'system_requests.status',
        'system_requests.admin_notes',
        'system_requests.created_at',
        'system_requests.updated_at',
        db.raw("CASE WHEN system_requests.screenshot_data IS NOT NULL THEN 'true' ELSE 'false' END as has_screenshot"),
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('system_requests.created_at', 'desc');

    if (status && status !== 'all') {
      query = query.where('system_requests.status', status);
    }

    const requests = await query;
    res.json(requests);
  } catch (err) {
    console.error('System requests list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /:id — admin only, get single request with full screenshot
router.get('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const request = await db('system_requests')
      .join('users', 'system_requests.user_id', 'users.id')
      .select(
        'system_requests.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .where('system_requests.id', req.params.id)
      .first();

    if (!request) {
      res.status(404).json({ message: 'System request not found' });
      return;
    }

    res.json(request);
  } catch (err) {
    console.error('System request get error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /:id — admin only, update status and admin notes
router.put('/:id', authenticate, authorize('admin'), validate(updateSystemRequestSchema), async (req: Request, res: Response) => {
  try {
    const existing = await db('system_requests').where('id', req.params.id).first();
    if (!existing) {
      res.status(404).json({ message: 'System request not found' });
      return;
    }

    const [updated] = await db('system_requests')
      .where('id', req.params.id)
      .update({
        status: req.body.status,
        admin_notes: req.body.admin_notes ?? existing.admin_notes,
        updated_at: db.fn.now(),
      })
      .returning('*');

    await logAudit(req, 'update', 'system_request', parseInt(String(req.params.id)), req.body);

    res.json(updated);
  } catch (err) {
    console.error('System request update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import {
  createComplaintSchema,
  updateComplaintSchema,
  transitionSchema,
  commentSchema,
  assignSchema,
  complaintsFilterSchema,
  WORKFLOW_TRANSITIONS,
} from '@complaint/shared';
import type { ComplaintStatus } from '@complaint/shared';

const router = Router();

const COMPLAINT_COLUMNS = [
  'complaints.id', 'complaints.complaint_number',
  'complaints.customer_name', 'complaints.customer_email', 'complaints.customer_phone', 'complaints.customer_company',
  'complaints.product_name', 'complaints.lot_number',
  'complaints.complaint_type', 'complaints.severity', 'complaints.status',
  'complaints.title', 'complaints.description',
  'complaints.resolution', 'complaints.resolution_date',
  'complaints.created_by', 'complaints.assigned_to',
  'complaints.created_at', 'complaints.updated_at',
];

// All routes require auth
router.use(authenticate());

// Generate complaint number: CC-YYYY-NNN
async function generateComplaintNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.raw("SELECT nextval('complaint_number_seq') as num");
  const num = String(result.rows[0].num).padStart(3, '0');
  return `CC-${year}-${num}`;
}

// GET /api/complaints — list with filters
router.get('/', validate(complaintsFilterSchema, 'query'), async (req: Request, res: Response) => {
  try {
    const { page, limit, status, complaint_type, severity, assigned_to, search, sort_by, sort_order } = req.query as any;

    let query = db('complaints')
      .leftJoin('users as creator', 'complaints.created_by', 'creator.id')
      .leftJoin('users as assignee', 'complaints.assigned_to', 'assignee.id')
      .select(
        ...COMPLAINT_COLUMNS,
        'creator.name as created_by_name',
        'assignee.name as assigned_to_name'
      );

    if (status) query = query.where('complaints.status', status);
    if (complaint_type) query = query.where('complaints.complaint_type', complaint_type);
    if (severity) query = query.where('complaints.severity', severity);
    if (assigned_to) query = query.where('complaints.assigned_to', assigned_to);
    if (search) {
      query = query.whereRaw("complaints.search_vector @@ plainto_tsquery('english', ?)", [search]);
    }

    const countResult = await query.clone().clearSelect().clearOrder().count('complaints.id as total').first();
    const total = Number(countResult?.total || 0);

    const data = await query
      .orderBy(`complaints.${sort_by}`, sort_order)
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
    console.error('Failed to list complaints:', err);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
});

// GET /api/complaints/:id — detail with comments + attachments
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const complaint = await db('complaints')
      .leftJoin('users as creator', 'complaints.created_by', 'creator.id')
      .leftJoin('users as assignee', 'complaints.assigned_to', 'assignee.id')
      .select(
        'complaints.*',
        'creator.name as created_by_name',
        'assignee.name as assigned_to_name'
      )
      .where('complaints.id', req.params.id)
      .first();

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const comments = await db('complaint_comments')
      .join('users', 'complaint_comments.user_id', 'users.id')
      .select('complaint_comments.*', 'users.name as user_name', 'users.role as user_role')
      .where('complaint_id', complaint.id)
      .orderBy('complaint_comments.created_at', 'asc');

    const attachments = await db('attachments')
      .join('users', 'attachments.uploaded_by', 'users.id')
      .select('attachments.*', 'users.name as uploaded_by_name')
      .where('complaint_id', complaint.id)
      .orderBy('attachments.created_at', 'desc');

    res.json({ ...complaint, comments, attachments });
  } catch (err) {
    console.error('Failed to get complaint:', err);
    res.status(500).json({ error: 'Failed to get complaint' });
  }
});

// POST /api/complaints — create
router.post('/', validate(createComplaintSchema), async (req: Request, res: Response) => {
  try {
    const complaint_number = await generateComplaintNumber();
    const [complaint] = await db('complaints')
      .insert({
        ...req.body,
        complaint_number,
        status: 'submitted',
        created_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'create', 'complaint', complaint.id, { complaint_number });
    res.status(201).json(complaint);
  } catch (err) {
    console.error('Failed to create complaint:', err);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

// PATCH /api/complaints/:id — update
router.patch('/:id', validate(updateComplaintSchema), async (req: Request, res: Response) => {
  try {
    const existing = await db('complaints').where('id', req.params.id).first();
    if (!existing) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const [updated] = await db('complaints')
      .where('id', req.params.id)
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');

    await logAudit(req, 'update', 'complaint', updated.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('Failed to update complaint:', err);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// POST /api/complaints/:id/transition — change status
router.post('/:id/transition', validate(transitionSchema), async (req: Request, res: Response) => {
  try {
    const complaint = await db('complaints').where('id', req.params.id).first();
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const currentStatus = complaint.status as ComplaintStatus;
    const newStatus = req.body.status as ComplaintStatus;
    const transition = WORKFLOW_TRANSITIONS[currentStatus];

    if (!transition.to.includes(newStatus)) {
      return res.status(400).json({ error: `Cannot transition from ${currentStatus} to ${newStatus}` });
    }
    if (!transition.roles.includes(req.user!.role)) {
      return res.status(403).json({ error: 'You do not have permission to make this transition' });
    }

    const updateData: any = { status: newStatus, updated_at: db.fn.now() };
    if (newStatus === 'resolved') {
      updateData.resolution_date = db.fn.now();
    }

    const [updated] = await db('complaints')
      .where('id', req.params.id)
      .update(updateData)
      .returning('*');

    // Add comment if provided
    if (req.body.comment) {
      await db('complaint_comments').insert({
        complaint_id: complaint.id,
        user_id: req.user!.id,
        comment: `[Status changed to ${newStatus}] ${req.body.comment}`,
      });
    }

    await logAudit(req, 'transition', 'complaint', complaint.id, { from: currentStatus, to: newStatus });
    res.json(updated);
  } catch (err) {
    console.error('Failed to transition complaint:', err);
    res.status(500).json({ error: 'Failed to transition complaint' });
  }
});

// POST /api/complaints/:id/comments — add comment
router.post('/:id/comments', validate(commentSchema), async (req: Request, res: Response) => {
  try {
    const complaint = await db('complaints').where('id', req.params.id).first();
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const [comment] = await db('complaint_comments')
      .insert({
        complaint_id: complaint.id,
        user_id: req.user!.id,
        comment: req.body.comment,
      })
      .returning('*');

    await logAudit(req, 'comment', 'complaint', complaint.id);
    res.status(201).json(comment);
  } catch (err) {
    console.error('Failed to add comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// POST /api/complaints/:id/assign — assign to user
router.post('/:id/assign', authorize('admin', 'qc'), validate(assignSchema), async (req: Request, res: Response) => {
  try {
    const complaint = await db('complaints').where('id', req.params.id).first();
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const [updated] = await db('complaints')
      .where('id', req.params.id)
      .update({ assigned_to: req.body.assigned_to, updated_at: db.fn.now() })
      .returning('*');

    await logAudit(req, 'assign', 'complaint', complaint.id, { assigned_to: req.body.assigned_to });
    res.json(updated);
  } catch (err) {
    console.error('Failed to assign complaint:', err);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

export default router;

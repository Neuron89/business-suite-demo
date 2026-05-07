import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTicketSchema, reviewRequestSchema, updateTicketSchema, addCommentSchema, managerOnboardingDetailsSchema } from '@itr/shared';

const router = Router();

const TYPE_PREFIX: Record<string, string> = {
  hardware: 'HW',
  software: 'SW',
  permission: 'PM',
  access: 'AC',
  onboarding: 'ON',
  other: 'OT',
};

async function generateTicketNumber(type: string): Promise<string> {
  const prefix = TYPE_PREFIX[type] ?? 'TK';
  const year = new Date().getFullYear();
  const count = await db('tickets')
    .where('request_number', 'like', `${prefix}-${year}-%`)
    .count('id as count')
    .first();
  const num = (parseInt(String(count?.count || 0)) + 1).toString().padStart(4, '0');
  return `${prefix}-${year}-${num}`;
}

const TICKET_SELECT_COLUMNS = [
  'tickets.*',
  'requester.name as requester_name',
  'requester.email as requester_email',
  'departments.name as requester_department',
  'manager.name as manager_name',
  'manager.email as manager_email',
  'assignee.name as assignee_name',
  'category.name as category_name',
  'category.color as category_color',
];

function ticketBaseQuery() {
  return db('tickets')
    .leftJoin('users as requester', 'tickets.requester_id', 'requester.id')
    .leftJoin('users as manager', 'tickets.manager_id', 'manager.id')
    .leftJoin('users as assignee', 'tickets.assignee_id', 'assignee.id')
    .leftJoin('ticket_categories as category', 'tickets.category_id', 'category.id')
    .leftJoin('departments', 'requester.department_id', 'departments.id');
}

// Create ticket
router.post('/', authenticate, validate(createTicketSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const requestNumber = await generateTicketNumber(data.request_type);

    const user = await db('users').where({ id: req.user!.id }).first();
    let managerId: number | null = user?.manager_id || null;
    let categoryId: number | null = data.category_id || null;

    // Onboarding: HR is the requester. The "manager" field on the ticket is the new hire's manager (resolved by email).
    if (data.request_type === 'onboarding' && data.onboarding_details?.manager_email) {
      const newHireManager = await db('users')
        .where({ email: data.onboarding_details.manager_email.toLowerCase().trim() })
        .first();
      managerId = newHireManager?.id || null;
    }

    if (!categoryId) {
      const map: Record<string, string> = {
        onboarding: 'Onboarding',
        hardware: 'Hardware',
        software: 'Software',
        permission: 'Access / Permissions',
        access: 'Access / Permissions',
        other: 'Other',
      };
      const cat = await db('ticket_categories').where({ name: map[data.request_type] }).first();
      categoryId = cat?.id || null;
    }

    const [ticket] = await db('tickets').insert({
      request_number: requestNumber,
      requester_id: req.user!.id,
      request_type: data.request_type,
      status: 'submitted',
      urgency: data.urgency,
      title: data.title,
      justification: data.justification,
      manager_id: managerId,
      category_id: categoryId,
      due_date: data.due_date || null,
      hardware_specs: data.hardware_specs ? JSON.stringify(data.hardware_specs) : null,
      software_details: data.software_details ? JSON.stringify(data.software_details) : null,
      permission_details: data.permission_details ? JSON.stringify(data.permission_details) : null,
      access_details: data.access_details ? JSON.stringify(data.access_details) : null,
      onboarding_details: data.onboarding_details ? JSON.stringify(data.onboarding_details) : null,
      other_details: data.other_details ? JSON.stringify(data.other_details) : null,
    }).returning('*');

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: null,
      to_status: 'submitted',
      changed_by: req.user!.id,
      comment: 'Ticket submitted',
    });

    // Onboarding ALWAYS routes to the new hire's manager so they can fill in IT requirements.
    // Other ticket types route to the requester's own manager (if any).
    if (data.request_type === 'onboarding') {
      if (!managerId) {
        // Manager email didn't resolve — leave it for IT to triage.
        await db('tickets').where({ id: ticket.id }).update({ status: 'it_review' });
        await db('ticket_history').insert({
          ticket_id: ticket.id,
          from_status: 'submitted',
          to_status: 'it_review',
          changed_by: req.user!.id,
          comment: `Manager email not found in system (${data.onboarding_details?.manager_email || 'n/a'}) — sent to IT to resolve`,
        });
      } else {
        await db('tickets').where({ id: ticket.id }).update({ status: 'manager_review' });
        await db('ticket_history').insert({
          ticket_id: ticket.id,
          from_status: 'submitted',
          to_status: 'manager_review',
          changed_by: req.user!.id,
          comment: 'Sent to manager to specify IT requirements',
        });
      }
    } else if (managerId) {
      await db('tickets').where({ id: ticket.id }).update({ status: 'manager_review' });
      await db('ticket_history').insert({
        ticket_id: ticket.id,
        from_status: 'submitted',
        to_status: 'manager_review',
        changed_by: req.user!.id,
        comment: 'Sent to manager for review',
      });
    }

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List tickets (with filters)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, type, category, assignee, mine, overdue, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = ticketBaseQuery().select(TICKET_SELECT_COLUMNS);

    if (req.user!.role === 'employee') {
      query = query.where('tickets.requester_id', req.user!.id);
    } else if (req.user!.role === 'manager') {
      query = query.where(function() {
        this.where('tickets.manager_id', req.user!.id)
          .orWhere('tickets.requester_id', req.user!.id);
      });
    } else if (req.user!.role === 'hr') {
      // HR sees their own tickets here; onboarding tickets are accessed via /onboarding.
      // But filter by ?type=onboarding still returns all onboardings (used by the onboarding page).
      if (type === 'onboarding') {
        // No restriction — let HR see all onboarding tickets they've submitted or that exist.
      } else {
        query = query.where('tickets.requester_id', req.user!.id);
      }
    }

    if (status) query = query.where('tickets.status', status as string);
    if (type) query = query.where('tickets.request_type', type as string);
    if (category) query = query.where('tickets.category_id', parseInt(category as string));
    if (assignee === 'unassigned') query = query.whereNull('tickets.assignee_id');
    else if (assignee) query = query.where('tickets.assignee_id', parseInt(assignee as string));
    if (mine === 'true') query = query.where('tickets.assignee_id', req.user!.id);
    if (overdue === 'true') {
      query = query.whereNotNull('tickets.due_date')
        .where('tickets.due_date', '<', new Date())
        .whereNotIn('tickets.status', ['completed', 'cancelled', 'denied']);
    }

    const countQuery = query.clone().clearSelect().count('tickets.id as total').first();
    const [{ total }] = await Promise.all([countQuery]);

    const data = await query
      .orderBy('tickets.created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({
      data,
      total: parseInt(String(total)),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(parseInt(String(total)) / parseInt(limit as string)),
    });
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single ticket
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const ticket = await ticketBaseQuery()
      .leftJoin('users as it_admin', 'tickets.it_admin_id', 'it_admin.id')
      .select([...TICKET_SELECT_COLUMNS, 'it_admin.name as it_admin_name'])
      .where('tickets.id', req.params.id)
      .first();

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (req.user!.role === 'employee' && ticket.requester_id !== req.user!.id) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    let commentsQuery = db('ticket_comments')
      .join('users', 'ticket_comments.user_id', 'users.id')
      .select('ticket_comments.*', 'users.name as user_name')
      .where({ ticket_id: ticket.id })
      .orderBy('ticket_comments.created_at', 'asc');

    if (!['it_admin', 'hr', 'manager'].includes(req.user!.role)) {
      commentsQuery = commentsQuery.where('ticket_comments.is_internal', false);
    }
    const comments = await commentsQuery;

    const history = await db('ticket_history')
      .join('users', 'ticket_history.changed_by', 'users.id')
      .select('ticket_history.*', 'users.name as changed_by_name')
      .where({ ticket_id: ticket.id })
      .orderBy('ticket_history.created_at', 'asc');

    const attachments = await db('ticket_attachments')
      .join('users', 'ticket_attachments.uploaded_by', 'users.id')
      .select('ticket_attachments.*', 'users.name as uploaded_by_name')
      .where({ ticket_id: ticket.id })
      .orderBy('ticket_attachments.created_at', 'asc');

    res.json({ ...ticket, comments, history, attachments });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/manager-review', authenticate, authorize('manager', 'it_admin'), validate(reviewRequestSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (ticket.status !== 'manager_review') {
      res.status(400).json({ message: 'Ticket is not pending manager review' });
      return;
    }

    const { decision, notes } = req.body;
    const newStatus = decision === 'approved' ? 'it_review' : 'denied';

    await db('tickets').where({ id: ticket.id }).update({
      status: newStatus,
      manager_notes: notes || null,
      manager_decision_at: new Date(),
    });

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'manager_review',
      to_status: newStatus,
      changed_by: req.user!.id,
      comment: decision === 'approved'
        ? `Manager approved: ${notes || 'No notes'}`
        : `Manager denied: ${notes || 'No reason given'}`,
    });

    res.json({ message: `Ticket ${decision}`, status: newStatus });
  } catch (err) {
    console.error('Manager review error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/it-review', authenticate, authorize('it_admin'), validate(reviewRequestSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (ticket.status !== 'it_review' && ticket.status !== 'submitted') {
      res.status(400).json({ message: 'Ticket is not pending IT review' });
      return;
    }

    const { decision, notes } = req.body;
    const newStatus = decision === 'approved' ? 'approved' : 'denied';

    await db('tickets').where({ id: ticket.id }).update({
      status: newStatus,
      it_admin_id: req.user!.id,
      it_admin_notes: notes || null,
      it_decision_at: new Date(),
    });

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: newStatus,
      changed_by: req.user!.id,
      comment: decision === 'approved'
        ? `IT approved: ${notes || 'No notes'}`
        : `IT denied: ${notes || 'No reason given'}`,
    });

    res.json({ message: `Ticket ${decision}`, status: newStatus });
  } catch (err) {
    console.error('IT review error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/comments', authenticate, validate(addCommentSchema), async (req: Request, res: Response) => {
  try {
    const { comment, is_internal } = req.body;
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    const internal = !!is_internal && ['it_admin', 'hr', 'manager'].includes(req.user!.role);

    const [newComment] = await db('ticket_comments').insert({
      ticket_id: parseInt(req.params.id),
      user_id: req.user!.id,
      comment: comment.trim(),
      is_internal: internal,
    }).returning('*');

    res.status(201).json({ ...newComment, user_name: req.user!.name });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generic update: assignee, category, due, status, resolution
router.patch('/:id', authenticate, authorize('it_admin', 'hr', 'manager'), validate(updateTicketSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    const updates: any = { updated_at: new Date() };
    const { status, assignee_id, category_id, due_date, resolution_notes, comment } = req.body;

    if (status !== undefined && status !== ticket.status) {
      updates.status = status;
      if (['completed', 'cancelled', 'denied'].includes(status) && !ticket.closed_at) {
        updates.closed_at = new Date();
      }
      await db('ticket_history').insert({
        ticket_id: ticket.id,
        from_status: ticket.status,
        to_status: status,
        changed_by: req.user!.id,
        comment: comment || `Status changed to ${status}`,
      });
    }
    if (assignee_id !== undefined) updates.assignee_id = assignee_id;
    if (category_id !== undefined) updates.category_id = category_id;
    if (due_date !== undefined) updates.due_date = due_date;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;

    await db('tickets').where({ id: ticket.id }).update(updates);
    res.json({ message: 'Ticket updated' });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id/status', authenticate, authorize('it_admin', 'hr'), async (req: Request, res: Response) => {
  try {
    const { status, comment } = req.body;
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    const updates: any = { status, updated_at: new Date() };
    if (['completed', 'cancelled', 'denied'].includes(status) && !ticket.closed_at) {
      updates.closed_at = new Date();
    }

    await db('tickets').where({ id: ticket.id }).update(updates);
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: status,
      changed_by: req.user!.id,
      comment: comment || `Status changed to ${status}`,
    });

    res.json({ message: 'Status updated', status });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (ticket.requester_id !== req.user!.id && req.user!.role !== 'it_admin') {
      res.status(403).json({ message: 'Only the requester can cancel' });
      return;
    }

    if (['completed', 'cancelled'].includes(ticket.status)) {
      res.status(400).json({ message: 'Cannot cancel this ticket' });
      return;
    }

    await db('tickets').where({ id: ticket.id }).update({ status: 'cancelled', closed_at: new Date() });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: 'cancelled',
      changed_by: req.user!.id,
      comment: 'Ticket cancelled',
    });

    res.json({ message: 'Ticket cancelled' });
  } catch (err) {
    console.error('Cancel ticket error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// IT-admin only: hard-delete a ticket and its cascading comments/history/
// attachments (FKs are ON DELETE CASCADE). This is intentionally separate
// from /cancel — cancel preserves the audit trail; delete wipes it.
router.delete('/:id', authenticate, authorize('it_admin'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: 'Invalid ticket id' });
      return;
    }
    const deleted = await db('tickets').where({ id }).del();
    if (!deleted) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    res.json({ message: 'Ticket deleted', id });
  } catch (err) {
    console.error('Delete ticket error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Manager fills in onboarding IT requirements (replaces approve/deny for onboarding tickets).
// Merges the manager's input into the existing onboarding_details JSONB and advances to it_review.
router.post('/:id/onboarding-details', authenticate, authorize('manager', 'it_admin'), validate(managerOnboardingDetailsSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.request_type !== 'onboarding') {
      res.status(400).json({ message: 'Not an onboarding ticket' });
      return;
    }
    if (ticket.status !== 'manager_review') {
      res.status(400).json({ message: 'Ticket is not awaiting manager input' });
      return;
    }

    // Manager scope check — only the assigned manager (or IT) can fill it in
    if (req.user!.role === 'manager' && ticket.manager_id !== req.user!.id) {
      res.status(403).json({ message: 'Not assigned to you' });
      return;
    }

    const existing = typeof ticket.onboarding_details === 'string'
      ? JSON.parse(ticket.onboarding_details)
      : (ticket.onboarding_details || {});
    const merged = { ...existing, ...req.body };

    await db('tickets').where({ id: ticket.id }).update({
      onboarding_details: JSON.stringify(merged),
      status: 'it_review',
      manager_decision_at: new Date(),
      manager_notes: req.body.manager_notes || existing.manager_notes || null,
      updated_at: new Date(),
    });

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'manager_review',
      to_status: 'it_review',
      changed_by: req.user!.id,
      comment: 'Manager provided IT requirements',
    });

    res.json({ message: 'IT requirements saved, ticket sent to IT', status: 'it_review' });
  } catch (err) {
    console.error('Onboarding details error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

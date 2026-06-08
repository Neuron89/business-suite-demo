import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTicketSchema, reviewRequestSchema, updateTicketSchema, addCommentSchema, managerOnboardingDetailsSchema, managerIntakeSchema, hrFillSchema, hrConfirmSchema, hrSearchUpdateSchema, setStartDateSchema } from '@onb/shared';
import { notifyOnboardingCreated, notifyManagerCompleted, notifyActivity, notifyManagerSetStartDate, notifyReadyForItClose, sendWelcomePacket, notifyOnboardingCompleted } from '../services/email';
import { syncEmployeeToDirectory, persistNewRole, fetchWelcomePacketPdf } from '../services/directory';

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
/**
 * Look up an employee in the ETD directory and ensure a local `users` row
 * exists for them (auto-provision stub if needed). Returns the resolved
 * users.id or null. Pulled out of POST /tickets so the v2 flow can use it
 * with the submitter's own email (the manager).
 */
async function resolveOrProvisionUserByEmail(email: string): Promise<number | null> {
  const mgrEmail = String(email).toLowerCase().trim();
  let user = await db('users').where({ email: mgrEmail }).first();
  if (user) return user.id;
  try {
    const dirBase = (process.env.DIRECTORY_BASE_URL || 'http://localhost:5065').replace(/\/$/, '');
    const tok = process.env.DIRECTORY_SERVICE_TOKEN || process.env.PORTAL_SERVICE_TOKEN || '';
    const r = await fetch(
      `${dirBase}/api/directory/employees/${encodeURIComponent(mgrEmail)}`,
      { headers: { 'X-Service-Token': tok, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
    );
    if (r.ok) {
      const body: any = await r.json();
      const emp = body?.employee;
      if (emp?.email) {
        const [stub] = await db('users')
          .insert({
            email: emp.email,
            name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || mgrEmail,
            role: 'manager',
            is_active: true,
            password_hash: '!sso-stub',
          })
          .returning('*');
        console.log(`[tickets] auto-provisioned manager stub ${mgrEmail} (id=${stub.id}) from directory`);
        return stub.id;
      }
    }
  } catch (e: any) {
    console.warn('[tickets] directory lookup failed for', mgrEmail, ':', e?.message || e);
  }
  return null;
}

router.post('/', authenticate, validate(createTicketSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const requestNumber = await generateTicketNumber(data.request_type);

    const user = await db('users').where({ id: req.user!.id }).first();
    let managerId: number | null = user?.manager_id || null;
    let categoryId: number | null = data.category_id || null;

    // v2 onboarding flow: the SUBMITTER is the hiring manager. Their email
    // (or whatever they typed in manager_email) becomes the ticket's
    // manager_id. v1 flow (HR-first) is preserved for legacy clients that
    // still send hrOnboardingIntakeSchema payloads under onboarding_details.
    const onboardingDetails = data.onboarding_details || {};
    const isV2Onboarding = data.request_type === 'onboarding' && !onboardingDetails.full_name;
    const flowVersion = isV2Onboarding ? 2 : (data.request_type === 'onboarding' ? 1 : 2);

    if (data.request_type === 'onboarding') {
      // Use the manager_email from the form (manager-first flow normally
      // self-references the submitter, but managers can also requisition
      // for a different reporting line).
      const mgrEmail = onboardingDetails.manager_email
        || (isV2Onboarding ? req.user!.email : null);
      if (mgrEmail) {
        managerId = await resolveOrProvisionUserByEmail(mgrEmail);
      }
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

    // Initial status branches by flow_version. v2 onboarding skips
    // straight to hr_fill (manager already supplied IT requirements at
    // ticket creation). v1 onboarding and non-onboarding tickets keep
    // their existing manager_review path.
    const initialStatus = isV2Onboarding ? 'hr_fill' : 'submitted';

    const [ticket] = await db('tickets').insert({
      request_number: requestNumber,
      requester_id: req.user!.id,
      request_type: data.request_type,
      status: initialStatus,
      flow_version: flowVersion,
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
      to_status: initialStatus,
      changed_by: req.user!.id,
      comment: isV2Onboarding
        ? 'New hire requisition submitted by manager — awaiting HR identity fill'
        : 'Ticket submitted',
    });

    // v1 routing only — v2 tickets are already at hr_fill.
    if (!isV2Onboarding && data.request_type === 'onboarding') {
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
    } else if (!isV2Onboarding && managerId) {
      await db('tickets').where({ id: ticket.id }).update({ status: 'manager_review' });
      await db('ticket_history').insert({
        ticket_id: ticket.id,
        from_status: 'submitted',
        to_status: 'manager_review',
        changed_by: req.user!.id,
        comment: 'Sent to manager for review',
      });
    }

    // Fire notifications for onboarding only. Failures inside email service
    // log but don't throw — the request succeeds either way.
    if (data.request_type === 'onboarding') {
      notifyOnboardingCreated({
        ...ticket,
        manager_id: managerId ?? null,
        onboarding_details: data.onboarding_details,
      }).catch((e) => console.error('[email] notifyOnboardingCreated failed:', e));
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

    const countQuery = query.clone().clearSelect().count<{ total: string }>('tickets.id as total').first();
    const countRow = await countQuery;
    const total = countRow?.total ?? 0;

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

/**
 * v2 onboarding — HR confirms receipt of a requisition (with a note) and the
 * ticket moves hr_fill → hr_searching, recording hr_ack_at. HR then recruits.
 */
router.post('/:id/hr-confirm', authenticate, authorize('hr', 'it_admin'), validate(hrConfirmSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.flow_version !== 2) {
      res.status(400).json({ message: 'HR confirm is only for v2 (manager-first) tickets' });
      return;
    }
    if (ticket.status !== 'hr_fill') {
      res.status(400).json({ message: `Ticket is not awaiting HR (status=${ticket.status})` });
      return;
    }

    await db('tickets').where({ id: ticket.id }).update({
      status: 'hr_searching',
      hr_ack_at: new Date(),
    });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'hr_fill',
      to_status: 'hr_searching',
      changed_by: req.user!.id,
      comment: `HR confirmed receipt: ${req.body.note}`,
    });

    notifyActivity(ticket, req.user!.name || req.user!.email, req.body.note, 'receipt confirmation')
      .catch((e) => console.error('[email] notifyActivity (hr-confirm) failed:', e));

    res.json({ message: 'Receipt confirmed — now searching', status: 'hr_searching' });
  } catch (err) {
    console.error('HR confirm error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * v2 onboarding — HR updates the employee-search status while recruiting.
 * Stored in onboarding_details; does not change ticket status.
 */
router.post('/:id/hr-search-update', authenticate, authorize('hr', 'it_admin'), validate(hrSearchUpdateSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.status !== 'hr_searching') {
      res.status(400).json({ message: `Ticket is not in HR search (status=${ticket.status})` });
      return;
    }

    const existing = typeof ticket.onboarding_details === 'string'
      ? JSON.parse(ticket.onboarding_details)
      : (ticket.onboarding_details || {});
    const merged = {
      ...existing,
      employee_search_status: req.body.search_status,
      employee_search_updated_at: new Date().toISOString(),
    };

    await db('tickets').where({ id: ticket.id }).update({
      onboarding_details: JSON.stringify(merged),
    });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'hr_searching',
      to_status: 'hr_searching',
      changed_by: req.user!.id,
      comment: `HR search update: ${req.body.search_status}`,
    });

    notifyActivity({ ...ticket, onboarding_details: merged }, req.user!.name || req.user!.email, req.body.search_status, 'search update')
      .catch((e) => console.error('[email] notifyActivity (hr-search-update) failed:', e));

    res.json({ message: 'Search status updated', status: 'hr_searching' });
  } catch (err) {
    console.error('HR search update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * v2 onboarding — HR adds employee identity (name, employee#, badge#, etc.)
 * and transitions the ticket from hr_fill → it_close. The submitted payload
 * is merged into onboarding_details JSONB; IT close-out reads it back.
 */
router.post('/:id/hr-fill', authenticate, authorize('hr', 'it_admin', 'manager'), validate(hrFillSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.flow_version !== 2) {
      res.status(400).json({ message: 'HR fill is only for v2 (manager-first) tickets' });
      return;
    }
    if (ticket.status !== 'hr_searching') {
      res.status(400).json({ message: `Ticket is not in HR search (status=${ticket.status}). HR must confirm receipt first.` });
      return;
    }

    // Merge HR's identity payload into existing onboarding_details (which
    // currently contains the manager's intake fields).
    const existing = ticket.onboarding_details || {};
    const merged = { ...existing, ...req.body };

    await db('tickets').where({ id: ticket.id }).update({
      status: 'manager_start_date',
      onboarding_details: JSON.stringify(merged),
      hr_fill_at: new Date(),
    });

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'hr_searching',
      to_status: 'manager_start_date',
      changed_by: req.user!.id,
      comment: `HR added identity for ${req.body.full_name} (emp# ${req.body.employee_number}, badge ${req.body.badge_number}). Awaiting hiring manager to set the start date.`,
    });

    // Manager-added role: now that HR has accepted, persist it to the ETD
    // canonical catalog. Best-effort — never block the ticket on this.
    if (merged.job_title_is_new && merged.job_title) {
      persistNewRole(merged.job_title, merged.department).catch((e) =>
        console.error('[role-persist] failed:', e?.message || e)
      );
    }

    // Ask the hiring manager to set the confirmed start date.
    notifyManagerSetStartDate({ ...ticket, onboarding_details: merged })
      .catch((e) => console.error('[email] notifyManagerSetStartDate failed:', e));

    res.json({ message: 'HR fill complete — sent to the hiring manager to set the start date', status: 'manager_start_date' });
  } catch (err) {
    console.error('HR fill error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * v2 onboarding — the hiring manager sets the confirmed start date, which
 * moves the ticket from manager_start_date → it_close for IT final approval.
 */
router.post('/:id/set-start-date', authenticate, authorize('manager'), validate(setStartDateSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.flow_version !== 2) {
      res.status(400).json({ message: 'Set start date is only for v2 (manager-first) tickets' });
      return;
    }
    if (ticket.status !== 'manager_start_date') {
      res.status(400).json({ message: `Ticket is not awaiting a start date (status=${ticket.status})` });
      return;
    }
    // Only the hiring manager (this ticket's manager) may set the start date.
    if (!ticket.manager_id || ticket.manager_id !== req.user!.id) {
      res.status(403).json({ message: 'Only the hiring manager can set the start date.' });
      return;
    }

    const existing = typeof ticket.onboarding_details === 'string'
      ? JSON.parse(ticket.onboarding_details)
      : (ticket.onboarding_details || {});
    const merged = { ...existing, start_date: req.body.start_date };

    await db('tickets').where({ id: ticket.id }).update({
      status: 'it_close',
      onboarding_details: JSON.stringify(merged),
    });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'manager_start_date',
      to_status: 'it_close',
      changed_by: req.user!.id,
      comment: `Hiring manager set the start date: ${req.body.start_date}`,
    });

    notifyReadyForItClose({ ...ticket, onboarding_details: merged })
      .catch((e) => console.error('[email] notifyReadyForItClose failed:', e));

    res.json({ message: 'Start date set — sent to IT for final approval', status: 'it_close' });
  } catch (err) {
    console.error('Set start date error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * v2 onboarding — IT close-out. Final review. On success, the ETD sync +
 * provisioning hooks fire. Failures in those downstream calls are logged
 * but don't block the close (so a flaky M365 API doesn't lock a ticket).
 */
router.post('/:id/it-close', authenticate, authorize('it_admin'), validate(reviewRequestSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.flow_version !== 2) {
      res.status(400).json({ message: 'IT close is only for v2 (manager-first) tickets' });
      return;
    }
    if (ticket.status !== 'it_close') {
      res.status(400).json({ message: `Ticket is not awaiting IT close (status=${ticket.status})` });
      return;
    }

    const { decision, notes } = req.body;
    const newStatus = decision === 'approved' ? 'completed' : 'denied';

    await db('tickets').where({ id: ticket.id }).update({
      status: newStatus,
      it_admin_id: req.user!.id,
      it_admin_notes: notes || null,
      it_decision_at: new Date(),
      it_close_at: new Date(),
      closed_at: newStatus === 'completed' ? new Date() : null,
    });

    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'it_close',
      to_status: newStatus,
      changed_by: req.user!.id,
      comment: decision === 'approved'
        ? `IT closed: ${notes || 'No notes'}`
        : `IT denied: ${notes || 'No reason given'}`,
    });

    // Fire automation pipeline only on approve. Each step logs its own
    // errors and we don't block the close on any single failure — the
    // ticket is already marked completed and IT can re-run individual
    // steps from the ETD admin UI if needed.
    if (newStatus === 'completed') {
      const completedTicket = { ...ticket, status: newStatus, onboarding_details: ticket.onboarding_details };
      // Always send a completion notification (it@/hiring@/manager) — this
      // fires regardless of the welcome packet below.
      notifyOnboardingCompleted(completedTicket)
        .catch((e) => console.error('[email] notifyOnboardingCompleted failed:', e));
      // Provision into the employee DB, then email the ETD welcome packet to
      // HR + the hiring manager. Sequential (the packet needs the synced
      // employee to exist) and best-effort — failures log, never block close.
      (async () => {
        try {
          await syncEmployeeToDirectory(completedTicket);
        } catch (e) {
          console.error('[it-close] ETD sync failed:', e);
        }
        try {
          const packet = await fetchWelcomePacketPdf(completedTicket);
          if (packet.ok && packet.pdf) {
            await sendWelcomePacket(completedTicket, packet.pdf);
          } else {
            console.warn('[it-close] welcome packet not sent:', packet.reason);
          }
        } catch (e) {
          console.error('[it-close] welcome packet failed:', e);
        }
      })();
    }

    res.json({ message: `Ticket ${decision}`, status: newStatus });
  } catch (err) {
    console.error('IT close error:', err);
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
      ticket_id: parseInt(String(req.params.id)),
      user_id: req.user!.id,
      comment: comment.trim(),
      is_internal: internal,
    }).returning('*');

    // Email the activity to it@ / hiring@ / the manager (onboarding only,
    // best-effort, test-sandbox-safe).
    if (ticket.request_type === 'onboarding') {
      notifyActivity(ticket, req.user!.name || req.user!.email, comment.trim(), internal ? 'internal note' : 'comment')
        .catch((e) => console.error('[email] notifyActivity failed:', e));
    }

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

    // On final completion of an onboarding ticket, push the new hire into
    // the Employee Tech Doc directory. Failure logs but doesn't block.
    if (status === 'completed' && ticket.request_type === 'onboarding') {
      syncEmployeeToDirectory({
        id: ticket.id,
        request_number: ticket.request_number,
        status: 'completed',
        request_type: ticket.request_type,
        manager_id: ticket.manager_id,
        onboarding_details: ticket.onboarding_details,
      }).catch((e) => console.error('[directory] sync threw:', e));
    }

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

    notifyManagerCompleted({
      ...ticket,
      onboarding_details: merged,
    }).catch((e) => console.error('[email] notifyManagerCompleted failed:', e));

    res.json({ message: 'IT requirements saved, ticket sent to IT', status: 'it_review' });
  } catch (err) {
    console.error('Onboarding details error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

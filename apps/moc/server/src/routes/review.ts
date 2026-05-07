import { Router, Request, Response } from 'express';
import { createReviewSchema, createReviewNoteSchema, updateReviewNoteSchema } from '@moc/shared';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { emailUserForMoc, mocApprovedEmail, mocRejectedEmail, mocReturnedEmail, mocTransitionEmail, sendRoleNotification } from '../services/email';
import { getRequiredReviews } from '../services/workflow';
import {
  approverSummary,
  listApprovers,
  recordApproverDecision,
  resetApproversForCycle,
} from '../services/approvers';
import { DSR_TEMPLATE_ITEMS } from '../templates/dsr-template';

const router = Router();

// ── Review Notes ────────────────────────────────────────────────────────

// GET /api/review/:mocId/notes — list all notes for a MOC
router.get('/:mocId/notes', authenticate, async (req: Request, res: Response) => {
  try {
    const notes = await db('review_notes')
      .join('users as author', 'review_notes.author_id', 'author.id')
      .leftJoin('users as resolver', 'review_notes.resolved_by', 'resolver.id')
      .select(
        'review_notes.*',
        'author.name as author_name',
        'author.role as author_role',
        'resolver.name as resolved_by_name',
      )
      .where('review_notes.moc_id', req.params.mocId)
      .orderBy('review_notes.created_at', 'desc');

    res.json(notes);
  } catch (err) {
    console.error('Review notes list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/review/notes — create a note
router.post('/notes', authenticate, validate(createReviewNoteSchema), async (req: Request, res: Response) => {
  try {
    const { moc_id, section_id, note } = req.body;
    const user = req.user!;

    const moc = await db('moc_requests').where('id', moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const [created] = await db('review_notes')
      .insert({
        moc_id,
        author_id: user.id,
        section_id,
        note,
      })
      .returning('*');

    res.status(201).json(created);
  } catch (err) {
    console.error('Create review note error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/review/notes/:noteId — edit note text (author only) or toggle resolved (anyone)
router.patch('/notes/:noteId', authenticate, validate(updateReviewNoteSchema), async (req: Request, res: Response) => {
  try {
    const noteId = Number(req.params.noteId);
    const user = req.user!;

    const existing = await db('review_notes').where('id', noteId).first();
    if (!existing) {
      res.status(404).json({ message: 'Note not found' });
      return;
    }

    const updates: Record<string, any> = { updated_at: db.fn.now() };

    // Only author can edit note text
    if (req.body.note !== undefined) {
      if (existing.author_id !== user.id) {
        res.status(403).json({ message: 'Only the author can edit the note text' });
        return;
      }
      updates.note = req.body.note;
    }

    // Anyone can toggle resolved
    if (req.body.resolved !== undefined) {
      updates.resolved = req.body.resolved;
      if (req.body.resolved) {
        updates.resolved_by = user.id;
        updates.resolved_at = db.fn.now();
      } else {
        updates.resolved_by = null;
        updates.resolved_at = null;
      }
    }

    await db('review_notes').where('id', noteId).update(updates);
    const updated = await db('review_notes').where('id', noteId).first();
    res.json(updated);
  } catch (err) {
    console.error('Update review note error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/review/notes/:noteId — delete note (author or admin only)
router.delete('/notes/:noteId', authenticate, async (req: Request, res: Response) => {
  try {
    const noteId = Number(req.params.noteId);
    const user = req.user!;

    const existing = await db('review_notes').where('id', noteId).first();
    if (!existing) {
      res.status(404).json({ message: 'Note not found' });
      return;
    }

    if (existing.author_id !== user.id && user.role !== 'admin' && user.role !== 'moc_manager') {
      res.status(403).json({ message: 'Only the author or an admin can delete this note' });
      return;
    }

    await db('review_notes').where('id', noteId).del();
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Delete review note error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Formal Reviews ──────────────────────────────────────────────────────

// GET /api/review/:mocId
// Returns both the new named approver list AND legacy reviews-by-role so the
// client can render either shape during the transition.
router.get('/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const mocId = Number(req.params.mocId);
    const [approvers, reviews] = await Promise.all([
      listApprovers(mocId),
      db('reviews')
        .join('users', 'reviews.reviewer_id', 'users.id')
        .select('reviews.*', 'users.name as reviewer_name')
        .where('moc_id', mocId)
        .orderBy('reviews.created_at', 'desc'),
    ]);
    res.json({ approvers, reviews });
  } catch (err) {
    console.error('Review list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/review — submit a named-user review decision
// Body: { moc_id, decision: 'approved'|'rejected'|'returned', comments }
// Only users present in moc_approvers for this MOC can act; admin_access bypasses.
router.post('/', authenticate, validate(createReviewSchema), async (req: Request, res: Response) => {
  try {
    const { moc_id, decision, comments } = req.body;
    const user = req.user!;

    const moc = await db('moc_requests').where('id', moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }
    if (moc.status !== 'under_review') {
      res.status(400).json({ message: 'MOC is not under review' });
      return;
    }

    const isAdmin = ['admin', 'super_admin', 'moc_manager'].includes(user.role) || user.admin_access === true;

    // Find this user's approver row on the MOC
    const approverRow = await db('moc_approvers')
      .where({ moc_id, user_id: user.id })
      .first();

    if (!approverRow && !isAdmin) {
      res.status(403).json({ message: 'You are not assigned as an approver on this MOC' });
      return;
    }

    // Gate: the acting user must have is_approver=true (unless admin bypass)
    if (!isAdmin && !user.is_approver) {
      res.status(403).json({ message: 'You do not have approver permission' });
      return;
    }

    // Record the decision in moc_approvers. Admin-without-row = acts on Rob's
    // behalf? No — admins should add themselves explicitly. Here we just upsert
    // an admin-override row so the audit trail shows who acted.
    if (approverRow) {
      await recordApproverDecision(moc_id, user.id, decision, comments || null);
    } else {
      await db('moc_approvers')
        .insert({
          moc_id,
          user_id: user.id,
          role_context: `admin_override:${user.role}`,
          decision,
          comments: comments || null,
          decided_at: db.fn.now(),
        })
        .onConflict(['moc_id', 'user_id', 'role_context'])
        .merge({ decision, comments: comments || null, decided_at: db.fn.now() });
    }

    await logAudit(req, 'review', 'moc_request', moc_id, { decision, comments, role: user.role, admin_override: !approverRow });

    const mocDesc = moc.description || '';
    const mocNum = moc.moc_number || '';
    const mocLabel = mocNum || `MOC #${moc_id}`;
    const actorRole = user.role.toUpperCase();
    const creatorId = moc.created_by;

    // Rejected: full reset — flip status, bump cycle, clear all approver decisions
    if (decision === 'rejected') {
      await db('moc_requests').where('id', moc_id).update({ status: 'rejected', updated_at: db.fn.now() });
      await db('workflow_history').insert({
        moc_id, from_status: 'under_review', to_status: 'rejected',
        changed_by: user.id, comment: comments || `Rejected by ${user.name || user.role}`,
      });
      await resetApproversForCycle(moc_id);
      await emailUserForMoc(moc.created_by, `${mocLabel} Rejected`, moc_id, (link) =>
        mocRejectedEmail(moc_id, moc.title, mocDesc, actorRole, comments || '', link, mocNum));
      res.json({ message: 'MOC rejected — approval flow has been reset', new_status: 'rejected' });
      return;
    }

    // Returned: status change, other approvers keep their decisions (creator fixes + resubmits)
    if (decision === 'returned') {
      await db('moc_requests').where('id', moc_id).update({ status: 'returned', updated_at: db.fn.now() });
      await db('workflow_history').insert({
        moc_id, from_status: 'under_review', to_status: 'returned',
        changed_by: user.id, comment: comments || `Returned by ${user.name || user.role}`,
      });
      await emailUserForMoc(moc.created_by, `${mocLabel} Returned`, moc_id, (link) =>
        mocReturnedEmail(moc_id, moc.title, mocDesc, actorRole, comments || '', link, mocNum));
      res.json({ message: 'MOC returned for more info', new_status: 'returned' });
      return;
    }

    // Approved — check whether every approver has approved
    const summary = await approverSummary(moc_id);

    // Rob's approval is always required (hard gate). If he hasn't approved yet
    // but everyone else has, we stay in under_review until he decides.
    if (!summary.managementApproved && !isAdmin) {
      res.json({
        message: 'Decision recorded — awaiting remaining approvers',
        summary,
      });
      return;
    }

    if (summary.allApproved) {
      const requiredReviewTypes = getRequiredReviews(moc);
      const deptsInvolved: string[] = Array.isArray(moc.departments_involved)
        ? moc.departments_involved
        : (typeof moc.departments_involved === 'string' ? JSON.parse(moc.departments_involved) : []);
      const maintenanceInvolved = deptsInvolved.includes('maintenance');

      let needsDsr = requiredReviewTypes.includes('DSR') || maintenanceInvolved;
      const needsPssr = requiredReviewTypes.includes('PSSR');
      const nextStatus = needsDsr ? 'dsr' : needsPssr ? 'pssr_pending' : 'ready_for_startup';

      const statusUpdate: Record<string, any> = { status: nextStatus, updated_at: db.fn.now() };
      if (needsDsr && !maintenanceInvolved) {
        statusUpdate.departments_involved = [...deptsInvolved, 'maintenance'];
      }
      await db('moc_requests').where('id', moc_id).update(statusUpdate);
      await db('workflow_history').insert({
        moc_id, from_status: 'under_review', to_status: nextStatus,
        changed_by: user.id, comment: `All named approvers approved — advancing to ${nextStatus.replace(/_/g, ' ')}`,
      });

      if (nextStatus === 'dsr') {
        const existingDsr = await db('dsr_checklists').where('moc_id', moc_id).first();
        if (!existingDsr) {
          const [checklist] = await db('dsr_checklists')
            .insert({ moc_id, created_by: user.id })
            .returning('*');
          const items = DSR_TEMPLATE_ITEMS.map((t: any) => ({
            checklist_id: checklist.id,
            category: t.category,
            description: t.description,
            status: 'pending',
          }));
          await db('dsr_items').insert(items);
        }
      }

      await emailUserForMoc(moc.created_by, `${mocLabel} Approved`, moc_id, (link) =>
        mocApprovedEmail(moc_id, moc.title, mocDesc, link, mocNum));

      if (nextStatus === 'dsr') {
        await sendRoleNotification(['ehs'], `${mocLabel} — DSR Required`, moc_id, (link) =>
          mocTransitionEmail(moc_id, moc.title, mocDesc, 'DSR',
            'All approvers have approved. A DSR is now required.', link, mocNum), creatorId);
      }

      res.json({ message: `MOC approved — advancing to ${nextStatus.replace(/_/g, ' ')}`, new_status: nextStatus });
      return;
    }

    res.json({
      message: 'Decision recorded — awaiting remaining approvers',
      summary,
    });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/review/:mocId/approvers — just the named approver list (for UI panels)
router.get('/:mocId/approvers', authenticate, async (req: Request, res: Response) => {
  try {
    const approvers = await listApprovers(Number(req.params.mocId));
    res.json(approvers);
  } catch (err) {
    console.error('List approvers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/review/:mocId/approvers — admin adds a named approver to a MOC
router.post('/:mocId/approvers', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = ['admin', 'super_admin', 'moc_manager'].includes(user.role) || user.admin_access === true;
    if (!isAdmin) {
      res.status(403).json({ message: 'Admin only' });
      return;
    }
    const mocId = Number(req.params.mocId);
    const { user_id, role_context } = req.body as { user_id: number; role_context: string };
    if (!user_id || !role_context) {
      res.status(400).json({ message: 'user_id and role_context are required' });
      return;
    }
    await db('moc_approvers')
      .insert({ moc_id: mocId, user_id, role_context, decision: 'pending' })
      .onConflict(['moc_id', 'user_id', 'role_context'])
      .ignore();
    await logAudit(req, 'add_approver', 'moc_request', mocId, { user_id, role_context });
    res.json({ message: 'Approver added' });
  } catch (err) {
    console.error('Add approver error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/review/:mocId/approvers/:approverId
router.delete('/:mocId/approvers/:approverId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = ['admin', 'super_admin', 'moc_manager'].includes(user.role) || user.admin_access === true;
    if (!isAdmin) {
      res.status(403).json({ message: 'Admin only' });
      return;
    }
    const approverId = Number(req.params.approverId);
    const mocId = Number(req.params.mocId);
    await db('moc_approvers').where({ id: approverId, moc_id: mocId }).del();
    await logAudit(req, 'remove_approver', 'moc_request', mocId, { approver_id: approverId });
    res.json({ message: 'Approver removed' });
  } catch (err) {
    console.error('Remove approver error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

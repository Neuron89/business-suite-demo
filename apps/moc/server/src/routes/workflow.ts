import { Router, Request, Response } from 'express';
import { transitionSchema } from '@moc/shared';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { transitionMoc, WorkflowError } from '../services/workflow';
import { logAudit } from '../middleware/audit';
import { notifyRoleUsers } from '../services/notifications';
import { sendMocNotification, sendRoleNotification, emailUserForMoc, mocSubmittedEmail, mocReadyForReviewEmail, mocTransitionEmail } from '../services/email';

const router = Router();

// POST /api/workflow/transition
router.post('/transition', authenticate, validate(transitionSchema), async (req: Request, res: Response) => {
  try {
    const { moc_id, to_status, comment } = req.body;
    const user = req.user!;

    const result = await transitionMoc(moc_id, to_status, user.id, user.role, comment);

    await logAudit(req, 'transition', 'moc_request', moc_id, {
      from: result.from,
      to: result.to,
      comment,
    });

    const moc = await db('moc_requests').where('id', moc_id).first();
    const mocTitle = moc?.title || `MOC #${moc_id}`;
    const mocDesc = moc?.description || '';
    const mocNum = moc?.moc_number || '';
    const mocLabel = mocNum || `MOC #${moc_id}`;
    const creatorId = moc?.created_by;

    // Notify relevant roles (in-app + email) — consolidated, deduplicated
    if (to_status === 'submitted') {
      // Re-submitted (from returned) — notify EHS
      await notifyRoleUsers('ehs', 'MOC Re-submitted', `${mocLabel} has been re-submitted for review.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} Re-submitted`, moc_id, (link) =>
        mocSubmittedEmail(moc_id, mocTitle, mocDesc, user.name, link, mocNum), creatorId);
    } else if (to_status === 'under_review') {
      // All reviewers — consolidated notification
      for (const role of ['ehs', 'operations', 'qc']) {
        await notifyRoleUsers(role, 'MOC Ready for Review', `${mocLabel} is ready for your review.`, 'action', 'moc_request', moc_id);
      }
      await sendMocNotification(moc_id, `${mocLabel} — Your Review Needed`, (link) =>
        mocReadyForReviewEmail(moc_id, mocTitle, mocDesc, link, mocNum), creatorId);
    } else if (to_status === 'pssr_pending') {
      await notifyRoleUsers('ehs', 'PSSR Required', `${mocLabel} needs a Pre-Startup Safety Review.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} — PSSR Required`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'PSSR Pending', 'Implementation is complete. A Pre-Startup Safety Review is now required.', link, mocNum), creatorId);
    } else if (to_status === 'dsr') {
      await notifyRoleUsers('ehs', 'DSR Required', `${mocLabel} needs a DSR.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} — DSR Required`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'DSR', 'All reviewers have approved. A DSR is now required.', link, mocNum), creatorId);
    } else if (to_status === 'pssr_complete') {
      await notifyRoleUsers('ehs', 'PSSR Complete', `${mocLabel} PSSR is complete.`, 'info', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} — PSSR Complete`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'PSSR Complete', 'The PSSR is complete.', link, mocNum), creatorId);
    } else if (to_status === 'orc') {
      await notifyRoleUsers('ehs', 'ORC Review Required', `${mocLabel} needs Operations Review Committee review.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} — ORC Review Required`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'ORC Review', 'An Operations Review Committee (ORC) review is required.', link, mocNum), creatorId);
    } else if (to_status === 'ready_for_startup') {
      await notifyRoleUsers('operations', 'Ready for Startup', `${mocLabel} is ready for startup.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['operations'], `${mocLabel} — Ready for Startup`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'Ready for Startup', 'All reviews are complete. This MOC is ready for startup.', link, mocNum), creatorId);
    } else if (to_status === 'awaiting_action_items') {
      await notifyRoleUsers('ehs', 'Post-Startup Items Pending', `${mocLabel} has outstanding post-startup action items.`, 'action', 'moc_request', moc_id);
      await sendRoleNotification(['ehs'], `${mocLabel} — Post-Startup Items`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'Awaiting Action Items', 'Post-startup action items need to be resolved before closing.', link, mocNum), creatorId);
    } else if (to_status === 'closed') {
      // Notify the creator directly
      await emailUserForMoc(moc.created_by, `${mocLabel} — Closed`, moc_id, (link) =>
        mocTransitionEmail(moc_id, mocTitle, mocDesc, 'Closed', 'Your MOC has been closed.', link, mocNum));
    }

    res.json({ message: `Transitioned from ${result.from} to ${result.to}`, ...result });
  } catch (err) {
    if (err instanceof WorkflowError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    console.error('Workflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/workflow/history/:mocId
router.get('/history/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const history = await db('workflow_history')
      .join('users', 'workflow_history.changed_by', 'users.id')
      .select('workflow_history.*', 'users.name as changer_name')
      .where('moc_id', req.params.mocId)
      .orderBy('workflow_history.created_at', 'asc');

    res.json(history);
  } catch (err) {
    console.error('Workflow history error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

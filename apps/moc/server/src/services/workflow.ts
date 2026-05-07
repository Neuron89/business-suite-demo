import { WORKFLOW_TRANSITIONS, ADMIN_ROLES, type MocStatus, type Role, type WorkflowConfig, type SkippableStep, type CrfRiskLevel, type CrfChangeType, getCrfChangeCategory, getEffectiveReviewsRequired } from '@moc/shared';
import db from '../db/connection';

export class WorkflowError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'WorkflowError';
    this.status = status;
  }
}

/**
 * Get effective transitions for a status, respecting template skip_steps.
 * E.g., if risk_assessment is skipped, submitted → under_review directly.
 * If pssr_pending/pssr_complete are skipped, implementing → closed directly.
 */
export function getEffectiveTransitions(
  currentStatus: MocStatus,
  workflowConfig?: WorkflowConfig | null
): { to: MocStatus; roles: Role[] }[] {
  const baseTransitions = WORKFLOW_TRANSITIONS[currentStatus];
  if (!baseTransitions) return [];

  if (!workflowConfig || !workflowConfig.skip_steps || workflowConfig.skip_steps.length === 0) {
    return baseTransitions;
  }

  const skipSteps = workflowConfig.skip_steps as SkippableStep[];

  // If the target status of any transition is in skip_steps, we need to chain forward
  return baseTransitions.map((t) => {
    if (skipSteps.includes(t.to as SkippableStep)) {
      // Find what comes after the skipped step
      const nextTransitions = WORKFLOW_TRANSITIONS[t.to];
      if (nextTransitions && nextTransitions.length > 0) {
        // Recursively resolve the next non-skipped step
        let target = nextTransitions[0].to;
        while (skipSteps.includes(target as SkippableStep)) {
          const further = WORKFLOW_TRANSITIONS[target];
          if (further && further.length > 0) {
            target = further[0].to;
          } else {
            break;
          }
        }
        return { to: target, roles: t.roles };
      }
    }
    return t;
  });
}

/**
 * Load workflow config for a MOC from its template.
 */
export async function getWorkflowConfig(mocId: number): Promise<WorkflowConfig | null> {
  const moc = await db('moc_requests').where('id', mocId).first();
  if (!moc || !moc.template_id) return null;

  const template = await db('moc_templates').where('id', moc.template_id).first();
  if (!template) return null;

  return typeof template.workflow_config === 'string'
    ? JSON.parse(template.workflow_config)
    : template.workflow_config;
}

export async function transitionMoc(
  mocId: number,
  toStatus: MocStatus,
  userId: number,
  userRole: Role,
  comment = ''
): Promise<{ from: MocStatus; to: MocStatus }> {
  const moc = await db('moc_requests').where('id', mocId).first();
  if (!moc) throw new WorkflowError('MOC not found', 404);

  const currentStatus = moc.status as MocStatus;

  // Get template-aware transitions
  const workflowConfig = await getWorkflowConfig(mocId);
  const allowedTransitions = getEffectiveTransitions(currentStatus, workflowConfig);

  if (!allowedTransitions || allowedTransitions.length === 0) {
    throw new WorkflowError(`No transitions available from status "${currentStatus}"`);
  }

  const transition = allowedTransitions.find((t) => t.to === toStatus);
  if (!transition) {
    throw new WorkflowError(`Cannot transition from "${currentStatus}" to "${toStatus}"`);
  }

  if (!transition.roles.includes(userRole)) {
    throw new WorkflowError(
      `Role "${userRole}" is not permitted to transition from "${currentStatus}" to "${toStatus}"`,
      403
    );
  }

  // DSR ownership gate: only MOC owner or admins can advance from DSR
  if (currentStatus === 'dsr') {
    const isOwner = moc.created_by === userId || moc.transferred_to === userId;
    const isAdmin = ADMIN_ROLES.includes(userRole);
    if (!isOwner && !isAdmin) {
      throw new WorkflowError(
        'Only the MOC owner or administrators can advance from the DSR phase',
        403
      );
    }
  }

  // under_review → forward step gate: department approval is no longer
  // required, but to prevent any reviewer from sending the MOC down the
  // wrong path, only the MOC owner or an admin can advance it manually.
  // (rejected / returned are still open to all reviewers — those are review
  // actions, not advancement.)
  if (
    currentStatus === 'under_review' &&
    toStatus !== 'rejected' &&
    toStatus !== 'returned'
  ) {
    const isOwner = moc.created_by === userId || moc.transferred_to === userId;
    const isAdmin = ADMIN_ROLES.includes(userRole);
    if (!isOwner && !isAdmin) {
      throw new WorkflowError(
        'Only the MOC owner or administrators can advance from Under Review',
        403
      );
    }
  }

  // DSR gate: before leaving DSR status, ensure all fail items have action_resolved
  // AND that Rob (management) has signed off on the DSR.
  if (currentStatus === 'dsr') {
    const dsrChecklist = await db('dsr_checklists').where('moc_id', mocId).first();
    if (dsrChecklist) {
      const unresolvedFails = await db('dsr_items')
        .where('checklist_id', dsrChecklist.id)
        .where('status', 'fail')
        .where('action_resolved', false)
        .count('id as count')
        .first();
      if (parseInt(String(unresolvedFails?.count)) > 0) {
        throw new WorkflowError('All DSR action items must be resolved before proceeding');
      }
      const mgmtSignoff = await db('dsr_signoffs')
        .where({ checklist_id: dsrChecklist.id, role: 'management' })
        .first();
      if (!mgmtSignoff) {
        throw new WorkflowError('Management (Plant Manager) must sign off on the DSR before it can be completed');
      }
    }
  }

  // PSSR gate: before leaving pssr_pending, ensure all pre-startup fail items are resolved
  // AND that Rob (management) has signed off on the PSSR.
  if (currentStatus === 'pssr_pending') {
    const pssrChecklist = await db('pssr_checklists').where('moc_id', mocId).first();
    if (pssrChecklist) {
      const unresolvedPreStartup = await db('pssr_items')
        .where('checklist_id', pssrChecklist.id)
        .where('status', 'fail')
        .where('action_resolved', false)
        .where(function () {
          this.where('action_type', 'pre_startup').orWhereNull('action_type');
        })
        .count('id as count')
        .first();
      if (parseInt(String(unresolvedPreStartup?.count)) > 0) {
        throw new WorkflowError('All pre-startup PSSR action items must be resolved before proceeding. Post-startup items can be completed later.');
      }
      const mgmtSignoff = await db('pssr_signoffs')
        .where({ checklist_id: pssrChecklist.id, role: 'management' })
        .first();
      if (!mgmtSignoff) {
        throw new WorkflowError('Management (Plant Manager) must sign off on the PSSR before it can be completed');
      }
    }
  }

  // Close gate: before closing, ensure ALL action items (DSR + PSSR) are resolved
  if (toStatus === 'closed') {
    const dsrChecklist = await db('dsr_checklists').where('moc_id', mocId).first();
    if (dsrChecklist) {
      const unresolvedDsr = await db('dsr_items')
        .where('checklist_id', dsrChecklist.id)
        .where('status', 'fail')
        .where('action_resolved', false)
        .count('id as count')
        .first();
      if (parseInt(String(unresolvedDsr?.count)) > 0) {
        throw new WorkflowError('All DSR action items must be resolved before closing');
      }
    }
    const pssrChecklist = await db('pssr_checklists').where('moc_id', mocId).first();
    if (pssrChecklist) {
      const unresolvedPssr = await db('pssr_items')
        .where('checklist_id', pssrChecklist.id)
        .where('status', 'fail')
        .where('action_resolved', false)
        .count('id as count')
        .first();
      if (parseInt(String(unresolvedPssr?.count)) > 0) {
        throw new WorkflowError('All PSSR action items (including post-startup) must be resolved before closing');
      }
    }
  }

  // Smart phase skipping: if transitioning to pssr_pending but PSSR not required, skip to ready_for_startup
  let finalStatus = toStatus;
  const requiredReviews = getRequiredReviews(moc);
  if (toStatus === 'pssr_pending' && !requiredReviews.includes('PSSR')) {
    finalStatus = 'ready_for_startup' as MocStatus;
  }
  // If transitioning to implementing (backward compat), redirect to pssr_pending or ready_for_startup
  if (toStatus === 'implementing') {
    finalStatus = requiredReviews.includes('PSSR') ? 'pssr_pending' as MocStatus : 'ready_for_startup' as MocStatus;
  }

  await db('moc_requests')
    .where('id', mocId)
    .update({ status: finalStatus, updated_at: db.fn.now() });

  await db('workflow_history').insert({
    moc_id: mocId,
    from_status: currentStatus,
    to_status: finalStatus,
    changed_by: userId,
    comment: finalStatus !== toStatus ? `${comment} (${toStatus.replace(/_/g, ' ')} skipped — not required by risk level)`.trim() : comment,
  });

  // Auto-create PSSR checklist when entering pssr_pending
  if (finalStatus === 'pssr_pending') {
    await autoCreatePssr(mocId, userId);
  }

  return { from: currentStatus, to: finalStatus };
}

/**
 * Auto-create PSSR checklist if it doesn't exist.
 */
async function autoCreatePssr(mocId: number, userId: number): Promise<void> {
  const existing = await db('pssr_checklists').where('moc_id', mocId).first();
  if (existing) return;
  const { PSSR_TEMPLATE_ITEMS } = require('../templates/pssr-template');
  const [checklist] = await db('pssr_checklists')
    .insert({ moc_id: mocId, created_by: userId })
    .returning('*');
  await db('pssr_items').insert(
    PSSR_TEMPLATE_ITEMS.map((t: any) => ({
      checklist_id: checklist.id,
      category: t.category,
      description: t.description,
      status: 'pending',
    }))
  );
}

/**
 * Determine which review phases are required for a MOC based on its risk level.
 * Returns the set of required review types (DSR, PSSR, HAZOP, ORC).
 */
export function getRequiredReviews(moc: any): string[] {
  if (!moc.crf_risk_level || moc.crf_risk_level === '---') return [];
  const riskLevel = moc.crf_risk_level as CrfRiskLevel;
  const changeType = moc.crf_change_type as CrfChangeType;
  // Default to chemical_equipment_tech (more conservative) if no change type specified
  const category = changeType ? getCrfChangeCategory(changeType) : 'chemical_equipment_tech';
  const riskAnswers = typeof moc.crf_risk_answers === 'string'
    ? JSON.parse(moc.crf_risk_answers)
    : moc.crf_risk_answers;
  return getEffectiveReviewsRequired(riskLevel, category as any, riskAnswers);
}

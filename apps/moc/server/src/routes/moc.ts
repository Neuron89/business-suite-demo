import { Router, Request, Response } from 'express';
import { createMocSchema, updateMocSchema, updateMocAdminFieldsSchema, saveDraftMocSchema, mocFilterSchema, getRiskLevel, CRF_TO_LEGACY_CHANGE_TYPE, calculateCrfRiskLevel, CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS, CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS, ALWAYS_REQUIRED_DEPARTMENTS } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize, isSuperAdmin, isAdminUser, isMocOwner } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { notifyRoleUsers } from '../services/notifications';
import { sendMocNotification, mocSubmittedEmail } from '../services/email';
import { getRequiredReviews } from '../services/workflow';
import { DSR_TEMPLATE_ITEMS } from '../templates/dsr-template';
import { PSSR_TEMPLATE_ITEMS } from '../templates/pssr-template';

/** Generate the next MOC number: MOC-YYYY-###-LEVEL within a transaction. */
async function generateMocNumber(trx: any, riskLevel: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MOC-${year}-`;
  // Select the highest moc_number with a row-level lock to prevent duplicates
  const result = await trx('moc_requests')
    .where('moc_number', 'like', `${prefix}%`)
    .orderBy('moc_number', 'desc')
    .forUpdate()
    .first();
  let seq = 1;
  if (result?.moc_number) {
    // Format: MOC-YYYY-NNN-LEVEL — extract NNN part (index 2 after split on '-')
    const parts = result.moc_number.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  // Map '---' or missing risk level to 'L0'
  const suffix = ['L0', 'L1', 'L2', 'L3'].includes(riskLevel) ? riskLevel : 'L0';
  return `MOC-${year}-${String(seq).padStart(3, '0')}-${suffix}`;
}

/** Compute CRF risk level from risk answers. Returns the level string. */
function computeCrfRiskLevel(riskAnswers: any): string {
  if (!riskAnswers) return '---';
  const countYeses = (answers: Record<string, boolean>, keys: readonly string[]) =>
    keys.reduce((n: number, k: string) => n + (answers[k] ? 1 : 0), 0);
  return calculateCrfRiskLevel(
    countYeses(riskAnswers.hazard_l1 || {}, CRF_HAZARD_L1_QUESTIONS),
    countYeses(riskAnswers.hazard_l2 || {}, CRF_HAZARD_L2_QUESTIONS),
    countYeses(riskAnswers.significance_l0 || {}, CRF_SIGNIFICANCE_L0_QUESTIONS),
    countYeses(riskAnswers.significance_l1 || {}, CRF_SIGNIFICANCE_L1_QUESTIONS),
    countYeses(riskAnswers.significance_l2 || {}, CRF_SIGNIFICANCE_L2_QUESTIONS),
  );
}

/** Serialize CRF JSONB fields for insert/update. */
function serializeCrfFields(data: Record<string, any>): void {
  if (data.impact_assessment && typeof data.impact_assessment !== 'string') data.impact_assessment = JSON.stringify(data.impact_assessment);
  if (data.crf_risk_answers && typeof data.crf_risk_answers !== 'string') data.crf_risk_answers = JSON.stringify(data.crf_risk_answers);
  if (data.implementation_tasks && typeof data.implementation_tasks !== 'string') data.implementation_tasks = JSON.stringify(data.implementation_tasks);
  if (data.post_impl_verifications && typeof data.post_impl_verifications !== 'string') data.post_impl_verifications = JSON.stringify(data.post_impl_verifications);
  if (data.attachment_checklist && typeof data.attachment_checklist !== 'string') data.attachment_checklist = JSON.stringify(data.attachment_checklist);
}

/** Auto-create DSR and/or PSSR checklists based on risk level at MOC submission time.
 *  Enforces bidirectional rule: Maintenance ↔ DSR (maintenance requires DSR, DSR requires maintenance). */
async function autoCreateChecklists(moc: any, userId: number): Promise<void> {
  try {
    const reviews = getRequiredReviews(moc);
    const currentDepts: string[] = moc.departments_involved || [];
    const maintenanceInvolved = currentDepts.includes('maintenance');
    // Bidirectional: DSR required by risk OR maintenance is involved
    const needsDsr = reviews.includes('DSR') || maintenanceInvolved;
    console.log(`Auto-create checklists for MOC ${moc.id}: risk=${moc.crf_risk_level}, reviews=${reviews.join(',')}, maintenance=${maintenanceInvolved}, needsDsr=${needsDsr}`);

    if (needsDsr) {
      // Ensure maintenance is in departments_involved
      if (!maintenanceInvolved) {
        const updatedDepts = [...currentDepts, 'maintenance'];
        await db('moc_requests').where('id', moc.id).update({
          departments_involved: updatedDepts,
        });
        moc.departments_involved = updatedDepts;
        console.log(`  Auto-added maintenance to departments_involved for DSR`);
      }

      const existingDsr = await db('dsr_checklists').where('moc_id', moc.id).first();
      if (!existingDsr) {
        const [checklist] = await db('dsr_checklists')
          .insert({ moc_id: moc.id, created_by: userId })
          .returning('*');
        await db('dsr_items').insert(
          DSR_TEMPLATE_ITEMS.map((t) => ({
            checklist_id: checklist.id,
            category: t.category,
            description: t.description,
            status: 'pending',
          }))
        );
        console.log(`  Created DSR checklist with ${DSR_TEMPLATE_ITEMS.length} items`);
      }
    }

    if (reviews.includes('PSSR')) {
      const existingPssr = await db('pssr_checklists').where('moc_id', moc.id).first();
      if (!existingPssr) {
        const [checklist] = await db('pssr_checklists')
          .insert({ moc_id: moc.id, created_by: userId })
          .returning('*');
        console.log(`  PSSR template has ${PSSR_TEMPLATE_ITEMS.length} items`);
        await db('pssr_items').insert(
          PSSR_TEMPLATE_ITEMS.map((t) => ({
            checklist_id: checklist.id,
            category: t.category,
            description: t.description,
            status: 'pending',
          }))
        );
        console.log(`  Created PSSR checklist with ${PSSR_TEMPLATE_ITEMS.length} items`);
      }
    }
  } catch (err) {
    console.error('Auto-create checklists error:', err);
  }
}

/** Ensure always-required departments (management) are included in departments_involved. */
function ensureRequiredDepartments(departments: string[]): string[] {
  const depts = new Set(departments);
  for (const d of ALWAYS_REQUIRED_DEPARTMENTS) {
    depts.add(d);
  }
  return [...depts];
}

const router = Router();

// GET /api/moc — list with filters, search, pagination
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const filters = mocFilterSchema.parse(req.query);
    const { status, change_type, exclude_status, search, page, limit } = filters;

    let query = db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .leftJoin('users as transferee', 'moc_requests.transferred_to', 'transferee.id')
      .leftJoin('moc_templates', 'moc_requests.template_id', 'moc_templates.id')
      .select(
        'moc_requests.*',
        'users.name as creator_name',
        'transferee.name as transferred_to_name',
        'moc_templates.name as template_name'
      );

    if (status) query = query.where('moc_requests.status', status);
    if (change_type) query = query.where('moc_requests.change_type', change_type);
    if (exclude_status) {
      const excluded = exclude_status.split(',').map((s) => s.trim()).filter(Boolean);
      if (excluded.length > 0) query = query.whereNotIn('moc_requests.status', excluded);
    }
    if (search) {
      query = query.whereRaw(
        "moc_requests.search_vector @@ plainto_tsquery('english', ?)",
        [search]
      );
    }

    const countResult = await query.clone().clearSelect().count('moc_requests.id as total').first();
    const total = parseInt(String(countResult?.total || '0'));

    const data = await query
      .orderBy('moc_requests.updated_at', 'desc')
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
    console.error('MOC list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/moc/public — public dashboard data (no auth)
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const total = await db('moc_requests').count('id as count').first();
    const byStatus = await db('moc_requests')
      .select('status')
      .count('id as count')
      .groupBy('status');
    const byRisk = await db('risk_assessments')
      .select('risk_level_before')
      .count('id as count')
      .groupBy('risk_level_before');
    const recentActivity = await db('workflow_history')
      .join('users', 'workflow_history.changed_by', 'users.id')
      .select('workflow_history.*', 'users.name as changer_name')
      .orderBy('workflow_history.created_at', 'desc')
      .limit(10);
    const openMocs = await db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .select('moc_requests.id', 'moc_requests.title', 'moc_requests.status', 'moc_requests.change_type', 'users.name as creator_name', 'moc_requests.updated_at')
      .whereNotIn('moc_requests.status', ['closed', 'draft'])
      .orderBy('moc_requests.updated_at', 'desc')
      .limit(20);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row.status] = parseInt(String(row.count));

    const riskMap: Record<string, number> = {};
    for (const row of byRisk) riskMap[row.risk_level_before] = parseInt(String(row.count));

    res.json({
      total_mocs: parseInt(String(total?.count || '0')),
      open_mocs: openMocs.length,
      by_status: statusMap,
      by_risk_level: riskMap,
      recent_activity: recentActivity,
      open_moc_list: openMocs,
    });
  } catch (err) {
    console.error('Public dashboard error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/moc/my-drafts — user's drafts
router.get('/my-drafts', authenticate, async (req: Request, res: Response) => {
  try {
    const drafts = await db('moc_requests')
      .leftJoin('moc_templates', 'moc_requests.template_id', 'moc_templates.id')
      .select(
        'moc_requests.id',
        'moc_requests.title',
        'moc_requests.crf_risk_level',
        'moc_requests.updated_at',
        'moc_requests.created_at',
        'moc_templates.name as template_name'
      )
      .where('moc_requests.created_by', req.user!.id)
      .where('moc_requests.status', 'draft')
      .orderBy('moc_requests.updated_at', 'desc');
    res.json(drafts);
  } catch (err) {
    console.error('My drafts error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/moc/my-action-items — per-user action items
router.get('/my-action-items', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;
    const userId = req.user!.id;
    const items: any[] = [];

    // 1. Pending reviews for user's role
    const pendingReviews = await db('moc_requests')
      .select('moc_requests.id', 'moc_requests.title', 'moc_requests.moc_number', 'moc_requests.status')
      .where('moc_requests.status', 'under_review')
      .whereRaw('? = ANY(moc_requests.departments_involved)', [userRole])
      .whereNotExists(
        db('reviews')
          .whereRaw('reviews.moc_id = moc_requests.id')
          .where('reviews.reviewer_role', userRole)
          .where('reviews.decision', 'approved')
      );

    for (const moc of pendingReviews) {
      items.push({
        type: 'pending_review',
        moc_id: moc.id,
        moc_number: moc.moc_number,
        title: moc.title,
        description: `Your review is needed (${userRole.toUpperCase()})`,
        tab: 'reviews',
      });
    }

    // 2. Unresolved DSR items (where user is in assigned department)
    const dsrItems = await db('dsr_items')
      .join('dsr_checklists', 'dsr_items.checklist_id', 'dsr_checklists.id')
      .join('moc_requests', 'dsr_checklists.moc_id', 'moc_requests.id')
      .select('moc_requests.id as moc_id', 'moc_requests.title', 'moc_requests.moc_number', db.raw('count(dsr_items.id) as count'))
      .where('dsr_items.status', 'fail')
      .where('dsr_items.action_resolved', false)
      .where('moc_requests.status', 'dsr')
      .whereRaw('? = ANY(moc_requests.departments_involved)', [userRole])
      .groupBy('moc_requests.id', 'moc_requests.title', 'moc_requests.moc_number');

    for (const row of dsrItems) {
      items.push({
        type: 'dsr_action_items',
        moc_id: row.moc_id,
        moc_number: row.moc_number,
        title: row.title,
        description: `${row.count} unresolved DSR action items`,
        tab: 'dsr',
      });
    }

    // 3. Unresolved PSSR items
    const pssrItems = await db('pssr_items')
      .join('pssr_checklists', 'pssr_items.checklist_id', 'pssr_checklists.id')
      .join('moc_requests', 'pssr_checklists.moc_id', 'moc_requests.id')
      .select('moc_requests.id as moc_id', 'moc_requests.title', 'moc_requests.moc_number',
        db.raw("sum(case when pssr_items.action_type = 'pre_startup' then 1 else 0 end) as pre_count"),
        db.raw("sum(case when pssr_items.action_type = 'post_startup' then 1 else 0 end) as post_count"))
      .where('pssr_items.status', 'fail')
      .where('pssr_items.action_resolved', false)
      .whereRaw('? = ANY(moc_requests.departments_involved)', [userRole])
      .groupBy('moc_requests.id', 'moc_requests.title', 'moc_requests.moc_number');

    for (const row of pssrItems) {
      const parts = [];
      if (parseInt(row.pre_count) > 0) parts.push(`${row.pre_count} pre-startup`);
      if (parseInt(row.post_count) > 0) parts.push(`${row.post_count} post-startup`);
      items.push({
        type: 'pssr_action_items',
        moc_id: row.moc_id,
        moc_number: row.moc_number,
        title: row.title,
        description: `Unresolved PSSR items: ${parts.join(', ')}`,
        tab: 'pssr',
      });
    }

    res.json(items);
  } catch (err) {
    console.error('My action items error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/moc/draft — save a new draft
router.post('/draft', authenticate, validate(saveDraftMocSchema), async (req: Request, res: Response) => {
  try {
    const insertData: Record<string, any> = {
      ...req.body,
      moc_number: null,
      status: 'draft',
      created_by: req.user!.id,
    };

    if (insertData.ehs_assessment && typeof insertData.ehs_assessment === 'object') {
      insertData.ehs_assessment = JSON.stringify(insertData.ehs_assessment);
    }
    if (insertData.custom_field_values && typeof insertData.custom_field_values === 'object') {
      insertData.custom_field_values = JSON.stringify(insertData.custom_field_values);
    }
    if (insertData.scope_baseline) insertData.scope_baseline = JSON.stringify(insertData.scope_baseline);
    if (insertData.scope_post_change) insertData.scope_post_change = JSON.stringify(insertData.scope_post_change);
    if (insertData.scope_realized) insertData.scope_realized = JSON.stringify(insertData.scope_realized);

    // Map CRF change type to legacy
    if (insertData.crf_change_type) {
      insertData.change_type = CRF_TO_LEGACY_CHANGE_TYPE[insertData.crf_change_type as keyof typeof CRF_TO_LEGACY_CHANGE_TYPE] || 'process_change';
    }

    // Compute risk level from answers (for all MOCs, not just CRF)
    if (insertData.crf_risk_answers) {
      insertData.crf_risk_level = computeCrfRiskLevel(insertData.crf_risk_answers);
    }

    serializeCrfFields(insertData);

    const [draft] = await db('moc_requests').insert(insertData).returning('*');
    await logAudit(req, 'create_draft', 'moc_request', draft.id, { template_id: req.body.template_id });
    res.status(201).json(draft);
  } catch (err) {
    console.error('Save draft error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/moc/draft/:id — update existing draft
router.put('/draft/:id', authenticate, validate(saveDraftMocSchema), async (req: Request, res: Response) => {
  try {
    const draft = await db('moc_requests').where('id', req.params.id).first();
    if (!draft) { res.status(404).json({ message: 'Draft not found' }); return; }
    if (!['draft', 'rejected', 'returned'].includes(draft.status)) { res.status(400).json({ message: 'Only drafts, rejected, or returned MOCs can be edited via this endpoint' }); return; }
    if (!isMocOwner(draft, req.user!) && !['super_admin', 'admin', 'moc_manager'].includes(req.user!.role)) {
      res.status(403).json({ message: 'Only the creator or admin can edit this draft' }); return;
    }

    const updateData: Record<string, any> = { ...req.body, updated_at: db.fn.now() };

    if (updateData.ehs_assessment && typeof updateData.ehs_assessment === 'object') {
      updateData.ehs_assessment = JSON.stringify(updateData.ehs_assessment);
    }
    if (updateData.custom_field_values && typeof updateData.custom_field_values === 'object') {
      updateData.custom_field_values = JSON.stringify(updateData.custom_field_values);
    }
    if (updateData.scope_baseline && typeof updateData.scope_baseline !== 'string') updateData.scope_baseline = JSON.stringify(updateData.scope_baseline);
    if (updateData.scope_post_change && typeof updateData.scope_post_change !== 'string') updateData.scope_post_change = JSON.stringify(updateData.scope_post_change);
    if (updateData.scope_realized && typeof updateData.scope_realized !== 'string') updateData.scope_realized = JSON.stringify(updateData.scope_realized);

    if (updateData.crf_change_type) {
      updateData.change_type = CRF_TO_LEGACY_CHANGE_TYPE[updateData.crf_change_type as keyof typeof CRF_TO_LEGACY_CHANGE_TYPE] || 'process_change';
    }

    if (updateData.crf_risk_answers) {
      updateData.crf_risk_level = computeCrfRiskLevel(updateData.crf_risk_answers);
    }

    serializeCrfFields(updateData);

    const [updated] = await db('moc_requests').where('id', req.params.id).update(updateData).returning('*');
    await logAudit(req, 'update_draft', 'moc_request', draft.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('Update draft error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/moc/:id/submit — submit a draft (full validation, assigns moc_number)
router.post('/:id/submit', authenticate, validate(createMocSchema), async (req: Request, res: Response) => {
  try {
    const draft = await db('moc_requests').where('id', req.params.id).first();
    if (!draft) { res.status(404).json({ message: 'Draft not found' }); return; }
    if (!['draft', 'returned', 'rejected'].includes(draft.status)) { res.status(400).json({ message: 'Only drafts, returned, or rejected MOCs can be resubmitted' }); return; }
    if (!isMocOwner(draft, req.user!) && !['super_admin', 'admin', 'moc_manager'].includes(req.user!.role)) {
      res.status(403).json({ message: 'Only the creator or admin can submit this draft' }); return;
    }

    const moc = await db.transaction(async (trx) => {
      const updateData: Record<string, any> = {
        ...req.body,
        updated_at: db.fn.now(),
      };

      // Ensure always-required departments are included (management for Plant Manager)
      if (updateData.departments_involved) {
        updateData.departments_involved = ensureRequiredDepartments(updateData.departments_involved);
      }

      if (updateData.ehs_assessment && typeof updateData.ehs_assessment === 'object') {
        updateData.ehs_assessment = JSON.stringify(updateData.ehs_assessment);
      }
      if (updateData.custom_field_values && typeof updateData.custom_field_values === 'object') {
        updateData.custom_field_values = JSON.stringify(updateData.custom_field_values);
      }
      if (updateData.scope_baseline) updateData.scope_baseline = JSON.stringify(updateData.scope_baseline);
      if (updateData.scope_post_change) updateData.scope_post_change = JSON.stringify(updateData.scope_post_change);
      if (updateData.scope_realized) updateData.scope_realized = JSON.stringify(updateData.scope_realized);

      // Map CRF change type to legacy
      if (updateData.crf_change_type) {
        updateData.change_type = CRF_TO_LEGACY_CHANGE_TYPE[updateData.crf_change_type as keyof typeof CRF_TO_LEGACY_CHANGE_TYPE] || 'process_change';
      }

      // Compute risk level for ALL MOCs
      const riskLevel = computeCrfRiskLevel(updateData.crf_risk_answers);
      updateData.crf_risk_level = riskLevel;

      serializeCrfFields(updateData);

      // Assign moc_number if not already assigned (returned MOCs keep theirs)
      if (!draft.moc_number) {
        const mocNumber = await generateMocNumber(trx, riskLevel);
        updateData.moc_number = mocNumber;
      }
      // Skip "submitted" — go directly to under_review
      updateData.status = 'under_review';

      const previousStatus = draft.status;
      const [submitted] = await trx('moc_requests')
        .where('id', req.params.id)
        .update(updateData)
        .returning('*');

      await trx('workflow_history').insert({
        moc_id: submitted.id,
        from_status: previousStatus,
        to_status: 'under_review',
        changed_by: req.user!.id,
        comment: previousStatus === 'returned' ? 'Resubmitted for review' : 'Draft submitted for review',
      });

      return submitted;
    });

    await logAudit(req, 'submit_draft', 'moc_request', moc.id, req.body);

    // Populate the named-approver roster for this MOC (Rob, EHS approvers,
    // area-specific Ops/QC based on user_locations, maintenance approvers,
    // purchasing/NPD if flagged on the MOC). Idempotent.
    try {
      const { populateApprovers } = await import('../services/approvers');
      await populateApprovers(moc.id);
    } catch (e) {
      console.error('populateApprovers on submit failed', e);
    }

    // Consolidated email — area-aware, deduplicated recipients
    const mocTitle = moc.title || `MOC #${moc.id}`;
    const mocDesc = moc.description || '';
    const submitterName = req.user!.name || req.user!.email;
    await sendMocNotification(moc.id, `New MOC ${moc.moc_number} Submitted`, (link) =>
      mocSubmittedEmail(moc.id, mocTitle, mocDesc, submitterName, link, moc.moc_number), req.user!.id);

    // Auto-create DSR and PSSR checklists based on risk level
    await autoCreateChecklists(moc, req.user!.id);

    res.json(moc);
  } catch (err) {
    console.error('Submit draft error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/moc/:id — single MOC with all related data
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .leftJoin('users as transferee', 'moc_requests.transferred_to', 'transferee.id')
      .leftJoin('moc_templates', 'moc_requests.template_id', 'moc_templates.id')
      .select(
        'moc_requests.*',
        'users.name as creator_name',
        'transferee.name as transferred_to_name',
        'moc_templates.name as template_name',
        'moc_templates.field_config as template_field_config',
        'moc_templates.custom_fields as template_custom_fields',
        'moc_templates.workflow_config as template_workflow_config'
      )
      .where('moc_requests.id', req.params.id)
      .first();

    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const [risks, reviews, approvers, timeline, attachments, pssr, dsr] = await Promise.all([
      db('risk_assessments')
        .join('users', 'risk_assessments.assessed_by', 'users.id')
        .select('risk_assessments.*', 'users.name as assessor_name')
        .where('moc_id', moc.id),
      db('reviews')
        .join('users', 'reviews.reviewer_id', 'users.id')
        .select('reviews.*', 'users.name as reviewer_name')
        .where('moc_id', moc.id)
        .orderBy('reviews.created_at', 'desc'),
      db('moc_approvers as ma')
        .join('users as u', 'u.id', 'ma.user_id')
        .where('ma.moc_id', moc.id)
        .select(
          'ma.id', 'ma.moc_id', 'ma.user_id', 'u.name as user_name', 'u.email as user_email',
          'ma.role_context', 'ma.decision', 'ma.comments', 'ma.decided_at',
        )
        .orderBy([{ column: 'ma.role_context', order: 'asc' }, { column: 'u.name', order: 'asc' }]),
      db('workflow_history')
        .join('users', 'workflow_history.changed_by', 'users.id')
        .select('workflow_history.*', 'users.name as changer_name')
        .where('moc_id', moc.id)
        .orderBy('workflow_history.created_at', 'asc'),
      db('attachments')
        .join('users', 'attachments.uploaded_by', 'users.id')
        .select('attachments.*', 'users.name as uploader_name')
        .where('moc_id', moc.id),
      db('pssr_checklists').where('moc_id', moc.id).first(),
      db('dsr_checklists').where('moc_id', moc.id).first(),
    ]);

    let pssrItems: any[] = [];
    if (pssr) {
      pssrItems = await db('pssr_items')
        .leftJoin('users as assignee', 'pssr_items.assigned_to', 'assignee.id')
        .select('pssr_items.*', 'assignee.name as assigned_to_name')
        .where('checklist_id', pssr.id)
        .orderBy('pssr_items.id', 'asc');
    }

    let dsrItems: any[] = [];
    if (dsr) {
      dsrItems = await db('dsr_items')
        .leftJoin('users as verifier', 'dsr_items.verified_by', 'verifier.id')
        .leftJoin('users as assignee', 'dsr_items.assigned_to', 'assignee.id')
        .select('dsr_items.*', 'verifier.name as verifier_name', 'assignee.name as assigned_to_name')
        .where('checklist_id', dsr.id)
        .orderBy('dsr_items.id', 'asc');
    }

    res.json({
      ...moc,
      risk_assessments: risks,
      reviews,
      approvers,
      timeline,
      attachments,
      pssr: pssr ? { ...pssr, items: pssrItems } : null,
      dsr: dsr ? { ...dsr, items: dsrItems } : null,
    });
  } catch (err) {
    console.error('MOC detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/moc — create new MOC
router.post('/', authenticate, validate(createMocSchema), async (req: Request, res: Response) => {
  try {
    const moc = await db.transaction(async (trx) => {
      const insertData: Record<string, any> = {
        ...req.body,
        affected_areas: req.body.affected_areas,
        ehs_assessment: req.body.ehs_assessment ? JSON.stringify(req.body.ehs_assessment) : '{}',
        departments_involved: ensureRequiredDepartments(req.body.departments_involved || []),
        status: 'under_review',
        created_by: req.user!.id,
      };

      // Store custom_field_values as JSON
      if (insertData.custom_field_values && typeof insertData.custom_field_values === 'object') {
        insertData.custom_field_values = JSON.stringify(insertData.custom_field_values);
      }

      // Scope Validation — serialize JSONB
      if (insertData.scope_baseline) insertData.scope_baseline = JSON.stringify(insertData.scope_baseline);
      if (insertData.scope_post_change) insertData.scope_post_change = JSON.stringify(insertData.scope_post_change);
      if (insertData.scope_realized) insertData.scope_realized = JSON.stringify(insertData.scope_realized);

      // Map CRF change type to legacy change_type
      if (insertData.crf_change_type) {
        insertData.change_type = CRF_TO_LEGACY_CHANGE_TYPE[insertData.crf_change_type as keyof typeof CRF_TO_LEGACY_CHANGE_TYPE] || 'process_change';
      }

      // Compute risk level for ALL MOCs (not just CRF)
      const riskLevel = computeCrfRiskLevel(insertData.crf_risk_answers);
      insertData.crf_risk_level = riskLevel;

      // Serialize CRF JSONB fields
      serializeCrfFields(insertData);

      // Generate MOC number with risk level suffix
      const mocNumber = await generateMocNumber(trx, riskLevel);
      insertData.moc_number = mocNumber;

      const [created] = await trx('moc_requests')
        .insert(insertData)
        .returning('*');

      // Record initial workflow entries
      await trx('workflow_history').insert({
        moc_id: created.id,
        from_status: null,
        to_status: 'under_review',
        changed_by: req.user!.id,
        comment: 'MOC created and submitted for review',
      });

      return created;
    });

    await logAudit(req, 'create', 'moc_request', moc.id, req.body);

    // Populate named-approver roster (same as submit-draft path)
    try {
      const { populateApprovers } = await import('../services/approvers');
      await populateApprovers(moc.id);
    } catch (e) {
      console.error('populateApprovers on direct-create failed', e);
    }

    // Consolidated email — area-aware, deduplicated recipients
    const mocTitle = moc.title || `MOC #${moc.id}`;
    const mocDesc = moc.description || '';
    const submitterName = req.user!.name || req.user!.email;
    await sendMocNotification(moc.id, `New MOC ${moc.moc_number} Submitted`, (link) =>
      mocSubmittedEmail(moc.id, mocTitle, mocDesc, submitterName, link, moc.moc_number), req.user!.id);

    // Auto-create DSR and PSSR checklists based on risk level
    await autoCreateChecklists(moc, req.user!.id);

    res.status(201).json(moc);
  } catch (err) {
    console.error('MOC create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/moc/:id — update MOC (only in draft/returned)
router.put('/:id', authenticate, validate(updateMocSchema), async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests').where('id', req.params.id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    // Risk-related fields can be edited during risk_assessment/submitted by EHS/admin
    const riskFields = ['crf_risk_answers', 'crf_risk_level'];
    const isRiskOnlyUpdate = Object.keys(req.body).every((k) => riskFields.includes(k));
    const isRiskAssessmentPhase = ['risk_assessment', 'submitted'].includes(moc.status);
    const isRiskEditor = ['ehs', 'admin'].includes(req.user!.role);

    // Scope post-change and realized can be updated during implementing through closed
    const scopeFields = ['scope_post_change', 'scope_realized'];
    const isScopeOnlyUpdate = Object.keys(req.body).every((k) => scopeFields.includes(k));
    const isScopePhase = ['implementing', 'dsr', 'pssr_pending', 'pssr_complete', 'orc', 'ready_for_startup', 'awaiting_action_items', 'improvements_realized', 'approved', 'closed'].includes(moc.status);

    if (!['draft', 'returned', 'rejected'].includes(moc.status)) {
      if (!(isRiskOnlyUpdate && isRiskAssessmentPhase && isRiskEditor) && !(isScopeOnlyUpdate && isScopePhase)) {
        res.status(400).json({ message: 'MOC can only be edited in draft or returned status' });
        return;
      }
    } else if (!isMocOwner(moc, req.user!) && !['super_admin', 'admin', 'moc_manager'].includes(req.user!.role)) {
      res.status(403).json({ message: 'Only the creator or admin can edit this MOC' });
      return;
    }

    const updateData: Record<string, any> = { ...req.body, updated_at: db.fn.now() };

    // Serialize ehs_assessment to JSON for jsonb column
    if (updateData.ehs_assessment && typeof updateData.ehs_assessment === 'object') {
      updateData.ehs_assessment = JSON.stringify(updateData.ehs_assessment);
    }

    // Scope Validation — serialize JSONB on update
    if (updateData.scope_baseline && typeof updateData.scope_baseline !== 'string') updateData.scope_baseline = JSON.stringify(updateData.scope_baseline);
    if (updateData.scope_post_change && typeof updateData.scope_post_change !== 'string') updateData.scope_post_change = JSON.stringify(updateData.scope_post_change);
    if (updateData.scope_realized && typeof updateData.scope_realized !== 'string') updateData.scope_realized = JSON.stringify(updateData.scope_realized);

    // CRF handling on update (applies to all form versions now)
    if (updateData.crf_change_type) {
      updateData.change_type = CRF_TO_LEGACY_CHANGE_TYPE[updateData.crf_change_type as keyof typeof CRF_TO_LEGACY_CHANGE_TYPE] || 'process_change';
    }
    if (updateData.crf_risk_answers) {
      updateData.crf_risk_level = computeCrfRiskLevel(updateData.crf_risk_answers);
    }
    serializeCrfFields(updateData);

    const [updated] = await db('moc_requests')
      .where('id', req.params.id)
      .update(updateData)
      .returning('*');

    await logAudit(req, 'update', 'moc_request', moc.id, req.body);

    res.json(updated);
  } catch (err) {
    console.error('MOC update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/moc/:id — admin/moc_manager edit title and moc_number at any status
router.patch('/:id', authenticate, authorize('admin', 'moc_manager'), validate(updateMocAdminFieldsSchema), async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests').where('id', req.params.id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const { title, moc_number } = req.body;
    if (!title && !moc_number) {
      res.status(400).json({ message: 'At least one field (title or moc_number) must be provided' });
      return;
    }

    // Uniqueness check for moc_number
    if (moc_number && moc_number !== moc.moc_number) {
      const existing = await db('moc_requests').where('moc_number', moc_number).whereNot('id', moc.id).first();
      if (existing) {
        res.status(409).json({ message: `MOC number ${moc_number} is already in use` });
        return;
      }
    }

    const updateData: Record<string, any> = { updated_at: db.fn.now() };
    const auditChanges: Record<string, unknown> = {};

    if (title && title !== moc.title) {
      auditChanges.title = { old: moc.title, new: title };
      updateData.title = title;
    }
    if (moc_number && moc_number !== moc.moc_number) {
      auditChanges.moc_number = { old: moc.moc_number, new: moc_number };
      updateData.moc_number = moc_number;
    }

    const [updated] = await db('moc_requests')
      .where('id', req.params.id)
      .update(updateData)
      .returning('*');

    if (Object.keys(auditChanges).length > 0) {
      await logAudit(req, 'update_admin_fields', 'moc_request', moc.id, auditChanges);
    }

    res.json(updated);
  } catch (err) {
    console.error('MOC admin field update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/moc/:id/departments — EHS can update departments during review
// Users can add departments but cannot remove auto-derived ones
router.put('/:id/departments', authenticate, async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests').where('id', req.params.id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    // EHS/admin/moc_manager/super_admin can edit during review; creator can edit in draft/returned
    const isEhsOrAdmin = ['ehs', 'admin', 'super_admin', 'moc_manager'].includes(req.user!.role);
    const isCreator = moc.created_by === req.user!.id;
    const isReviewPhase = ['submitted', 'under_review', 'risk_assessment', 'dsr'].includes(moc.status);
    const isDraftPhase = ['draft', 'returned'].includes(moc.status);

    if (isEhsOrAdmin && isReviewPhase) {
      // allowed
    } else if (isCreator && isDraftPhase) {
      // allowed
    } else {
      res.status(403).json({ message: 'Cannot update departments in this status' });
      return;
    }

    const { departments_involved } = req.body;
    if (!Array.isArray(departments_involved)) {
      res.status(400).json({ message: 'departments_involved must be an array' });
      return;
    }

    // Enforce: users cannot remove auto-derived departments (always-required + current)
    // They can only ADD new departments, not remove existing ones
    const currentDepts: string[] = moc.departments_involved || [];
    const missingDepts = currentDepts.filter((d: string) => !departments_involved.includes(d));
    if (missingDepts.length > 0) {
      res.status(400).json({
        message: `Cannot remove departments: ${missingDepts.join(', ')}. Departments can only be added, not removed.`,
      });
      return;
    }

    // Also ensure always-required departments
    let finalDepts = ensureRequiredDepartments(departments_involved);

    // Bidirectional rule: if DSR checklist exists → maintenance must be included
    const hasDsr = await db('dsr_checklists').where('moc_id', moc.id).first();
    if (hasDsr && !finalDepts.includes('maintenance')) {
      finalDepts = [...finalDepts, 'maintenance'];
    }
    // Bidirectional rule: if maintenance is included → ensure DSR checklist exists
    if (finalDepts.includes('maintenance') && !hasDsr) {
      const { DSR_TEMPLATE_ITEMS } = require('../templates/dsr-template');
      const [checklist] = await db('dsr_checklists')
        .insert({ moc_id: moc.id, created_by: req.user!.id })
        .returning('*');
      await db('dsr_items').insert(
        DSR_TEMPLATE_ITEMS.map((t: any) => ({
          checklist_id: checklist.id,
          category: t.category,
          description: t.description,
          status: 'pending',
        }))
      );
    }

    const [updated] = await db('moc_requests')
      .where('id', req.params.id)
      .update({ departments_involved: finalDepts, updated_at: db.fn.now() })
      .returning('*');

    await logAudit(req, 'update_departments', 'moc_request', moc.id, {
      old: moc.departments_involved,
      new: finalDepts,
    });

    res.json(updated);
  } catch (err) {
    console.error('Department update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/moc/:id/reassign — admins can transfer MOC ownership.
// We RETAIN created_by (the original author) and set transferred_to to the
// new active owner. Pass new_owner_id=null to clear an existing transfer.
router.put('/:id/reassign', authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdminUser(req.user!)) {
      res.status(403).json({ message: 'Only administrators can transfer MOC ownership' });
      return;
    }

    const moc = await db('moc_requests').where('id', req.params.id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const { new_owner_id } = req.body as { new_owner_id: number | null };

    // Allow null to clear a transfer (revert to original creator as owner)
    if (new_owner_id !== null && (typeof new_owner_id !== 'number')) {
      res.status(400).json({ message: 'new_owner_id is required (number or null to clear)' });
      return;
    }

    if (typeof new_owner_id === 'number') {
      const newOwner = await db('users').where('id', new_owner_id).first();
      if (!newOwner) {
        res.status(404).json({ message: 'New owner user not found' });
        return;
      }
    }

    const update: Record<string, any> = {
      transferred_to: new_owner_id,
      updated_at: db.fn.now(),
    };
    if (new_owner_id !== null) {
      update.transferred_at = db.fn.now();
      update.transferred_by = req.user!.id;
    } else {
      update.transferred_at = null;
      update.transferred_by = null;
    }

    const [updated] = await db('moc_requests')
      .where('id', req.params.id)
      .update(update)
      .returning('*');

    await logAudit(req, 'transfer_ownership', 'moc_request', moc.id, {
      created_by: moc.created_by,
      previous_transferred_to: moc.transferred_to,
      new_transferred_to: new_owner_id,
    });

    res.json(updated);
  } catch (err) {
    console.error('MOC reassign error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

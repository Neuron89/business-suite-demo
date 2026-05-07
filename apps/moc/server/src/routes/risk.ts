import { Router, Request, Response } from 'express';
import { createRiskAssessmentSchema, updateRiskAssessmentSchema, getRiskLevel } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { recalcMocRiskLevel } from '../services/risk-level';

const router = Router();

// GET /api/risk/:mocId
router.get('/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const risks = await db('risk_assessments')
      .join('users', 'risk_assessments.assessed_by', 'users.id')
      .select('risk_assessments.*', 'users.name as assessor_name')
      .where('moc_id', req.params.mocId)
      .orderBy('risk_assessments.created_at', 'asc');

    res.json(risks);
  } catch (err) {
    console.error('Risk list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/risk
router.post('/', authenticate, authorize('ehs', 'admin'), validate(createRiskAssessmentSchema), async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests').where('id', req.body.moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }
    if (!['risk_assessment', 'submitted'].includes(moc.status)) {
      res.status(400).json({ message: 'Risk assessments can only be added during risk_assessment or submitted status' });
      return;
    }

    const risk_level_before = getRiskLevel(req.body.severity_before, req.body.likelihood_before);
    const risk_level_after = getRiskLevel(req.body.severity_after, req.body.likelihood_after);

    const [risk] = await db('risk_assessments')
      .insert({
        ...req.body,
        risk_level_before,
        risk_level_after,
        assessed_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'create', 'risk_assessment', risk.id, req.body);
    await recalcMocRiskLevel(req.body.moc_id);

    res.status(201).json(risk);
  } catch (err) {
    console.error('Risk create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/risk/:id
router.put('/:id', authenticate, authorize('ehs', 'admin'), validate(updateRiskAssessmentSchema), async (req: Request, res: Response) => {
  try {
    const existing = await db('risk_assessments').where('id', req.params.id).first();
    if (!existing) {
      res.status(404).json({ message: 'Risk assessment not found' });
      return;
    }

    const updates: any = { ...req.body };
    if (req.body.severity_before && req.body.likelihood_before) {
      updates.risk_level_before = getRiskLevel(req.body.severity_before, req.body.likelihood_before);
    }
    if (req.body.severity_after && req.body.likelihood_after) {
      updates.risk_level_after = getRiskLevel(req.body.severity_after, req.body.likelihood_after);
    }

    const [risk] = await db('risk_assessments')
      .where('id', req.params.id)
      .update({ ...updates, updated_at: db.fn.now() })
      .returning('*');

    await logAudit(req, 'update', 'risk_assessment', risk.id, req.body);
    await recalcMocRiskLevel(existing.moc_id);

    res.json(risk);
  } catch (err) {
    console.error('Risk update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/risk/:id
router.delete('/:id', authenticate, authorize('ehs', 'admin'), async (req: Request, res: Response) => {
  try {
    const existing = await db('risk_assessments').where('id', req.params.id).first();
    if (!existing) {
      res.status(404).json({ message: 'Risk assessment not found' });
      return;
    }

    const mocId = existing.moc_id;
    await db('risk_assessments').where('id', req.params.id).delete();
    await logAudit(req, 'delete', 'risk_assessment', parseInt(String(req.params.id)));
    await recalcMocRiskLevel(mocId);

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Risk delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

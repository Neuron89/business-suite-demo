import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public stats (no auth required)
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const total = await db('complaints').count('id as count').first();
    const byStatus = await db('complaints').select('status').count('id as count').groupBy('status');
    const byType = await db('complaints').select('complaint_type as type').count('id as count').groupBy('complaint_type');
    const bySeverity = await db('complaints').select('severity').count('id as count').groupBy('severity');

    res.json({
      total_complaints: Number(total?.count || 0),
      by_status: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      by_type: byType.map(r => ({ type: r.type, count: Number(r.count) })),
      by_severity: bySeverity.map(r => ({ severity: r.severity, count: Number(r.count) })),
    });
  } catch (err) {
    console.error('Failed to get public stats:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Authenticated dashboard
router.get('/', authenticate(), async (req: Request, res: Response) => {
  try {
    const total = await db('complaints').count('id as count').first();
    const open = await db('complaints').whereIn('status', ['submitted', 'under_review']).count('id as count').first();
    const underReview = await db('complaints').where('status', 'under_review').count('id as count').first();
    const resolved = await db('complaints').where('status', 'resolved').count('id as count').first();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const closedThisMonth = await db('complaints')
      .where('status', 'closed')
      .where('updated_at', '>=', monthStart)
      .count('id as count')
      .first();

    const byStatus = await db('complaints').select('status').count('id as count').groupBy('status');
    const byType = await db('complaints').select('complaint_type as type').count('id as count').groupBy('complaint_type');
    const bySeverity = await db('complaints').select('severity').count('id as count').groupBy('severity');

    const recentComplaints = await db('complaints')
      .leftJoin('users as creator', 'complaints.created_by', 'creator.id')
      .leftJoin('users as assignee', 'complaints.assigned_to', 'assignee.id')
      .select('complaints.*', 'creator.name as created_by_name', 'assignee.name as assigned_to_name')
      .orderBy('complaints.created_at', 'desc')
      .limit(10);

    const myComplaints = await db('complaints')
      .leftJoin('users as creator', 'complaints.created_by', 'creator.id')
      .leftJoin('users as assignee', 'complaints.assigned_to', 'assignee.id')
      .select('complaints.*', 'creator.name as created_by_name', 'assignee.name as assigned_to_name')
      .where(function () {
        this.where('complaints.created_by', req.user!.id).orWhere('complaints.assigned_to', req.user!.id);
      })
      .whereNotIn('complaints.status', ['closed', 'rejected'])
      .orderBy('complaints.updated_at', 'desc')
      .limit(10);

    res.json({
      total_complaints: Number(total?.count || 0),
      open_complaints: Number(open?.count || 0),
      under_review: Number(underReview?.count || 0),
      resolved: Number(resolved?.count || 0),
      closed_this_month: Number(closedThisMonth?.count || 0),
      by_status: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      by_type: byType.map(r => ({ type: r.type, count: Number(r.count) })),
      by_severity: bySeverity.map(r => ({ severity: r.severity, count: Number(r.count) })),
      recent_complaints: recentComplaints,
      my_complaints: myComplaints,
    });
  } catch (err) {
    console.error('Failed to get dashboard:', err);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;

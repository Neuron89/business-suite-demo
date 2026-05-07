import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard — authenticated user dashboard
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // My MOCs
    const myMocs = await db('moc_requests')
      .where('created_by', user.id)
      .whereNotIn('status', ['closed'])
      .orderBy('updated_at', 'desc')
      .limit(10);

    // Pending reviews for my role
    const pendingReviews = await db('moc_requests')
      .where('status', 'under_review')
      .whereNotExists(function () {
        this.select('id')
          .from('reviews')
          .whereRaw('reviews.moc_id = moc_requests.id')
          .where('reviewer_role', user.role);
      })
      .orderBy('updated_at', 'asc');

    // My notifications (unread)
    const notifications = await db('notifications')
      .where({ user_id: user.id, is_read: false })
      .orderBy('created_at', 'desc')
      .limit(20);

    // Recent activity across all MOCs
    const recentActivity = await db('workflow_history')
      .join('users', 'workflow_history.changed_by', 'users.id')
      .join('moc_requests', 'workflow_history.moc_id', 'moc_requests.id')
      .select(
        'workflow_history.*',
        'users.name as changer_name',
        'moc_requests.title as moc_title'
      )
      .orderBy('workflow_history.created_at', 'desc')
      .limit(15);

    // Stats
    const totalOpen = await db('moc_requests')
      .whereNotIn('status', ['closed', 'draft'])
      .count('id as count')
      .first();

    // Status distribution (count by status)
    const statusDistRows = await db('moc_requests')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const status_distribution = statusDistRows.map((row: any) => ({
      name: String(row.status).replace(/_/g, ' '),
      value: parseInt(String(row.count)),
    }));

    // Change type distribution (count by change_type)
    const typeDistRows = await db('moc_requests')
      .select('change_type')
      .count('id as count')
      .whereNotNull('change_type')
      .groupBy('change_type');

    const type_distribution = typeDistRows.map((row: any) => ({
      name: String(row.change_type).replace(/_/g, ' '),
      value: parseInt(String(row.count)),
    }));

    // Closed this month
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const closedThisMonth = await db('moc_requests')
      .where('status', 'closed')
      .where('updated_at', '>=', firstOfMonth)
      .count('id as count')
      .first();

    // Average days to close (for closed MOCs)
    const avgResult = await db('moc_requests')
      .where('status', 'closed')
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days')
      )
      .first();

    // My assigned action items (DSR)
    const dsrActionItems = await db('dsr_items')
      .join('dsr_checklists', 'dsr_items.checklist_id', 'dsr_checklists.id')
      .join('moc_requests', 'dsr_checklists.moc_id', 'moc_requests.id')
      .select(
        'dsr_items.id',
        'dsr_items.description',
        'dsr_items.notes',
        'dsr_items.action_resolved',
        'dsr_items.category',
        'moc_requests.id as moc_id',
        'moc_requests.moc_number',
        'moc_requests.title as moc_title',
        'moc_requests.status as moc_status'
      )
      .where('dsr_items.assigned_to', user.id)
      .where('dsr_items.status', 'fail')
      .where('dsr_items.action_resolved', false)
      .whereNotIn('moc_requests.status', ['closed']);

    // My assigned action items (PSSR)
    const pssrActionItems = await db('pssr_items')
      .join('pssr_checklists', 'pssr_items.checklist_id', 'pssr_checklists.id')
      .join('moc_requests', 'pssr_checklists.moc_id', 'moc_requests.id')
      .select(
        'pssr_items.id',
        'pssr_items.description',
        'pssr_items.notes',
        'pssr_items.action_resolved',
        'pssr_items.action_type',
        'pssr_items.category',
        'moc_requests.id as moc_id',
        'moc_requests.moc_number',
        'moc_requests.title as moc_title',
        'moc_requests.status as moc_status'
      )
      .where('pssr_items.assigned_to', user.id)
      .where('pssr_items.status', 'fail')
      .where('pssr_items.action_resolved', false)
      .whereNotIn('moc_requests.status', ['closed']);

    const myActionItems = [
      ...dsrActionItems.map((i: any) => ({ ...i, source: 'dsr' as const })),
      ...pssrActionItems.map((i: any) => ({ ...i, source: 'pssr' as const })),
    ];

    res.json({
      my_mocs: myMocs,
      pending_reviews: pendingReviews,
      notifications,
      recent_activity: recentActivity,
      my_action_items: myActionItems,
      stats: {
        open_mocs: parseInt(String(totalOpen?.count || '0')),
        pending_review_count: pendingReviews.length,
        unread_notifications: notifications.length,
        closed_this_month: parseInt(String(closedThisMonth?.count || '0')),
        avg_days_to_close: avgResult?.avg_days ? Math.round(avgResult.avg_days) : null,
        action_item_count: myActionItems.length,
      },
      status_distribution,
      type_distribution,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dashboard/action-items — action items assigned to the logged-in user.
// "My Actions" is strictly per-user: only items where assigned_to = current user.
// (Admins still see everything via the dedicated admin views; this endpoint is
// the personal queue, not a global one.)
router.get('/action-items', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const showResolved = req.query.show_resolved === 'true';

    let dsrQuery = db('dsr_items')
      .join('dsr_checklists', 'dsr_items.checklist_id', 'dsr_checklists.id')
      .join('moc_requests', 'dsr_checklists.moc_id', 'moc_requests.id')
      .leftJoin('users as assignee', 'dsr_items.assigned_to', 'assignee.id')
      .select(
        'dsr_items.id',
        'dsr_items.description',
        'dsr_items.notes',
        'dsr_items.action_resolved',
        'dsr_items.category',
        'dsr_items.assigned_to',
        'assignee.name as assigned_to_name',
        'moc_requests.id as moc_id',
        'moc_requests.moc_number',
        'moc_requests.title as moc_title',
        'moc_requests.status as moc_status',
        'moc_requests.updated_at as moc_updated_at',
      )
      .where('dsr_items.status', 'fail')
      .where('dsr_items.assigned_to', user.id);

    if (!showResolved) {
      dsrQuery = dsrQuery.where('dsr_items.action_resolved', false);
    }

    const dsrItems = await dsrQuery;

    let pssrQuery = db('pssr_items')
      .join('pssr_checklists', 'pssr_items.checklist_id', 'pssr_checklists.id')
      .join('moc_requests', 'pssr_checklists.moc_id', 'moc_requests.id')
      .leftJoin('users as assignee', 'pssr_items.assigned_to', 'assignee.id')
      .select(
        'pssr_items.id',
        'pssr_items.description',
        'pssr_items.notes',
        'pssr_items.action_resolved',
        'pssr_items.action_type',
        'pssr_items.category',
        'pssr_items.assigned_to',
        'assignee.name as assigned_to_name',
        'moc_requests.id as moc_id',
        'moc_requests.moc_number',
        'moc_requests.title as moc_title',
        'moc_requests.status as moc_status',
        'moc_requests.updated_at as moc_updated_at',
      )
      .where('pssr_items.status', 'fail')
      .where('pssr_items.assigned_to', user.id);

    if (!showResolved) {
      pssrQuery = pssrQuery.where('pssr_items.action_resolved', false);
    }

    const pssrItems = await pssrQuery;

    const items = [
      ...dsrItems.map((i: any) => ({ ...i, source: 'dsr' as const })),
      ...pssrItems.map((i: any) => ({ ...i, source: 'pssr' as const })),
    ];

    res.json(items);
  } catch (err) {
    console.error('Action items error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    let baseQuery = db('tickets');

    // Qualify columns with tickets.* — baseQuery is later cloned and joined with users,
    // and users also has manager_id, which makes a bare 'manager_id' ambiguous.
    if (req.user!.role === 'employee') {
      baseQuery = baseQuery.where('tickets.requester_id', req.user!.id);
    } else if (req.user!.role === 'manager') {
      baseQuery = baseQuery.where(function() {
        this.where('tickets.manager_id', req.user!.id).orWhere('tickets.requester_id', req.user!.id);
      });
    } else if (req.user!.role === 'hr') {
      baseQuery = baseQuery.where(function() {
        this.where('tickets.requester_id', req.user!.id).orWhere('tickets.request_type', 'onboarding');
      });
    }

    const statusCounts = await baseQuery.clone()
      .select('status')
      .count('id as count')
      .groupBy('status');

    const typeCounts = await baseQuery.clone()
      .select('request_type')
      .count('id as count')
      .groupBy('request_type');

    const recent = await baseQuery.clone()
      .leftJoin('users as requester', 'tickets.requester_id', 'requester.id')
      .leftJoin('users as assignee', 'tickets.assignee_id', 'assignee.id')
      .leftJoin('ticket_categories as category', 'tickets.category_id', 'category.id')
      .select(
        'tickets.id', 'tickets.request_number', 'tickets.title',
        'tickets.status', 'tickets.request_type', 'tickets.urgency',
        'tickets.due_date', 'tickets.created_at',
        'requester.name as requester_name',
        'assignee.name as assignee_name',
        'category.name as category_name', 'category.color as category_color'
      )
      .orderBy('tickets.created_at', 'desc')
      .limit(10);

    let pendingManagerReview = 0;
    if (req.user!.role === 'manager' || req.user!.role === 'it_admin') {
      const result = await db('tickets')
        .where('status', 'manager_review')
        .andWhere(function() {
          if (req.user!.role === 'manager') {
            this.where('manager_id', req.user!.id);
          }
        })
        .count('id as count')
        .first();
      pendingManagerReview = parseInt(String(result?.count || 0));
    }

    let pendingItReview = 0;
    let myOpenTickets = 0;
    let overdueCount = 0;
    let dueThisWeek = 0;
    let unassignedOpen = 0;

    if (req.user!.role === 'it_admin') {
      const itReview = await db('tickets').where('status', 'it_review').count('id as count').first();
      pendingItReview = parseInt(String(itReview?.count || 0));

      const mine = await db('tickets')
        .where('assignee_id', req.user!.id)
        .whereNotIn('status', ['completed', 'cancelled', 'denied'])
        .count('id as count').first();
      myOpenTickets = parseInt(String(mine?.count || 0));

      const overdue = await db('tickets')
        .whereNotNull('due_date')
        .where('due_date', '<', new Date())
        .whereNotIn('status', ['completed', 'cancelled', 'denied'])
        .count('id as count').first();
      overdueCount = parseInt(String(overdue?.count || 0));

      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const dueWeek = await db('tickets')
        .whereNotNull('due_date')
        .where('due_date', '>=', new Date())
        .where('due_date', '<', weekFromNow)
        .whereNotIn('status', ['completed', 'cancelled', 'denied'])
        .count('id as count').first();
      dueThisWeek = parseInt(String(dueWeek?.count || 0));

      const unassigned = await db('tickets')
        .whereNull('assignee_id')
        .whereNotIn('status', ['completed', 'cancelled', 'denied', 'manager_review'])
        .count('id as count').first();
      unassignedOpen = parseInt(String(unassigned?.count || 0));
    }

    res.json({
      statusCounts: Object.fromEntries(statusCounts.map((r: any) => [r.status, parseInt(String(r.count))])),
      typeCounts: Object.fromEntries(typeCounts.map((r: any) => [r.request_type, parseInt(String(r.count))])),
      recent,
      pendingManagerReview,
      pendingItReview,
      myOpenTickets,
      overdueCount,
      dueThisWeek,
      unassignedOpen,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

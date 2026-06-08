import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pingCreateSchema } from '@onb/shared';
import { notifyPing } from '../services/email';

const router = Router();

// IT pings a role for info on a ticket.
router.post('/', authenticate, authorize('it_admin'), validate(pingCreateSchema), async (req: Request, res: Response) => {
  try {
    const { ticket_id, to_role, message } = req.body;
    const ticket = await db('tickets').where({ id: ticket_id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    const [ping] = await db('pings').insert({
      ticket_id,
      from_user_id: req.user!.id,
      to_role,
      message,
      status: 'open',
    }).returning('*');

    await db('ticket_history').insert({
      ticket_id,
      from_status: ticket.status,
      to_status: ticket.status,
      changed_by: req.user!.id,
      comment: `Pinged ${to_role}: ${message}`,
    });

    notifyPing(ticket, to_role, message, req.user!.name || req.user!.email)
      .catch((e) => console.error('[email] notifyPing failed:', e));

    res.status(201).json(ping);
  } catch (err) {
    console.error('Create ping error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Open pings addressed to the current user's role.
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const pings = await db('pings')
      .join('tickets', 'pings.ticket_id', 'tickets.id')
      .leftJoin('users', 'pings.from_user_id', 'users.id')
      .where('pings.to_role', req.user!.role)
      .andWhere('pings.status', 'open')
      .select(
        'pings.*',
        'tickets.request_number',
        'tickets.title as ticket_title',
        'users.name as from_name',
      )
      .orderBy('pings.created_at', 'desc');
    res.json(pings);
  } catch (err) {
    console.error('Get my pings error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Recipient (or IT) marks a ping done.
router.post('/:id/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const ping = await db('pings').where({ id: req.params.id }).first();
    if (!ping) {
      res.status(404).json({ message: 'Ping not found' });
      return;
    }
    if (req.user!.role !== ping.to_role && req.user!.role !== 'it_admin') {
      res.status(403).json({ message: 'Not authorized to resolve this ping' });
      return;
    }
    if (ping.status === 'done') {
      res.json({ message: 'Already resolved' });
      return;
    }
    const ticket = await db('tickets').where({ id: ping.ticket_id }).first();
    await db('pings').where({ id: ping.id }).update({
      status: 'done',
      resolved_at: new Date(),
      resolved_by: req.user!.id,
    });
    await db('ticket_history').insert({
      ticket_id: ping.ticket_id,
      from_status: ticket?.status ?? null,
      to_status: ticket?.status ?? 'note',
      changed_by: req.user!.id,
      comment: `Ping resolved by ${req.user!.name || req.user!.email}`,
    });
    res.json({ message: 'Ping resolved' });
  } catch (err) {
    console.error('Resolve ping error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

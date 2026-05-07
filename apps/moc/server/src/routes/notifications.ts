import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await db('notifications')
      .where('user_id', req.user!.id)
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user!.id })
      .update({ is_read: true });

    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Notification read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    await db('notifications')
      .where({ user_id: req.user!.id, is_read: false })
      .update({ is_read: true });

    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('Notification read-all error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

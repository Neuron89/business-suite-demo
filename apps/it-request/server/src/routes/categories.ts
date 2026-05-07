import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const categories = await db('ticket_categories')
      .where({ is_active: true })
      .orderBy('sort_order')
      .orderBy('name');
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

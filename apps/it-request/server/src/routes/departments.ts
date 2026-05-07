import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const departments = await db('departments').orderBy('name');
    res.json(departments);
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

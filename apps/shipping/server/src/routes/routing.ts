import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getRoute } from '../services/osrm-routing';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const fromZip = (req.query.from as string) || '';
  const toZip = (req.query.to as string) || '';
  if (!fromZip || !toZip) {
    res.status(400).json({ message: 'from and to ZIPs required' });
    return;
  }
  const result = await getRoute(fromZip, toZip);
  if (!result) {
    res.status(404).json({ message: 'Route not available' });
    return;
  }
  res.json(result);
});

export default router;

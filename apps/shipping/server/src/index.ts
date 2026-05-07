import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import shipmentRoutes from './routes/shipments';
import dashboardRoutes from './routes/dashboard';
import carrierRoutes from './routes/carriers';
import rateBookRoutes from './routes/rate-book';
import fscRoutes from './routes/fsc';
import inventoryRoutes from './routes/inventory';
import syncRoutes from './routes/sync';
import routingRoutes from './routes/routing';
import userRoutes from './routes/users';
import { registerCrons } from './services/cron';

const app = express();
const PORT = parseInt(process.env.PORT || '4030');

app.use(
  cors({
    origin: [
      'http://localhost:3030',
      'http://127.0.0.1:3030',
      ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/carriers', carrierRoutes);
app.use('/api/rate-book', rateBookRoutes);
app.use('/api/fsc', fscRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'shipping-command', timestamp: new Date().toISOString() });
});

app.use(function errorHandler(err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  const status = err.status || err.statusCode || 500;
  if (status < 500) {
    res.status(status).json({ message: err.message || 'Bad request' });
  } else {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

registerCrons();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shipping Command API running on http://0.0.0.0:${PORT}`);
});

export default app;

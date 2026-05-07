import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import dashboardRoutes from './routes/dashboard';
import usersRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import categoryRoutes from './routes/categories';
import integrationRoutes from './routes/integration';

const app = express();
const PORT = parseInt(process.env.PORT || '4020');

app.use(cors({
  origin: [
    'http://localhost:3020',
    'http://192.168.168.193:3020',
    'http://192.168.168.47:3020',
    'http://192.168.1.114:3020',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ],
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/requests', ticketRoutes); // back-compat
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/integration', integrationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IT Ticketing API server running on http://0.0.0.0:${PORT}`);
});

export default app;

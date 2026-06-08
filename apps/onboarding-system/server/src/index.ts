// Anchor .env to this file's directory rather than process.cwd(). Under
// systemd the working directory is the workspace root, not the server dir,
// so `dotenv.config()` was a no-op and JWT_SECRET silently fell back to
// 'dev-secret'. __dirname-relative loading guarantees the right file.
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import dashboardRoutes from './routes/dashboard';
import usersRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import categoryRoutes from './routes/categories';
import integrationRoutes from './routes/integration';
import directoryRoutes from './routes/directory';
import lookupsRoutes from './routes/lookups';
import pingsRoutes from './routes/pings';
import { startReminderScheduler } from './services/reminders';

const app = express();
const PORT = parseInt(process.env.PORT || '4080');

// In the demo suite the client is reached same-origin behind a proxy (and at
// :3080 on localhost), so reflect the request origin rather than pinning a
// fixed LAN allowlist. Falls back to the localhost dev port + CLIENT_URL.
app.use(cors({
  origin: process.env.DEMO_MODE === 'true'
    ? true
    : [
        'http://localhost:3080',
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
app.use('/api/directory', directoryRoutes);
app.use('/api/lookups', lookupsRoutes);
app.use('/api/pings', pingsRoutes);

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
  console.log(`[onboarding] API server running on http://0.0.0.0:${PORT}`);
  startReminderScheduler();
});

export default app;

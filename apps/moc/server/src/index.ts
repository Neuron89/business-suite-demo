import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth';
import mocRoutes from './routes/moc';
import riskRoutes from './routes/risk';
import reviewRoutes from './routes/review';
import workflowRoutes from './routes/workflow';
import pssrRoutes from './routes/pssr';
import dsrRoutes from './routes/dsr';
import dashboardRoutes from './routes/dashboard';
import usersRoutes from './routes/users';
import auditRoutes from './routes/audit';
import notificationRoutes from './routes/notifications';
import attachmentRoutes from './routes/attachments';
import systemRequestRoutes from './routes/system-requests';
import templateRoutes from './routes/templates';
import ehsIncidentRoutes from './routes/ehs-incidents';
import exportRoutes from './routes/exports';
import integrationRoutes from './routes/integration';
import externalActionRoutes from './routes/external-actions';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://192.168.168.193:3000',
    'http://192.168.168.47:3000',
    'http://192.168.1.114:3000',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    // Cross-system integration origins
    ...(process.env.QC_LAB_URL ? [process.env.QC_LAB_URL] : []),
    ...(process.env.COMPLAINT_TRACKER_URL ? [process.env.COMPLAINT_TRACKER_URL] : []),
  ],
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/moc', mocRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/pssr', pssrRoutes);
app.use('/api/dsr', dsrRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/system-requests', systemRequestRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ehs-incidents', ehsIncidentRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/external-actions', externalActionRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler — must have 4 args for Express to recognize it as error middleware
app.use(function errorHandler(err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  // Don't crash on JSON parse errors or other client mistakes
  const status = err.status || err.statusCode || 500;
  if (status < 500) {
    res.status(status).json({ message: err.message || 'Bad request' });
  } else {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Catch unhandled rejections/exceptions so the process doesn't crash
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MOC API server running on http://0.0.0.0:${PORT}`);
});

export default app;

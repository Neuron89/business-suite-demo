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
import complaintRoutes from './routes/complaints';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/users';
import auditRoutes from './routes/audit';
import attachmentRoutes from './routes/attachments';

const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors({
  origin: [
    'http://localhost:3010',
    'http://127.0.0.1:3010',
  ],
  credentials: true,
}));

app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/attachments', attachmentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'complaint-tracker' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = (err as any).status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Complaint Tracker API running on port ${PORT}`);
});

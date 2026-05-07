import dotenv from 'dotenv';
import path from 'path';
// dotenv defaults to CWD, but workspace scripts run inside server/, so we
// point at the monorepo root .env explicitly.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // also load server/.env if it exists, without overriding

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import microsoftAuthRoutes from './routes/microsoft_auth';
import homeRoutes from './routes/home';
import adminRoutes from './routes/admin';
import announcementsRoutes from './routes/announcements';
import suggestionsRoutes from './routes/suggestions';
import trainingRoutes from './routes/training';
import dashboardRoutes from './routes/dashboard';
import todosRoutes from './routes/todos';
import holidaysRoutes from './routes/holidays';
import bannerRoutes from './routes/banner';
import ssoRoutes from './routes/sso';

const app = express();
const PORT = parseInt(process.env.PORT || '4070');

app.use(
  cors({
    // Accept:
    //   - localhost:3070 (dev)
    //   - any LAN IP on port 3070 (dev from laptop)
    //   - any LAN IP without port (HTTPS reverse proxy on :443)
    //   - whatever CLIENT_URL is set to (production hostname)
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed =
        origin === 'http://localhost:3070' ||
        origin === process.env.CLIENT_URL ||
        /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(origin);
      cb(null, allowed);
    },
    credentials: true,
  })
);
// Trust X-Forwarded-* headers from nginx so req.ip etc. work behind the proxy.
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/auth/microsoft', microsoftAuthRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/sso', ssoRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(function errorHandler(
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) {
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
  console.log(`Acme Portal API running on http://0.0.0.0:${PORT}`);
});

export default app;

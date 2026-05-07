import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { loginSchema } from '@shipping/shared';
import db from '../db/connection';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await db('users').where({ email }).first();
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' } as SignOptions);
  const refresh = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' } as SignOptions);
  res.json({ token, refresh, user: payload });
});

// POST /api/auth/sso-exchange — Portal SSO handoff. Returns same shape as /login.
router.post('/sso-exchange', async (req, res) => {
  const ssoSecret = process.env.PORTAL_SSO_SECRET;
  if (!ssoSecret) {
    res.status(503).json({ message: 'SSO not configured.' });
    return;
  }
  const { ptoken } = (req.body || {}) as { ptoken?: string };
  if (typeof ptoken !== 'string') {
    res.status(400).json({ message: 'ptoken required' });
    return;
  }
  let claims: { email: string; full_name?: string; portal_role?: string };
  try {
    claims = jwt.verify(ptoken, ssoSecret, {
      issuer: 'acme-portal',
      audience: 'shipping',
    }) as typeof claims;
  } catch {
    res.status(401).json({ message: 'Invalid or expired SSO token.' });
    return;
  }
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ message: 'SSO token missing email.' });
    return;
  }
  const isPortalAdmin = claims.portal_role === 'admin';
  let user = await db('users').where({ email }).first();
  if (!user) {
    const [created] = await db('users')
      .insert({
        email,
        name: claims.full_name || email,
        role: isPortalAdmin ? 'admin' : 'viewer',
        password_hash: '!sso',
      })
      .returning('*');
    user = created;
  } else {
    const updates: Record<string, unknown> = {};
    if (claims.full_name && user.name !== claims.full_name) updates.name = claims.full_name;
    if (isPortalAdmin && user.role !== 'admin') updates.role = 'admin';
    if (Object.keys(updates).length > 0) {
      await db('users').where({ id: user.id }).update(updates);
      user = { ...user, ...updates };
    }
  }
  const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' } as SignOptions);
  const refresh = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' } as SignOptions);
  res.json({ token, refresh, user: payload });
});

router.post('/refresh', async (req, res) => {
  const { refresh } = req.body || {};
  if (!refresh) {
    res.status(400).json({ message: 'Missing refresh token' });
    return;
  }
  try {
    const payload = jwt.verify(refresh, JWT_REFRESH_SECRET) as any;
    const fresh = { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
    const token = jwt.sign(fresh, JWT_SECRET, { expiresIn: '15m' } as SignOptions);
    res.json({ token, user: fresh });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;

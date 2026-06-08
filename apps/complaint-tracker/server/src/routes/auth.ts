import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/connection';
import { authenticate, getJwtSecret } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, refreshTokenSchema } from '@complaint/shared';

const router = Router();

// Get test users (public)
router.get('/test-users', async (_req: Request, res: Response) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'name', 'role')
      .where('is_active', true)
      .orderBy('id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch test users' });
  }
});

// POST /api/auth/sso-exchange — Portal SSO handoff.
router.post('/sso-exchange', async (req: Request, res: Response) => {
  try {
    const ssoSecret = process.env.PORTAL_SSO_SECRET;
    if (!ssoSecret) {
      res.status(503).json({ error: 'SSO not configured.' });
      return;
    }
    const { ptoken } = req.body || {};
    if (typeof ptoken !== 'string') {
      res.status(400).json({ error: 'ptoken required' });
      return;
    }
    let claims: { email: string; full_name?: string; portal_role?: string };
    try {
      claims = jwt.verify(ptoken, ssoSecret, {
        issuer: 'acme-portal',
        audience: 'complaint',
      }) as typeof claims;
    } catch {
      res.status(401).json({ error: 'Invalid or expired SSO token.' });
      return;
    }
    const email = String(claims.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'SSO token missing email.' });
      return;
    }
    // Portal role no longer cascades into Complaint Tracker admin status.
    // This app owns its own user.role values — set them here, not via the
    // portal SSO claim. The portal_role claim is accepted but ignored.
    let user = await db('users').where({ email }).first();
    if (!user) {
      const [created] = await db('users')
        .insert({
          email,
          name: claims.full_name || email,
          role: 'operations',
          is_active: true,
          password_hash: '!sso',
        })
        .returning('*');
      user = created;
    } else {
      const updates: Record<string, unknown> = {};
      if (!user.is_active) updates.is_active = true;
      if (claims.full_name && user.name !== claims.full_name) updates.name = claims.full_name;
      if (Object.keys(updates).length > 0) {
        await db('users').where({ id: user.id }).update(updates);
        user = { ...user, ...updates };
      }
    }
    const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '7d' });
    await db('users').where({ id: user.id }).update({ refresh_token: refreshToken });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, is_active: user.is_active },
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.error('Complaint SSO exchange error:', err);
    res.status(500).json({ error: 'SSO exchange failed' });
  }
});

// Login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '7d' });

    await db('users').where({ id: user.id }).update({ refresh_token: refreshToken });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, is_active: user.is_active },
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, getJwtSecret()) as any;
    const user = await db('users').where({ id: decoded.id, refresh_token: refreshToken, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const newAccessToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '15m' });
    const newRefreshToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '7d' });

    await db('users').where({ id: user.id }).update({ refresh_token: newRefreshToken });

    res.json({ tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authenticate(), async (req: Request, res: Response) => {
  try {
    await db('users').where({ id: req.user!.id }).update({ refresh_token: null });
    res.json({ message: 'Logged out' });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate(), async (req: Request, res: Response) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'name', 'role', 'is_active', 'created_at', 'updated_at')
      .where({ id: req.user!.id })
      .first();
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;

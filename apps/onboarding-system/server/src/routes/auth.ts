import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

// Lazy env reads — see middleware/auth.ts for the systemd/tsx-watch issue.
function jwtSecret() { return process.env.JWT_SECRET || 'dev-secret'; }
function jwtRefreshSecret() { return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'; }
function jwtExpiresIn() { return process.env.JWT_EXPIRES_IN || '15m'; }
function jwtRefreshExpiresIn() { return process.env.JWT_REFRESH_EXPIRES_IN || '7d'; }

function generateTokens(user: { id: number; email: string; name: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    jwtSecret(),
    { expiresIn: jwtExpiresIn() as any }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    jwtRefreshSecret(),
    { expiresIn: jwtRefreshExpiresIn() as any }
  );
  return { accessToken, refreshToken };
}

function testLoginEnabled(): boolean {
  // Default ON — the test sandbox is the whole point of this feature. Set
  // ALLOW_TEST_LOGIN=false in .env to lock it down (e.g. for prod hosts).
  return (process.env.ALLOW_TEST_LOGIN || 'true').toLowerCase() !== 'false';
}

// GET /api/auth/test-roles — list of seeded test users (for the role
// buttons on /test-login). Only returns rows flagged is_test=true.
router.get('/test-roles', async (_req: Request, res: Response) => {
  if (!testLoginEnabled()) {
    res.status(403).json({ message: 'Test login is disabled.' });
    return;
  }
  try {
    const users = await db('users')
      .where({ is_test: true, is_active: true })
      .select('email', 'name', 'role')
      .orderByRaw(`array_position(ARRAY['hr','manager','ehs','it_admin','employee']::text[], role)`);
    res.json(users);
  } catch (err) {
    console.error('Test roles error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/test-login — sign in as the seeded test user for the
// requested role. No password. Always refuses non-test users so this
// endpoint can never escalate a real account.
router.post('/test-login', async (req: Request, res: Response) => {
  if (!testLoginEnabled()) {
    res.status(403).json({ message: 'Test login is disabled.' });
    return;
  }
  try {
    const role = String(req.body?.role || '').toLowerCase();
    if (!role) {
      res.status(400).json({ message: 'role required' });
      return;
    }
    const user = await db('users').where({ role, is_test: true, is_active: true }).first();
    if (!user) {
      res.status(404).json({ message: `No test user seeded for role '${role}'.` });
      return;
    }
    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });
    const dept = user.department_id
      ? await db('departments').where({ id: user.department_id }).first()
      : null;
    const manager = user.manager_id
      ? await db('users').where({ id: user.manager_id }).select('id', 'name', 'email').first()
      : null;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: dept?.name || '',
        manager_id: user.manager_id,
        manager_name: manager?.name || '',
        manager_email: manager?.email || '',
        is_active: user.is_active,
        is_test: true,
      },
      tokens,
    });
  } catch (err) {
    console.error('Test login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/sso-exchange — verifies a portal-issued SSO token and
// returns access + refresh tokens, auto-creating the Onboarding user row
// if needed.
router.post('/sso-exchange', async (req: Request, res: Response) => {
  try {
    const ssoSecret = process.env.PORTAL_SSO_SECRET;
    if (!ssoSecret) {
      res.status(503).json({ message: 'SSO not configured.' });
      return;
    }
    const { ptoken } = req.body || {};
    if (typeof ptoken !== 'string') {
      res.status(400).json({ message: 'ptoken required' });
      return;
    }
    let claims: { email: string; full_name?: string; portal_role?: string };
    try {
      claims = jwt.verify(ptoken, ssoSecret, {
        issuer: 'acme-portal',
        audience: 'onboarding',
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
    // Portal role no longer cascades into Onboarding admin status. This
    // app owns its own user.role values — promote in this DB explicitly
    // rather than relying on the portal_role claim.
    let user = await db('users').where({ email }).first();
    if (!user) {
      const [created] = await db('users')
        .insert({
          email,
          name: claims.full_name || email,
          role: 'employee',
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
    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });
    const dept = user.department_id
      ? await db('departments').where({ id: user.department_id }).first()
      : null;
    const manager = user.manager_id
      ? await db('users').where({ id: user.manager_id }).select('id', 'name', 'email').first()
      : null;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: dept?.name || '',
        manager_id: user.manager_id,
        manager_name: manager?.name || '',
        manager_email: manager?.email || '',
        is_active: user.is_active,
      },
      tokens,
    });
  } catch (err) {
    console.error('Onboarding SSO exchange error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
//
// Password sign-in is disabled by default — the Onboarding app is meant to
// be entered only via the NYCOA Portal SSO bridge. Set ALLOW_PASSWORD_LOGIN=true
// in .env to re-enable the dev/admin fallback.
router.post('/login', async (req: Request, res: Response) => {
  if ((process.env.ALLOW_PASSWORD_LOGIN || '').toLowerCase() !== 'true') {
    res.status(403).json({ message: 'Password login is disabled. Sign in from the Acme Portal.' });
    return;
  }
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });

    // Get department name
    const dept = user.department_id
      ? await db('departments').where({ id: user.department_id }).first()
      : null;

    // Get manager info
    const manager = user.manager_id
      ? await db('users').where({ id: user.manager_id }).select('id', 'name', 'email').first()
      : null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: dept?.name || '',
        manager_id: user.manager_id,
        manager_name: manager?.name || '',
        manager_email: manager?.email || '',
        is_active: user.is_active,
      },
      tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ message: 'Missing refresh token' });
      return;
    }

    const payload = jwt.verify(refreshToken, jwtRefreshSecret()) as { id: number };
    const user = await db('users').where({ id: payload.id, refresh_token: refreshToken, is_active: true }).first();
    if (!user) {
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });

    res.json({ tokens });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await db('users').where({ id: req.user!.id }).first();
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const dept = user.department_id
      ? await db('departments').where({ id: user.department_id }).first()
      : null;
    const manager = user.manager_id
      ? await db('users').where({ id: user.manager_id }).select('id', 'name', 'email').first()
      : null;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: dept?.name || '',
      manager_id: user.manager_id,
      manager_name: manager?.name || '',
      manager_email: manager?.email || '',
      is_test: !!user.is_test,
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await db('users').where({ id: req.user!.id }).update({ refresh_token: null });
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get test users (dev only) — gated behind ALLOW_PASSWORD_LOGIN since this
// list was only useful as a feeder for the password dropdown.
router.get('/test-users', async (_req: Request, res: Response) => {
  if ((process.env.ALLOW_PASSWORD_LOGIN || '').toLowerCase() !== 'true') {
    res.status(403).json({ message: 'Password login is disabled.' });
    return;
  }
  try {
    const users = await db('users')
      .select('email', 'name', 'role')
      .where({ is_active: true })
      .orderBy('role');
    res.json(users);
  } catch (err) {
    console.error('Test users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

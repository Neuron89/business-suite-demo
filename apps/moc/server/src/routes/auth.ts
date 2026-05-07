import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { loginSchema, refreshTokenSchema } from '@moc/shared';
import db from '../db/connection';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
// expiresIn in seconds
const JWT_EXPIRES_IN = 900; // 15 minutes
const JWT_REFRESH_EXPIRES_IN = 604800; // 7 days

function generateTokens(user: { id: number; email: string; name: string; role: string; secondary_roles?: string[]; admin_access?: boolean; is_approver?: boolean }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, secondary_roles: user.secondary_roles || [], admin_access: user.admin_access || false, is_approver: user.is_approver || false },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as SignOptions
  );
  return { accessToken, refreshToken };
}

// GET /api/auth/test-users — gated behind ALLOW_PASSWORD_LOGIN since it
// existed only to feed the legacy login dropdown.
router.get('/test-users', async (_req: Request, res: Response) => {
  if ((process.env.ALLOW_PASSWORD_LOGIN || '').toLowerCase() !== 'true') {
    res.status(403).json({ message: 'Password login is disabled.' });
    return;
  }
  try {
    const users = await db('users')
      .select('email', 'name', 'role')
      .where({ is_active: true })
      .orderBy('name', 'asc');
    res.json(users);
  } catch (err) {
    console.error('Test users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/login
//
// Password sign-in is disabled by default — MOC is meant to be entered only
// via the Acme Portal SSO bridge. Set ALLOW_PASSWORD_LOGIN=true in .env to
// re-enable the dev/admin fallback.
function passwordLoginGate(req: Request, res: Response, next: () => void) {
  if ((process.env.ALLOW_PASSWORD_LOGIN || '').toLowerCase() !== 'true') {
    res.status(403).json({ message: 'Password login is disabled. Sign in from the Acme Portal.' });
    return;
  }
  next();
}

router.post('/login', passwordLoginGate, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const tokens = generateTokens(user);

    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });

    await logAudit(
      { ...req, user: { id: user.id, email: user.email, name: user.name, role: user.role } } as Request,
      'login',
      'user',
      user.id
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, is_active: user.is_active, admin_access: user.admin_access, is_approver: user.is_approver },
      tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/sso-exchange
// Verifies a portal-issued SSO token, upserts the user, returns access +
// refresh tokens just like a normal login.
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
        audience: 'moc',
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
      // Auto-provision a minimal MOC user. Portal admins land as super_admin
      // with admin_access; anyone else as `originator` (can submit MOCs).
      const [created] = await db('users')
        .insert({
          email,
          name: claims.full_name || email,
          role: isPortalAdmin ? 'super_admin' : 'originator',
          admin_access: isPortalAdmin,
          is_approver: isPortalAdmin,
          is_active: true,
          password_hash: '!sso',
        })
        .returning('*');
      user = created;
    } else {
      // Sync admin status + name on every sign-in so directory changes
      // propagate. The directory is the source of truth for display name.
      const updates: Record<string, unknown> = {};
      if (!user.is_active) updates.is_active = true;
      if (claims.full_name && user.name !== claims.full_name) updates.name = claims.full_name;
      if (isPortalAdmin && !user.admin_access) updates.admin_access = true;
      if (isPortalAdmin && !['super_admin', 'admin', 'moc_manager'].includes(user.role)) {
        updates.role = 'super_admin';
      }
      if (Object.keys(updates).length > 0) {
        await db('users').where({ id: user.id }).update(updates);
        user = { ...user, ...updates };
      }
    }

    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });
    await logAudit(
      { ...req, user: { id: user.id, email: user.email, name: user.name, role: user.role } } as Request,
      'login',
      'user',
      user.id
    );
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        admin_access: user.admin_access,
        is_approver: user.is_approver,
      },
      tokens,
    });
  } catch (err) {
    console.error('SSO exchange error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: number };

    const user = await db('users')
      .where({ id: payload.id, refresh_token: refreshToken, is_active: true })
      .first();

    if (!user) {
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });

    res.json({ tokens });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await db('users').where({ id: req.user!.id }).update({ refresh_token: null });
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/magic/:token — magic link auto-login, redirects to client
router.get('/magic/:token', async (req: Request, res: Response) => {
  try {
    const payload = jwt.verify(req.params.token as string, JWT_SECRET) as unknown as { id: number; redirect: string };
    const user = await db('users').where({ id: payload.id, is_active: true }).first();
    if (!user) {
      res.status(401).json({ message: 'Invalid or expired link' });
      return;
    }

    const tokens = generateTokens(user);
    await db('users').where({ id: user.id }).update({ refresh_token: tokens.refreshToken });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirect = payload.redirect || '/';
    res.redirect(`${clientUrl}/auth/magic?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&redirect=${encodeURIComponent(redirect)}`);
  } catch {
    res.status(401).json({ message: 'Invalid or expired link' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'name', 'role', 'is_active', 'admin_access', 'created_at')
      .where({ id: req.user!.id })
      .first();
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

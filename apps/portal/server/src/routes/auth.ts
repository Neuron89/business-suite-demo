import { Router } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { loginSchema, forgotSchema, resetSchema, setPasswordSchema } from '@portal/shared';
import db from '../db/connection';
import { lookupEmployee } from '../services/directory';
import { sendPasswordReset } from '../services/mailer';
import { authenticate, signSession, type AuthUser } from '../middleware/auth';

const router = Router();

const RESET_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Demo-mode shortcut: pick a role from a dropdown, get logged in as that user.
// Skips bcrypt + directory roundtrip. Only enabled when DEMO_MODE=true.
const DEMO_ROLE_TO_EMAIL: Record<string, string> = {
  it: 'demo.it@acme.demo',
  hr: 'demo.hr@acme.demo',
  manager: 'demo.manager@acme.demo',
  employee: 'demo.employee@acme.demo',
};

router.post('/demo', async (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    res.status(404).json({ message: 'Demo mode disabled.' });
    return;
  }
  const role = String(req.body?.role || '').toLowerCase();
  const email = DEMO_ROLE_TO_EMAIL[role];
  if (!email) {
    res.status(400).json({ message: 'role must be one of: it, hr, manager, employee' });
    return;
  }

  const directory = await lookupEmployee(email);
  if (!directory) {
    res.status(500).json({ message: `demo user ${email} not in directory` });
    return;
  }

  // Make sure a portal_users row exists so /me etc. work uniformly.
  const existing = await db('portal_users').where({ email }).first();
  if (!existing) {
    await db('portal_users').insert({ email, is_active: true });
  } else {
    await db('portal_users').where({ id: existing.id }).update({
      is_active: true,
      last_login_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }
  await db('portal_audit_log').insert({ email, action: 'demo_login', detail: { role } });

  const authUser: AuthUser = {
    email,
    full_name: directory.full_name,
    portal_role: directory.portal_role,
  };
  const token = signSession(authUser);
  res.json({
    token,
    employee: {
      email,
      full_name: directory.full_name,
      preferred_name: directory.preferred_name ?? null,
      department: directory.department ?? null,
      title: directory.title ?? null,
      manager_email: directory.manager_email ?? null,
      company_name: directory.company_name ?? null,
      portal_role: directory.portal_role,
      access: directory.access,
      must_reset: false,
    },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const { email, password } = parsed.data;

  let directory;
  try {
    directory = await lookupEmployee(email);
  } catch (err) {
    console.error('[auth/login] directory error:', err);
    res.status(503).json({ message: 'Directory unavailable. Try again shortly.' });
    return;
  }

  if (!directory || directory.status !== 'active') {
    // Don't reveal whether the email exists.
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const user = await db('portal_users').where({ email }).first();
  if (!user || !user.password_hash || !user.is_active) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  await db('portal_users').where({ id: user.id }).update({
    last_login_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
  await db('portal_audit_log').insert({ email, action: 'login', detail: { ip: req.ip } });

  const authUser: AuthUser = {
    email,
    full_name: directory.full_name,
    portal_role: directory.portal_role,
  };
  const token = signSession(authUser);
  res.json({
    token,
    employee: {
      email,
      full_name: directory.full_name,
      preferred_name: directory.preferred_name ?? null,
      department: directory.department ?? null,
      title: directory.title ?? null,
      manager_email: directory.manager_email ?? null,
      company_name: directory.company_name ?? null,
      portal_role: directory.portal_role,
      access: directory.access,
      must_reset: !!user.must_reset,
    },
  });
});

router.post('/forgot', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Email required.' });
    return;
  }
  const { email } = parsed.data;

  let directory;
  try {
    directory = await lookupEmployee(email);
  } catch {
    directory = null;
  }

  // Always respond identically to avoid leaking which emails exist.
  if (directory && directory.status === 'active') {
    let user = await db('portal_users').where({ email }).first();
    if (!user) {
      const [row] = await db('portal_users')
        .insert({ email, must_reset: true })
        .returning(['id']);
      user = row;
    }

    const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    await db('password_reset_tokens').insert({
      email,
      token,
      expires_at: new Date(Date.now() + RESET_TTL_MS),
    });

    const portalBase = process.env.PORTAL_BASE_URL || 'http://localhost:3070';
    const link = `${portalBase.replace(/\/$/, '')}/reset/${token}`;
    try {
      await sendPasswordReset(email, link);
    } catch (err) {
      console.error('[auth/forgot] email failed:', err);
    }
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const { token, password } = parsed.data;

  const record = await db('password_reset_tokens').where({ token }).first();
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    res.status(400).json({ message: 'This reset link is invalid or expired.' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);

  await db.transaction(async (trx) => {
    const existing = await trx('portal_users').where({ email: record.email }).first();
    if (existing) {
      await trx('portal_users').where({ id: existing.id }).update({
        password_hash,
        must_reset: false,
        is_active: true,
        updated_at: trx.fn.now(),
      });
    } else {
      await trx('portal_users').insert({ email: record.email, password_hash, must_reset: false });
    }
    await trx('password_reset_tokens').where({ id: record.id }).update({ used_at: trx.fn.now() });
    await trx('portal_audit_log').insert({ email: record.email, action: 'password_reset' });
  });

  res.json({ message: 'Password set.' });
});

router.post('/set-password', authenticate, async (req, res) => {
  const parsed = setPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || 'invalid input' });
    return;
  }
  const password_hash = await bcrypt.hash(parsed.data.password, 10);
  await db('portal_users').where({ email: req.user!.email }).update({
    password_hash,
    must_reset: false,
    updated_at: db.fn.now(),
  });
  res.json({ message: 'Password updated.' });
});

router.get('/me', authenticate, async (req, res) => {
  let directory;
  try {
    directory = await lookupEmployee(req.user!.email);
  } catch (err) {
    console.error('[auth/me] directory error:', err);
    res.status(503).json({ message: 'Directory unavailable.' });
    return;
  }
  if (!directory) {
    res.status(404).json({ message: 'Not found.' });
    return;
  }
  const user = await db('portal_users').where({ email: req.user!.email }).first();
  res.json({
    employee: {
      email: directory.email,
      full_name: directory.full_name,
      preferred_name: directory.preferred_name ?? null,
      department: directory.department ?? null,
      title: directory.title ?? null,
      manager_email: directory.manager_email ?? null,
      company_name: directory.company_name ?? null,
      portal_role: directory.portal_role,
      access: directory.access,
      must_reset: !!user?.must_reset,
    },
  });
});

router.post('/logout', authenticate, async (req, res) => {
  await db('portal_audit_log').insert({ email: req.user!.email, action: 'logout' });
  res.json({ message: 'Logged out.' });
});

export default router;

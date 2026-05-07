/**
 * Single-sign-on bridge: portal mints a short-lived JWT that downstream
 * internal apps (MOC, IT Request, Complaint, Shipping, ETD, QC Lab) accept
 * in lieu of their own login.
 *
 * Flow:
 *   1. Portal home tile click hits GET /api/sso/<module>?next=/dashboard
 *   2. Server checks the user is authenticated AND has access to the module
 *   3. Mints a 5-minute JWT signed with PORTAL_SSO_SECRET, payload:
 *        { email, full_name, portal_role, iss: 'acme-portal', aud: <module> }
 *   4. Returns { redirect_url } pointing at the downstream app's /sso page
 *      with ?ptoken=<jwt>&next=<next>
 *
 * The downstream app must verify the JWT with the same shared secret. We pin
 * `aud` per-module so a token minted for MOC can't be used to sign into IT
 * Request and vice versa.
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { MODULES, type ModuleKey } from '@portal/shared';
import { authenticate } from '../middleware/auth';
import { lookupEmployee } from '../services/directory';

const router = Router();

const SSO_TTL_S = 300;

/**
 * Map module key → base URL env var. Falls back to the same env var the
 * tile system uses, so we never disagree about where a downstream app lives.
 */
function moduleBaseUrl(key: ModuleKey): string | null {
  const m = MODULES.find((x) => x.key === key);
  if (!m) return null;
  const url = (process.env[m.urlEnvVar] || '').trim();
  return url || null;
}

router.get('/:module', authenticate, async (req, res) => {
  const secret = process.env.PORTAL_SSO_SECRET;
  if (!secret) {
    res.status(503).json({ message: 'SSO not configured (PORTAL_SSO_SECRET missing).' });
    return;
  }

  const moduleKey = req.params.module as ModuleKey;
  const moduleDesc = MODULES.find((m) => m.key === moduleKey);
  if (!moduleDesc) {
    res.status(404).json({ message: `Unknown module '${moduleKey}'.` });
    return;
  }
  if (moduleDesc.external) {
    res
      .status(400)
      .json({ message: 'External tiles open directly; SSO is not used.' });
    return;
  }

  const base = moduleBaseUrl(moduleKey);
  if (!base) {
    res.status(503).json({ message: `${moduleKey} URL not configured.` });
    return;
  }

  // Re-fetch the user so we have a fresh access map (in case it changed since
  // they signed in to the portal).
  const directory = await lookupEmployee(req.user!.email);
  if (!directory || directory.status !== 'active') {
    res.status(403).json({ message: 'Not an active employee.' });
    return;
  }
  // Portal admins can SSO into every internal app, even without the per-user
  // access flag. Their portal_role=admin claim flows downstream so the app
  // can elevate them to its own admin role.
  if (!directory.access[moduleKey] && directory.portal_role !== 'admin') {
    res.status(403).json({ message: `You don't have access to ${moduleDesc.label}.` });
    return;
  }

  const ptoken = jwt.sign(
    {
      email: directory.email,
      full_name: directory.full_name,
      portal_role: directory.portal_role,
    },
    secret,
    {
      expiresIn: SSO_TTL_S,
      issuer: 'acme-portal',
      audience: moduleKey,
    }
  );

  const next = typeof req.query.next === 'string' ? req.query.next : '';
  const url = new URL('/sso', base);
  url.searchParams.set('ptoken', ptoken);
  if (next) url.searchParams.set('next', next);
  res.json({ redirect_url: url.toString() });
});

export default router;

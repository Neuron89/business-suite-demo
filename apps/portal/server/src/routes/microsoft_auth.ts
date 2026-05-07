/**
 * Microsoft / Entra ID OAuth login.
 *
 * Flow:
 *   1. Browser hits GET /api/auth/microsoft/start
 *      → server generates a signed state (5-min JWT) and 302s to Microsoft
 *        with redirect_uri = AZURE_REDIRECT_URI (a path on the portal CLIENT)
 *   2. Microsoft auths the user, redirects browser to
 *      AZURE_REDIRECT_URI?code=...&state=...
 *   3. Client page POSTs that to /api/auth/microsoft/exchange
 *      → server validates state, swaps code for tokens via the Microsoft token
 *        endpoint (uses the client secret), verifies the ID token signature
 *        against Microsoft's JWKS, looks up the employee by email, and mints
 *        the same { token, employee } payload as a password login.
 *
 * If the email isn't in the directory, login is refused — HR/IT must onboard
 * the user first.
 */
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import db from '../db/connection';
import { lookupEmployee } from '../services/directory';
import { signSession, type AuthUser } from '../middleware/auth';

const router = Router();

const STATE_TTL_MS = 5 * 60 * 1000;
const STATE_SECRET = process.env.JWT_SECRET || 'dev-portal-secret';

function readEnv() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const redirectUri = process.env.AZURE_REDIRECT_URI;
  if (!clientId || !tenantId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, tenantId, clientSecret, redirectUri };
}

function authorizeUrl(env: ReturnType<typeof readEnv> & object, state: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: 'code',
    redirect_uri: env.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read offline_access',
    state,
  });
  return `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/authorize?${params}`;
}

router.get('/start', (req, res) => {
  const env = readEnv();
  if (!env) {
    res.status(503).json({ message: 'Microsoft sign-in not configured.' });
    return;
  }
  const state = jwt.sign(
    { nonce: crypto.randomBytes(16).toString('hex') },
    STATE_SECRET,
    { expiresIn: Math.floor(STATE_TTL_MS / 1000) }
  );
  res.redirect(authorizeUrl(env, state));
});

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getJwks(tenantId: string) {
  let jwks = jwksCache.get(tenantId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
    jwksCache.set(tenantId, jwks);
  }
  return jwks;
}

router.post('/exchange', async (req, res) => {
  const env = readEnv();
  if (!env) {
    res.status(503).json({ message: 'Microsoft sign-in not configured.' });
    return;
  }

  const { code, state } = req.body ?? {};
  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).json({ message: 'code and state required' });
    return;
  }

  // Validate state (prevents CSRF + replay)
  try {
    jwt.verify(state, STATE_SECRET);
  } catch {
    res.status(400).json({ message: 'Invalid or expired login state. Try signing in again.' });
    return;
  }

  // Exchange the auth code for tokens
  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.redirectUri,
        scope: 'openid profile email User.Read offline_access',
      }),
    }
  );
  if (!tokenResp.ok) {
    const detail = await tokenResp.text();
    console.error('[microsoft/exchange] token endpoint:', tokenResp.status, detail);
    res.status(401).json({ message: 'Microsoft sign-in failed. Try again.' });
    return;
  }
  const tokens = (await tokenResp.json()) as { id_token?: string };
  if (!tokens.id_token) {
    res.status(401).json({ message: 'Microsoft sign-in returned no ID token.' });
    return;
  }

  // Verify the ID token signature against Microsoft's JWKS
  let claims: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(tokens.id_token, getJwks(env.tenantId), {
      audience: env.clientId,
      issuer: `https://login.microsoftonline.com/${env.tenantId}/v2.0`,
    });
    claims = payload as Record<string, unknown>;
  } catch (err) {
    console.error('[microsoft/exchange] id_token verify:', err);
    res.status(401).json({ message: 'Invalid ID token.' });
    return;
  }

  const email = String(
    claims.email || claims.preferred_username || claims.upn || ''
  )
    .trim()
    .toLowerCase();
  if (!email) {
    res.status(401).json({ message: 'Microsoft account did not include an email.' });
    return;
  }

  // Look up the employee — this is the gate. If the M365 user doesn't have
  // an active employee row, deny.
  let directory;
  try {
    directory = await lookupEmployee(email);
  } catch (err) {
    console.error('[microsoft/exchange] directory error:', err);
    res.status(503).json({ message: 'Directory unavailable. Try again shortly.' });
    return;
  }
  if (!directory || directory.status !== 'active') {
    res.status(403).json({
      message: `${email} is signed in via Microsoft, but is not an active employee in this portal. Contact IT.`,
    });
    return;
  }

  // Make sure a portal_users row exists so /me + audit work, but no password.
  const existing = await db('portal_users').where({ email }).first();
  if (!existing) {
    await db('portal_users').insert({ email, must_reset: false, is_active: true });
  } else {
    await db('portal_users').where({ id: existing.id }).update({
      last_login_at: db.fn.now(),
      updated_at: db.fn.now(),
      is_active: true,
    });
  }
  await db('portal_audit_log').insert({
    email,
    action: 'login',
    detail: { ip: req.ip, method: 'microsoft' },
  });

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

export default router;

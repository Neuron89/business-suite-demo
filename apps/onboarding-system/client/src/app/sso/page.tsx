'use client';

/**
 * Portal → Onboarding single sign-on landing page.
 * Hardened: 15s timeout + one auto-retry on stall.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const EXCHANGE_TIMEOUT_MS = 15000;
const SLOW_MS = 4000;

function getApiBase(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4080/api';
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit && !explicit.startsWith('http://localhost')) return explicit;
  const host = window.location.hostname;
  const isLan = host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (isLan) return `${window.location.protocol}//${host}:4080/api`;
  return `${window.location.origin}/api`;
}

type Stage = 'starting' | 'exchanging' | 'slow' | 'success' | 'failed';

function SsoHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const ptoken = params.get('ptoken');
  const next = params.get('next') || '/dashboard';

  const [stage, setStage] = useState<Stage>('starting');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);

  const runExchange = useCallback(async () => {
    if (!ptoken) { setError('Missing SSO token. Open this app from the portal.'); setStage('failed'); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setStage('exchanging');
    setError(null);

    const slowTimer = window.setTimeout(() => setStage((s) => (s === 'exchanging' ? 'slow' : s)), SLOW_MS);
    const ac = new AbortController();
    const killTimer = window.setTimeout(() => ac.abort('exchange-timeout'), EXCHANGE_TIMEOUT_MS);

    try {
      const resp = await fetch(`${getApiBase()}/auth/sso-exchange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ptoken }), signal: ac.signal,
      });
      const text = await resp.text();
      let body: any;
      try { body = text ? JSON.parse(text) : {}; }
      catch { body = { message: text || 'Server returned a non-JSON response.' }; }
      if (!resp.ok) throw new Error(body?.message || `Sign-in failed (${resp.status}).`);

      const session = {
        accessToken: body.tokens.accessToken,
        refreshToken: body.tokens.refreshToken,
        user: body.user,
      };
      localStorage.setItem('onb_auth', JSON.stringify(session));
      window.dispatchEvent(new CustomEvent('onb:auth-refreshed', { detail: session }));
      setStage('success');
      router.replace(next);
    } catch (err) {
      const isAbort = (err as any)?.name === 'AbortError';
      const msg = isAbort ? 'Sign-in took too long to respond.' : (err as Error).message || 'Sign-in failed';
      if (attempt === 0) {
        setAttempt(1);
        setStage('exchanging'); setError(null);
        inFlight.current = false;
        window.setTimeout(() => { runExchange(); }, 800);
        return;
      }
      setError(msg);
      setStage('failed');
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(killTimer);
      inFlight.current = false;
    }
  }, [ptoken, next, router, attempt]);

  useEffect(() => { runExchange(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const retry = () => { setAttempt(0); runExchange(); };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem', textAlign: 'center' }}>
      {stage === 'failed' ? (
        <>
          <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '1rem' }}>Sign-in failed</p>
          {error && <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 420 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={retry} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Try again</button>
            <a href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'} style={{ background: '#e2e8f0', color: '#0f172a', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, textDecoration: 'none' }}>Back to portal</a>
          </div>
        </>
      ) : stage === 'slow' ? (
        <><Spinner /><p style={{ fontSize: '0.95rem' }}>Still signing you in…</p><p style={{ fontSize: '0.8rem', color: '#64748b' }}>The backend may be waking up — this should only take a few seconds.</p></>
      ) : (
        <><Spinner /><p style={{ fontSize: '0.95rem' }}>{attempt > 0 ? 'Retrying sign-in…' : 'Signing you in via the portal…'}</p></>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #cbd5e1', borderTopColor: '#3b82f6', animation: 'sso-spin 0.8s linear infinite' }}>
      <style>{`@keyframes sso-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Signing you in…</p></div>}>
      <SsoHandler />
    </Suspense>
  );
}

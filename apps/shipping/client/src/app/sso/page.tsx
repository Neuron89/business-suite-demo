'use client';

/**
 * Portal → Shipping Command SSO landing page.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Resolve the API URL from the page's own host so this works whether the
// user visits localhost, the LAN IP, or a hostname behind nginx — no
// .env.local required.
function getApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit && !explicit.startsWith('http://localhost')) return explicit;
  if (typeof window === 'undefined') return 'http://localhost:4030/api';
  const { protocol, hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//${hostname}:4030/api`;
  return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
}

function SsoHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const ptoken = params.get('ptoken');
    const next = params.get('next') || '/dashboard';
    if (!ptoken) {
      setError('Missing SSO token. Open this app from the portal.');
      return;
    }
    (async () => {
      try {
        const resp = await fetch(`${getApiBase()}/auth/sso-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ptoken }),
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body?.message || 'Sign-in failed');
        localStorage.setItem('shipping_token', body.token);
        localStorage.setItem('shipping_refresh', body.refresh);
        router.replace(next);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [params, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '0.75rem' }}>
      {error ? (
        <>
          <p style={{ color: '#ef4444', fontWeight: 600 }}>Sign-in failed</p>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</p>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Return to the Acme Portal and click the Shipping tile again.</p>
        </>
      ) : (
        <p>Signing you in via the portal…</p>
      )}
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

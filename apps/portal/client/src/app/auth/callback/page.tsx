'use client';

/**
 * Microsoft OAuth callback page.
 *
 * Microsoft redirects the browser here with ?code=...&state=... after the
 * user signs in. We POST those to /api/auth/microsoft/exchange (the server
 * does the actual token swap with the client secret), then drop the
 * resulting portal session into the auth context.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

export default function MicrosoftCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // strict mode double-invoke guard
    ranRef.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const errParam = params.get('error_description') || params.get('error');
    if (errParam) {
      setError(errParam);
      return;
    }
    if (!code || !state) {
      setError('Missing code or state in callback URL.');
      return;
    }

    (async () => {
      try {
        const resp = await fetch(`${API_URL}/api/auth/microsoft/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body?.message || 'Sign-in failed');
        adoptSession(body.token, body.employee);
        router.replace('/home');
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [params, router, adoptSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-red-500 mb-2">Microsoft sign-in failed</h1>
            <p className="text-sm text-theme-muted">{error}</p>
            <a href="/login" className="mt-4 inline-block text-accent hover:underline">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-theme-primary mb-2">Signing you in…</h1>
            <p className="text-sm text-theme-muted">Talking to Microsoft. One sec.</p>
          </>
        )}
      </div>
    </div>
  );
}

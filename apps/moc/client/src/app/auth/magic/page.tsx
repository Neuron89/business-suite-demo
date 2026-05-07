'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function MagicLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const redirect = searchParams.get('redirect') || '/';

    if (accessToken && refreshToken) {
      // Store auth tokens — same format as the normal login flow
      localStorage.setItem('moc_auth', JSON.stringify({
        accessToken,
        refreshToken,
      }));
      // Redirect to the target page
      router.replace(redirect);
    } else {
      router.replace('/');
    }
  }, [searchParams, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Signing you in...</p>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Signing you in...</p></div>}>
      <MagicLinkHandler />
    </Suspense>
  );
}

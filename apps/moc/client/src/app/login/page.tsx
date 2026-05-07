'use client';

/**
 * MOC sign-in is portal-only. The dev "select user" dropdown was retired
 * once the Acme Portal SSO bridge went live — sign in to the portal first,
 * then click the MOC tile.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function landingFor(_role?: string) {
  return '/dashboard';
}

function resolvePortalUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PORTAL_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3070`;
  }
  return 'http://localhost:3070';
}

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [portalUrl, setPortalUrl] = useState('');

  useEffect(() => {
    setPortalUrl(resolvePortalUrl());
  }, []);

  useEffect(() => {
    if (user) router.replace(landingFor(user.role));
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 font-extrabold text-lg bg-accent text-accent-on">
            M
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-theme-primary">
            MOC<span className="text-accent">System</span>
          </h1>
          <p className="text-sm mt-1 text-theme-muted">Management of Change</p>
        </div>

        <div className="card">
          <p className="text-sm text-theme-secondary">
            Sign in from the Acme Portal — the MOC tile will bring you here
            already authenticated.
          </p>
          <a
            href={portalUrl || '#'}
            className="btn-accent w-full inline-flex items-center justify-center mt-5"
          >
            Open Acme Portal
          </a>
        </div>
      </div>
    </div>
  );
}

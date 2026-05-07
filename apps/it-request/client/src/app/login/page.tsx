'use client';

/**
 * IT Request sign-in is portal-only. The dev "select user" dropdown was
 * retired once the Acme Portal SSO bridge went live — sign in to the
 * portal first, then click the IT Request tile.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

function landingFor(role?: string) {
  if (role === 'it_admin' || role === 'manager') return '/dashboard';
  if (role === 'hr') return '/onboarding';
  return '/tickets';
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
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [portalUrl, setPortalUrl] = useState('');

  useEffect(() => {
    setPortalUrl(resolvePortalUrl());
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(landingFor(user.role));
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center font-extrabold text-base"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              IT
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-theme-primary">
                IT<span className="text-accent">Tickets</span>
              </h1>
              <p className="text-xs text-theme-muted">Ticketing & Onboarding Portal</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-card-hover-surface transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-theme-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-theme-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-theme-secondary">
            Sign in from the Acme Portal — the IT Request tile will bring you here
            already authenticated.
          </p>
          <a
            href={portalUrl || '#'}
            className="btn-accent w-full inline-flex items-center justify-center"
          >
            Open Acme Portal
          </a>
        </div>
      </div>
    </div>
  );
}

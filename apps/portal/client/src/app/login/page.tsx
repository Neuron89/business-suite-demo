'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import type { DemoRole } from '@/lib/api';

const DEMO_ROLES: { value: DemoRole; label: string; sub: string }[] = [
  { value: 'it',       label: 'IT Administrator',        sub: 'Full admin everywhere; manages employee directory.' },
  { value: 'hr',       label: 'HR Lead',                 sub: 'Onboarding, employee directory, MOC originator.' },
  { value: 'manager',  label: 'Plant Manager',           sub: 'Approves MOCs and tickets; views shipping & QC.' },
  { value: 'employee', label: 'Production Operator',     sub: 'Submits MOCs and tickets; read-only on most modules.' },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginDemo, employee, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [role, setRole] = useState<DemoRole>('manager');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && employee) router.replace('/home');
  }, [loading, employee, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginDemo(role);
      router.replace('/home');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

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
              AC
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-theme-primary">
                Acme Industries<span className="text-accent"> Portal</span>
              </h1>
              <p className="text-xs text-theme-muted">Single sign-in for every internal system</p>
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

        <div
          className="mb-5 rounded-lg p-3 text-sm"
          style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <strong>Demo mode.</strong> Pick one of four roles to explore the suite. Real
          SSO (Microsoft Entra) is wired in the production version — see the
          README.
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-theme-secondary mb-2">
              Sign in as
            </label>
            <div className="space-y-2">
              {DEMO_ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    role === r.value
                      ? 'border-accent bg-card-hover-surface'
                      : 'border-theme hover:bg-card-hover-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="demo-role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-1 accent-amber-500"
                  />
                  <span>
                    <span className="block font-semibold text-theme-primary">{r.label}</span>
                    <span className="block text-xs text-theme-muted">{r.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-accent w-full">
            {submitting ? 'Signing in…' : 'Enter the demo'}
          </button>
        </form>

        <div className="mt-6 text-xs text-theme-faint text-center">
          Acme Industries — Demo Suite · public showcase · no real data
        </div>
      </div>
    </div>
  );
}

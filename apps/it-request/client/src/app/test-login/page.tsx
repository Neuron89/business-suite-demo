'use client';

/**
 * Test-mode role-switcher landing page. Shows one button per seeded test
 * role; clicking signs in as that test user (no password) and routes to
 * the role's natural landing page. Persistent test-mode banner in the
 * authenticated layout lets you flip back here mid-session.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTestRoles, testLogin } from '@/lib/api';

const ROLE_BLURB: Record<string, string> = {
  hr: 'Submit onboarding tickets for new hires.',
  manager: 'Approve direct-report requests and fill in onboarding details.',
  ehs: 'Review onboarding for EHS-related requirements.',
  it_admin: 'Triage tickets, assign, and complete work.',
  employee: 'Submit hardware/software/access requests.',
};

const ROLE_GLYPH: Record<string, string> = {
  hr: 'HR',
  manager: 'M',
  ehs: 'E',
  it_admin: 'IT',
  employee: 'EM',
};

const ROLE_COLOR: Record<string, string> = {
  hr: '#8b5cf6',
  manager: '#f59e0b',
  ehs: '#22c55e',
  it_admin: '#3b82f6',
  employee: '#64748b',
};

const ROLE_LABEL: Record<string, string> = {
  hr: 'HR',
  manager: 'Manager',
  ehs: 'EHS',
  it_admin: 'IT',
  employee: 'Employee',
};

function landingFor(role: string) {
  if (role === 'it_admin' || role === 'manager') return '/dashboard';
  if (role === 'hr') return '/onboarding';
  return '/tickets';
}

export default function TestLoginPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<{ email: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTestRoles()
      .then(setRoles)
      .catch((err) => setError(err.message || 'Failed to load test roles'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectRole(role: string) {
    setBusyRole(role);
    setError(null);
    try {
      const result = await testLogin(role);
      localStorage.setItem(
        'itr_auth',
        JSON.stringify({
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          user: result.user,
        })
      );
      // Hard redirect so the auth-context reinitialises from localStorage
      // — router.replace alone leaves the prior provider state stale.
      window.location.href = landingFor(result.user.role);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
      setBusyRole(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 font-extrabold text-base"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            T
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-theme-primary">
            IT<span className="text-accent">Tickets</span> — Test Mode
          </h1>
          <p className="text-sm mt-1 text-theme-muted">
            Sign in as any role to walk a workflow end-to-end.
            All actions hit isolated <code className="font-mono">is_test</code> users.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="card"><p className="text-theme-muted">Loading roles…</p></div>
        ) : roles.length === 0 ? (
          <div className="card">
            <p className="text-theme-muted">
              No test users seeded. Run <code className="font-mono">npm run seed</code> from{' '}
              <code className="font-mono">it_request_system/server</code>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roles.map((u) => {
              const color = ROLE_COLOR[u.role] || '#64748b';
              const isBusy = busyRole === u.role;
              return (
                <button
                  key={u.role}
                  onClick={() => handleSelectRole(u.role)}
                  disabled={!!busyRole}
                  className="card text-left hover:translate-y-[-2px] transition-transform disabled:opacity-60 disabled:cursor-wait"
                  style={{ borderTop: `4px solid ${color}` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                      style={{ background: color }}
                    >
                      {ROLE_GLYPH[u.role] || u.role.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-theme-primary">
                        {ROLE_LABEL[u.role] || u.role}
                      </div>
                      <div className="text-xs text-theme-muted truncate">{u.name}</div>
                    </div>
                  </div>
                  <p className="text-xs text-theme-muted mt-3">
                    {ROLE_BLURB[u.role] || 'Test user.'}
                  </p>
                  {isBusy && (
                    <p className="text-xs text-accent mt-2 font-semibold">Signing in…</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

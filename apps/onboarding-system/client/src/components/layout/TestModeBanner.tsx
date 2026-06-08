'use client';

/**
 * Persistent banner that's only visible when signed in as a test user.
 * Shows the current role and a button back to /test-login so you can
 * swap roles mid-session without manually editing localStorage.
 */
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABEL: Record<string, string> = {
  hr: 'HR',
  manager: 'Manager',
  ehs: 'EHS',
  it_admin: 'IT',
  employee: 'Employee',
};

export default function TestModeBanner() {
  const { user, logout } = useAuth();
  if (!user?.is_test) return null;

  async function handleSwitch() {
    await logout();
    window.location.href = '/test-login';
  }

  return (
    <div
      className="sticky top-0 z-40 px-4 py-2 flex items-center gap-3 text-sm font-semibold"
      style={{
        background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
        color: '#fff',
      }}
    >
      <span className="uppercase tracking-wider text-[0.7rem] bg-white/20 rounded px-2 py-0.5">
        Test Mode
      </span>
      <span>
        Signed in as <strong>{ROLE_LABEL[user.role] || user.role}</strong> ({user.name})
      </span>
      <div className="flex-1" />
      <button
        onClick={handleSwitch}
        className="bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1 text-xs font-bold"
      >
        Switch role
      </button>
      <Link
        href="/test-login"
        className="bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1 text-xs font-bold"
      >
        All roles
      </Link>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import PortalBackLink from '@/components/PortalBackLink';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊', roles: null },
  { label: 'Complaints', href: '/complaints', icon: '📋', roles: null },
  { label: 'Audit Trail', href: '/audit', icon: '🔍', roles: null },
  { label: 'Manage Users', href: '/admin', icon: '👥', roles: ['admin'] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full w-[260px] flex flex-col z-50 transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
      {/* Portal back-link chip (hides itself if NEXT_PUBLIC_PORTAL_URL unset) */}
      <div className="px-5 pt-4 pb-2">
        <PortalBackLink />
      </div>
      {/* Logo */}
      <div className="px-5 pb-5 pt-1 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold">
          CT
        </div>
        <span className="text-white font-bold text-lg flex-1">ComplaintTracker</span>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="md:hidden p-1 -mr-1 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.roles || (user && item.roles.includes(user.role)))
          .map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      {/* User card */}
      {user && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-slate-500 hover:text-red-400 transition-colors px-1"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      {children}
    </svg>
  );
}

const HomeIcon = () => (
  <SvgIcon>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </SvgIcon>
);
const ListIcon = () => (
  <SvgIcon>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  </SvgIcon>
);
const UsersIcon = () => (
  <SvgIcon>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
    />
  </SvgIcon>
);
const ShieldIcon = () => (
  <SvgIcon>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
    />
  </SvgIcon>
);
const SunIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
    />
  </svg>
);
const MoonIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
    />
  </svg>
);

type NavItem = { href: string; label: string; icon: () => React.ReactElement; roles?: string[] };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/home', label: 'Home', icon: HomeIcon },
      { href: '/announcements', label: 'Announcements', icon: ListIcon },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/training', label: 'My Training', icon: ShieldIcon },
      { href: '/suggestions', label: 'Suggestion Box', icon: ListIcon },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard', label: 'IT Dashboard', icon: ShieldIcon, roles: ['admin', 'hr'] },
      { href: '/admin', label: 'Admin Tools', icon: UsersIcon, roles: ['admin', 'hr'] },
    ],
  },
];

export default function Sidebar() {
  const { employee, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  if (!employee) return null;

  const initials = (employee.full_name || employee.email)
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-[260px] flex flex-col z-50 transition-colors duration-300"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.06]">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center font-extrabold text-sm flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          AC
        </div>
        <div className="text-white font-extrabold text-[1.1rem] tracking-tight">
          Acme Industries<span style={{ color: 'var(--accent)' }} className="font-semibold"> Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(employee.portal_role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <div
                className="text-[0.6rem] font-bold uppercase tracking-[0.1em] px-3 pt-4 pb-2"
                style={{ color: '#475569' }}
              >
                {section.label}
              </div>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname?.startsWith(item.href + '/'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[0.85rem] font-semibold transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
                      isActive
                        ? 'text-[var(--accent)]'
                        : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:translate-x-0.5'
                    }`}
                    style={{ background: isActive ? 'var(--sidebar-active)' : undefined }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = '';
                    }}
                  >
                    <span
                      className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] origin-center ${
                        isActive ? 'scale-y-100' : 'scale-y-0'
                      }`}
                      style={{ background: 'var(--accent)' }}
                    />
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                      <item.icon />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 py-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-[0.8rem] font-semibold text-[#94a3b8] transition-all duration-200 hover:text-[#e2e8f0]"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* User card + logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-200 cursor-default"
          style={{ background: 'var(--sidebar-hover)' }}
        >
          <div
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.8rem] font-semibold text-[#e2e8f0] truncate">
              {employee.full_name}
            </div>
            <div
              className="text-[0.65rem] font-bold uppercase tracking-wider"
              style={{ color: 'var(--accent)' }}
            >
              {employee.portal_role.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 w-full text-left px-3 py-2 rounded-[10px] text-[0.8rem] font-semibold text-[#94a3b8] transition-all duration-200 hover:text-[#f87171]"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

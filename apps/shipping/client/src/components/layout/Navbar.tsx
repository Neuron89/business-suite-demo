'use client';

import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

interface Props {
  onMenu?: () => void;
}

export default function Navbar({ onMenu }: Props) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header className="border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
        <button
          className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 dark:border-navy-700 text-navy-700 dark:text-navy-200"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-navy-800 dark:text-white truncate">
            Shipping Command
          </h1>
          <p className="text-[11px] sm:text-xs text-navy-500 dark:text-navy-300 truncate">
            Acme Industries — head of shipping
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            className="btn btn-secondary text-xs px-2 sm:px-4"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <div className="hidden sm:block text-sm text-right">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-navy-500 dark:text-navy-300">{user?.role}</div>
          </div>
          <button className="btn btn-secondary text-xs px-2 sm:px-4" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

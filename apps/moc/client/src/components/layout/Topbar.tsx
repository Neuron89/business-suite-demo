'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/moc': 'MOC Requests',
  '/moc/new': 'New MOC Request',
  '/audit': 'Audit Log',
  '/admin': 'Administration',
  '/reports': 'Reports',
  '/help': 'Help & Documentation',
};

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  // Build breadcrumb label
  let pageLabel = 'Page';
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      pageLabel = label;
    }
  }

  // MOC detail page
  if (pathname.match(/^\/moc\/\d+/)) {
    pageLabel = 'MOC Detail';
  }

  return (
    <header className="sticky top-0 z-40 h-[60px] flex items-center justify-between px-8 border-b bg-card-surface border-theme transition-colors duration-300">
      <div>
        <div className="text-xs text-theme-faint">
          Home <span className="text-theme-muted">/ {pageLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 border bg-page border-theme transition-all duration-200 hover:border-amber-500"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="text-sm">{theme === 'dark' ? '☀' : '☾'}</span>
          <div className={`relative w-[34px] h-[18px] rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <div
              className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </div>
        </button>

        {/* Notification bell */}
        <button
          className="relative w-9 h-9 rounded-[10px] border flex items-center justify-center text-base bg-card-surface border-theme text-theme-muted transition-all duration-200 hover:scale-105 hover:border-amber-500 hover:text-amber-500"
          title="Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-rose-500 border-2 border-white dark:border-navy-800" />
        </button>
      </div>
    </header>
  );
}

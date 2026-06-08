'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';

const pageLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/complaints': 'Complaints',
  '/complaints/new': 'New Complaint',
  '/admin': 'User Management',
  '/audit': 'Audit Trail',
};

interface TopbarProps {
  onMenuOpen?: () => void;
}

export default function Topbar({ onMenuOpen }: TopbarProps = {}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const getLabel = () => {
    if (pageLabels[pathname]) return pageLabels[pathname];
    if (pathname.match(/^\/complaints\/\d+$/)) return 'Complaint Detail';
    return 'Complaint Tracker';
  };

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-6 border-b"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3 text-sm min-w-0">
        {onMenuOpen && (
          <button
            type="button"
            onClick={onMenuOpen}
            aria-label="Open menu"
            className="md:hidden p-2 -ml-2 rounded-md"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        <span className="hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>Complaint Tracker</span>
        <span className="hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{getLabel()}</span>
      </div>

      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/shipments', label: 'Shipments' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/rates', label: 'Rate book' },
  { href: '/fsc', label: 'Fuel surcharge' },
  { href: '/settings', label: 'Settings' },
];

interface Props {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ mobileOpen = false, onNavigate }: Props) {
  const pathname = usePathname();
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onNavigate}
          aria-hidden
        />
      )}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-56 py-4
          border-r border-slate-200 dark:border-navy-700
          bg-white dark:bg-navy-900
          transform transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <nav className="flex flex-col">
          {links.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onNavigate}
                className={`px-5 py-2 text-sm font-medium border-l-4 ${
                  active
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-navy-800 dark:text-amber-300'
                    : 'border-transparent text-navy-700 dark:text-navy-200 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

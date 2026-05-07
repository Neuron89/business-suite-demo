'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Kiosk layout for the IT command-center dashboard. No sidebar, full
 * viewport, dark by default. Designed to live on a TV in the office.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { employee, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !employee) {
      router.replace('/login');
    } else if (!loading && employee && !['admin', 'hr'].includes(employee.portal_role)) {
      router.replace('/home');
    }
  }, [employee, loading, router]);

  // Force dark theme on this route — TV looks much better in dark.
  useEffect(() => {
    const html = document.documentElement;
    const had = html.classList.contains('dark');
    html.classList.add('dark');
    return () => {
      if (!had) html.classList.remove('dark');
    };
  }, []);

  if (loading || !employee) return null;

  return <div className="dashboard-kiosk min-h-screen w-full">{children}</div>;
}

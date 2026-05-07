'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';

/**
 * Shared layout for every authenticated portal page. Mirrors the IT Request /
 * MOC pattern: fixed 260px sidebar on the left, centered content area with a
 * max width that keeps long pages readable.
 */
export default function PortalShell({ children }: { children: ReactNode }) {
  const { employee, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !employee) router.replace('/login');
  }, [employee, loading, router]);

  if (loading || !employee) return null;

  return (
    <div className="min-h-screen bg-page">
      <Sidebar />
      <main className="ml-[260px] p-6 lg:p-8 flex justify-center">
        <div className="w-full max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}

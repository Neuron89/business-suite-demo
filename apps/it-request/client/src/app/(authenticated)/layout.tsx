'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import TestModeBanner from '@/components/layout/TestModeBanner';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-page">
      <TestModeBanner />
      <Sidebar />
      <main className="ml-[260px] p-6 flex justify-center"><div className="w-full max-w-5xl">{children}</div></main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import TestModeBanner from '@/components/layout/TestModeBanner';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileNavOpen ? 'hidden' : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-page">
      <TestModeBanner />
      {/* Mobile top bar — visible below md */}
      <header
        className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
          className="p-2 -ml-2 rounded-md text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-extrabold text-xs"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            ON
          </div>
          <div className="text-white font-extrabold text-sm tracking-tight">
            On<span style={{ color: 'var(--accent)' }} className="font-semibold">boarding</span>
          </div>
        </div>
      </header>

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <main className="md:ml-[260px] p-4 md:p-6 flex justify-center">
        <div className="w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

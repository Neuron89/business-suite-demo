'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  // Close the drawer whenever we navigate
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onMenu={() => setMenuOpen((v) => !v)} />
      <div className="flex flex-1 relative">
        <Sidebar mobileOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
        <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

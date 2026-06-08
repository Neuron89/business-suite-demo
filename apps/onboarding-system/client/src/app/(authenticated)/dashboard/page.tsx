'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Placeholder dashboard. The IT-ticket-focused stats from the source
 * IT Request system don't apply to onboarding. Forwarding to the
 * onboarding list until we build a real onboarding dashboard.
 */
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding');
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-theme-muted">
      Redirecting to onboardings…
    </div>
  );
}

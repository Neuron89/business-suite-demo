'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function PublicDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    dashboardApi.getPublic().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <header className="border-b" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold text-lg">
              CT
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Complaint Tracker
            </h1>
          </div>
          <button
            onClick={() => router.push(user ? '/dashboard' : '/login')}
            className="btn-primary"
          >
            {user ? 'Go to Dashboard' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Complaint Statistics
        </h2>

        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Complaints" value={stats.total_complaints} color="blue" />
            {stats.by_status.map((s: any) => (
              <StatCard key={s.status} label={s.status.replace('_', ' ')} value={s.count} color="amber" />
            ))}
          </div>
        ) : (
          <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
            Loading statistics...
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>By Type</h3>
              {stats.by_type.length > 0 ? (
                <div className="space-y-2">
                  {stats.by_type.map((t: any) => (
                    <div key={t.type} className="flex justify-between">
                      <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{t.type}</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-tertiary)' }}>No complaints yet</p>
              )}
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>By Severity</h3>
              {stats.by_severity.length > 0 ? (
                <div className="space-y-2">
                  {stats.by_severity.map((s: any) => (
                    <div key={s.severity} className="flex justify-between">
                      <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{s.severity}</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-tertiary)' }}>No complaints yet</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm capitalize mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: `var(--${color === 'blue' ? 'info' : 'accent'})` }}>
        {value}
      </p>
    </div>
  );
}

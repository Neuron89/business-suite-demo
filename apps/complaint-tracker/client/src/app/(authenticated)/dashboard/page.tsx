'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardApi } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import SeverityBadge from '@/components/shared/SeverityBadge';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</div>;
  }

  if (!stats) {
    return <div style={{ color: 'var(--text-secondary)' }}>Failed to load dashboard</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
        <Link href="/complaints/new" className="btn-primary">
          + New Complaint
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total_complaints} color="var(--info)" />
        <StatCard label="Open" value={stats.open_complaints} color="var(--accent)" />
        <StatCard label="Under Review" value={stats.under_review} color="var(--warning)" />
        <StatCard label="Resolved" value={stats.resolved} color="var(--success)" />
        <StatCard label="Closed This Month" value={stats.closed_this_month} color="var(--text-tertiary)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Complaints */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>My Open Complaints</h2>
          {stats.my_complaints.length > 0 ? (
            <div className="space-y-3">
              {stats.my_complaints.map((c: any) => (
                <Link key={c.id} href={`/complaints/${c.id}`} className="block p-3 rounded-lg hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{c.complaint_number}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No open complaints assigned to you</p>
          )}
        </div>

        {/* Recent Complaints */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Complaints</h2>
          {stats.recent_complaints.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_complaints.slice(0, 5).map((c: any) => (
                <Link key={c.id} href={`/complaints/${c.id}`} className="block p-3 rounded-lg hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{c.complaint_number}</span>
                    <div className="flex gap-2">
                      <SeverityBadge severity={c.severity} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {c.customer_name} &middot; {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No complaints yet</p>
          )}
        </div>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DistributionCard title="By Status" items={stats.by_status.map((s: any) => ({ label: s.status.replace('_', ' '), count: s.count }))} />
        <DistributionCard title="By Type" items={stats.by_type.map((t: any) => ({ label: t.type, count: t.count }))} />
        <DistributionCard title="By Severity" items={stats.by_severity.map((s: any) => ({ label: s.severity, count: s.count }))} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function DistributionCard({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data</p>
      )}
    </div>
  );
}

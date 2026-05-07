'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPublicDashboard } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const STATUS_COLORS = [
  '#3b82f6', '#8b5cf6', '#22c55e', '#eab308', '#f97316',
  '#ef4444', '#06b6d4', '#14b8a6', '#6366f1', '#ec4899',
];

export default function PublicDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicDashboard()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="card text-center max-w-md">
          <h2 className="text-xl font-bold mb-2 text-theme-primary">MOC Dashboard</h2>
          <p className="mb-4 text-theme-muted">Unable to load dashboard data. The server may be starting up.</p>
          <p className="text-sm text-red-500">{error}</p>
          <Link href="/login" className="btn-accent mt-4 inline-block">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-theme-muted">Loading dashboard...</div>
      </div>
    );
  }

  const statusChartData = Object.entries(data.by_status || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    count: value as number,
  }));

  const riskChartData = Object.entries(data.by_risk_level || {}).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b bg-sidebar border-theme">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              MOC<span className="text-accent">System</span>
            </h1>
            <p className="text-sm mt-1 text-[#94a3b8]">Public Dashboard — Nylon Manufacturing Facility</p>
          </div>
          <Link href="/login" className="btn-accent">Staff Login</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card border-l-4 border-l-blue-500">
            <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Total MOC Requests</p>
            <p className="text-3xl font-extrabold mt-1 text-theme-primary">{data.total_mocs}</p>
          </div>
          <div className="card border-l-4 border-l-amber-500">
            <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Currently Open</p>
            <p className="text-3xl font-extrabold mt-1 text-accent">{data.open_mocs}</p>
          </div>
          <div className="card border-l-4 border-l-teal-500">
            <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Risk Assessments</p>
            <p className="text-3xl font-extrabold mt-1 text-theme-primary">
              {Object.values(data.by_risk_level || {}).reduce((a: number, b: any) => a + b, 0)}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted">MOCs by Status</h3>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} angle={-45} textAnchor="end" height={80} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-theme-faint">No data yet</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted">Risk Distribution</h3>
            {riskChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={riskChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {riskChartData.map((entry, i) => (
                      <Cell key={i} fill={RISK_COLORS[entry.name] || STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-theme-faint">No risk data yet</p>
            )}
          </div>
        </div>

        {/* Open MOCs Table */}
        <div className="card overflow-hidden !p-0">
          <div className="px-6 py-4 border-b border-theme-light flex justify-between items-center">
            <h3 className="text-sm font-bold text-theme-primary">Open MOC Requests</h3>
          </div>
          {(data.open_moc_list || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-table-head">
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">ID</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">Title</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">Created By</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.open_moc_list.map((moc: any) => (
                    <tr key={moc.id} className="border-b border-theme-light hover:bg-card-hover-surface transition-colors duration-150">
                      <td className="py-3 px-4 font-mono font-bold text-theme-muted">#{moc.id}</td>
                      <td className="py-3 px-4 font-semibold">{moc.title}</td>
                      <td className="py-3 px-4"><StatusBadge status={moc.status} /></td>
                      <td className="py-3 px-4 capitalize text-theme-muted">{moc.change_type?.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 text-theme-muted">{moc.creator_name}</td>
                      <td className="py-3 px-4 text-theme-faint">{new Date(moc.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-theme-faint">No open MOC requests</p>
          )}
        </div>

        {/* Recent Activity */}
        {(data.recent_activity || []).length > 0 && (
          <div className="card mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted">Recent Activity</h3>
            <div className="space-y-3">
              {data.recent_activity.map((entry: any) => (
                <div key={entry.id} className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full mr-3 flex-shrink-0 bg-accent" />
                  <span className="text-theme-secondary">
                    <span className="font-semibold text-theme-primary">{entry.changer_name}</span>
                    {' '}transitioned MOC #{entry.moc_id} from{' '}
                    <StatusBadge status={entry.from_status || 'new'} />
                    {' '}to{' '}
                    <StatusBadge status={entry.to_status} />
                  </span>
                  <span className="ml-auto text-xs flex-shrink-0 text-theme-faint">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

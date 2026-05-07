'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMocs } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function ReportsPage() {
  const { token } = useAuth();
  const [mocs, setMocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getMocs(token, { limit: '100' })
      .then((data) => setMocs(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading reports...</div>;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  let psmCount = 0;
  let emergencyCount = 0;

  for (const moc of mocs) {
    statusCounts[moc.status] = (statusCounts[moc.status] || 0) + 1;
    typeCounts[moc.change_type] = (typeCounts[moc.change_type] || 0) + 1;
    if (moc.is_psm_relevant) psmCount++;
    if (moc.emergency_change) emergencyCount++;
  }

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  function exportCSV() {
    const headers = ['ID', 'Title', 'Status', 'Type', 'PSM', 'Emergency', 'Created By', 'Created At'];
    const rows = mocs.map((m) => [
      m.id, `"${m.title}"`, m.status, m.change_type,
      m.is_psm_relevant ? 'Yes' : 'No', m.emergency_change ? 'Yes' : 'No',
      m.creator_name, m.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moc-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <button onClick={exportCSV} className="btn-primary">Export CSV</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total MOCs</p>
          <p className="text-2xl font-bold">{mocs.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Closed</p>
          <p className="text-2xl font-bold text-green-600">{statusCounts['closed'] || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">PSM Relevant</p>
          <p className="text-2xl font-bold text-red-600">{psmCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Emergency Changes</p>
          <p className="text-2xl font-bold text-orange-600">{emergencyCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">MOCs by Status</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={statusData} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" opacity={0.5} />
              <XAxis
                dataKey="name"
                fontSize={11}
                angle={-40}
                textAnchor="end"
                interval={0}
                tick={{ fill: 'var(--text-muted, #94a3b8)' }}
              />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">MOCs by Type</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Pie
                data={typeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                label={({ name, percent, x, y, textAnchor, index }) => {
                  const color = COLORS[index % COLORS.length];
                  const label = `${name} ${(percent * 100).toFixed(0)}%`;
                  const isLeft = textAnchor === 'end';
                  const boxW = 90;
                  const boxX = isLeft ? x - boxW - 2 : x + 2;
                  const boxY = y - 16;
                  return (
                    <foreignObject key={index} x={boxX} y={boxY} width={boxW} height={36}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        lineHeight: '1.2',
                        color,
                        textAlign: isLeft ? 'right' : 'left',
                        wordBreak: 'keep-all',
                        overflowWrap: 'normal',
                      }}>
                        {label}
                      </div>
                    </foreignObject>
                  );
                }}
                labelLine={{ strokeWidth: 1, stroke: 'var(--text-muted, #94a3b8)' }}
              >
                {typeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

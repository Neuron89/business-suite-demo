'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDashboard } from '@/lib/api';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// --- Inline SVG Icons ---

function FolderOpenIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function ExclamationCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function DocumentTextIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h4.5l1.5-6 3 12 1.5-6h4.5" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

export default function DashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    getDashboard(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!data) return <div className="text-theme-muted">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-theme-primary">Dashboard</h1>
          <p className="text-sm mt-0.5 text-theme-muted">Welcome back, {user?.name}</p>
        </div>
        <Link href="/moc/new" className="btn-accent">+ New MOC Request</Link>
      </div>

      {/* Stat Cards with Icons — clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/moc?exclude_status=closed,draft" className="card border-l-4 border-l-blue-500 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:shadow-card-dark-hover cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Open MOCs</p>
              <p className="text-2xl font-extrabold mt-1 text-theme-primary">{data.stats.open_mocs}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
              <FolderOpenIcon />
            </div>
          </div>
        </Link>
        <Link href="/moc?status=under_review" className="card border-l-4 border-l-amber-500 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:shadow-card-dark-hover cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Pending Reviews</p>
              <p className="text-2xl font-extrabold mt-1 text-accent">{data.stats.pending_review_count}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-500">
              <ClockIcon />
            </div>
          </div>
        </Link>
        <div className="card border-l-4 border-l-red-500 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:shadow-card-dark-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">My Action Items</p>
              <p className="text-2xl font-extrabold mt-1 text-red-600 dark:text-red-400">{data.stats.action_item_count ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row — clickable where applicable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/moc?status=closed" className="card flex items-center gap-4 cursor-pointer transition-all duration-250 hover:-translate-y-0.5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10 text-green-500">
            <CheckCircleIcon />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Closed This Month</p>
            <p className="text-xl font-extrabold text-theme-primary">{data.stats.closed_this_month ?? '—'}</p>
          </div>
        </Link>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
            <CalendarIcon />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-theme-muted">Avg. Days to Close</p>
            <p className="text-xl font-extrabold text-theme-primary">
              {data.stats.avg_days_to_close != null ? `${data.stats.avg_days_to_close} days` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      {(data.status_distribution?.length > 0 || data.type_distribution?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* MOCs by Status Bar Chart — clickable bars */}
          {data.status_distribution?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted">MOCs by Status</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={data.status_distribution}
                  layout="vertical"
                  margin={{ left: 20 }}
                  onClick={(state) => {
                    if (state?.activePayload?.[0]?.payload?.name) {
                      const rawStatus = state.activePayload[0].payload.name.replace(/ /g, '_');
                      router.push(`/moc?status=${rawStatus}`);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" opacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} className="cursor-pointer">
                    {data.status_distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Change Type Distribution Donut Chart — clickable slices */}
          {data.type_distribution?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted">Change Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={data.type_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    label={({ name, percent, x, y, textAnchor, index }) => {
                      const color = COLORS[index % COLORS.length];
                      const label = `${name} ${(percent * 100).toFixed(0)}%`;
                      const isLeft = textAnchor === 'end';
                      const boxW = 90;
                      const boxX = isLeft ? x - boxW - 2 : x + 2;
                      const boxY = y - 16;
                      return (
                        <foreignObject x={boxX} y={boxY} width={boxW} height={36}>
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
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const entry = data.type_distribution[index];
                      if (entry?.name) {
                        const rawType = entry.name.replace(/ /g, '_');
                        router.push(`/moc?change_type=${rawType}`);
                      }
                    }}
                  >
                    {data.type_distribution.map((_: any, i: number) => (
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
          )}
        </div>
      )}

      {/* My Action Items */}
      {data.my_action_items && data.my_action_items.length > 0 && (
        <div className="card mb-6 border-l-4 border-l-red-500">
          <Link href="/action-items" className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted flex items-center gap-2 hover:text-red-600 transition-colors">
            <span className="text-red-500"><ExclamationCircleIcon /></span>
            My Action Items ({data.my_action_items.length})
            <span className="text-xs font-normal text-theme-faint ml-auto">View all &rarr;</span>
          </Link>
          <div className="space-y-3">
            {data.my_action_items.map((item: any) => (
              <Link
                key={`${item.source}-${item.id}`}
                href={`/moc/${item.moc_id}?tab=action_items`}
                className="block p-3 rounded-[10px] border-2 border-red-200 dark:border-red-500/25 bg-red-500/[0.06] transition-all duration-200 hover:-translate-y-px"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.source === 'dsr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                        {item.source.toUpperCase()}
                      </span>
                      {item.source === 'pssr' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${item.action_type === 'post_startup' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                          {item.action_type === 'post_startup' ? 'Post' : 'Pre'}
                        </span>
                      )}
                      <span className="text-xs text-theme-faint">{item.moc_number}</span>
                    </div>
                    <p className="text-sm font-medium text-theme-primary truncate">{item.description}</p>
                    {item.notes && <p className="text-xs text-theme-muted mt-0.5 truncate italic">{item.notes}</p>}
                  </div>
                  <StatusBadge status={item.moc_status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reviews */}
        {data.pending_reviews.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted flex items-center gap-2">
              <span className="text-amber-500"><ExclamationCircleIcon /></span>
              Pending Your Review
            </h2>
            <div className="space-y-3">
              {data.pending_reviews.map((moc: any) => (
                <Link
                  key={moc.id}
                  href={`/moc/${moc.id}`}
                  className="block p-3 rounded-[10px] border-2 border-amber-200 dark:border-amber-500/25 bg-amber-500/[0.06] transition-all duration-200 hover:-translate-y-px"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-theme-primary">#{moc.id} {moc.title}</p>
                      <p className="text-sm capitalize text-theme-muted">{moc.change_type?.replace(/_/g, ' ')}</p>
                    </div>
                    <StatusBadge status={moc.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My MOCs */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted flex items-center gap-2">
            <span className="text-blue-500"><DocumentTextIcon /></span>
            My MOC Requests
          </h2>
          {data.my_mocs.length > 0 ? (
            <div className="space-y-3">
              {data.my_mocs.map((moc: any) => (
                <Link
                  key={moc.id}
                  href={`/moc/${moc.id}`}
                  className="block p-3 rounded-[10px] border-2 border-theme transition-all duration-200 hover:-translate-y-px"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-theme-primary">#{moc.id} {moc.title}</p>
                      <p className="text-sm text-theme-faint">{new Date(moc.updated_at).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={moc.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-theme-faint">No active MOC requests</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4 text-theme-muted flex items-center gap-2">
            <span className="text-accent"><ActivityIcon /></span>
            Recent Activity
          </h2>
          {data.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {data.recent_activity.map((entry: any) => (
                <div key={entry.id} className="flex items-center text-sm pb-3 border-b border-theme-light last:border-0">
                  <div className="w-2 h-2 rounded-full mr-3 flex-shrink-0 bg-accent" />
                  <div className="flex-1 min-w-0 text-theme-secondary">
                    <span className="font-semibold text-theme-primary">{entry.changer_name}</span>
                    {' '}moved{' '}
                    <Link href={`/moc/${entry.moc_id}`} className="font-semibold text-accent hover:underline">
                      {entry.moc_title || `MOC #${entry.moc_id}`}
                    </Link>
                    {' '}to <StatusBadge status={entry.to_status} />
                    {entry.comment && <span className="text-theme-faint ml-2">— {entry.comment}</span>}
                  </div>
                  <span className="text-xs ml-4 flex-shrink-0 text-theme-faint">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-theme-faint">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

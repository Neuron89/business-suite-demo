'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTheme } from '@/lib/theme-context';

const AMBER = ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const NAVY = ['#0a1929', '#1e3a5f', '#2c4a7a', '#4a6fa5', '#7a9acc'];
const MIXED = ['#d97706', '#2c4a7a', '#f59e0b', '#4a6fa5', '#fbbf24', '#7a9acc', '#fcd34d', '#0a1929'];

function useAxisColor() {
  const { theme } = useTheme();
  return theme === 'dark' ? '#a3b4cc' : '#64748b';
}

function useGridColor() {
  const { theme } = useTheme();
  return theme === 'dark' ? '#1e3a5f' : '#e2e8f0';
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtCompactLbs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function DailyCostChart({
  data,
}: {
  data: { date: string; total_cost: number; shipments: number }[];
}) {
  const axisColor = useAxisColor();
  const gridColor = useGridColor();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fill: axisColor, fontSize: 11 }}
          tickFormatter={(s: string) => s.slice(5)}
        />
        <YAxis
          tick={{ fill: axisColor, fontSize: 11 }}
          tickFormatter={fmtMoney}
          width={56}
        />
        <Tooltip
          formatter={(v) => fmtMoney(Number(v))}
          labelClassName="text-xs"
          contentStyle={{ background: 'rgba(15,23,42,0.92)', border: 'none', color: '#fff' }}
        />
        <Area
          type="monotone"
          dataKey="total_cost"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#costGrad)"
          name="Cost"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyCostChart({
  data,
}: {
  data: { month: string; total_cost: number; total_lbs: number }[];
}) {
  const axisColor = useAxisColor();
  const gridColor = useGridColor();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} />
        <YAxis
          tick={{ fill: axisColor, fontSize: 11 }}
          tickFormatter={fmtMoney}
          width={56}
        />
        <Tooltip
          formatter={(v) => fmtMoney(Number(v))}
          contentStyle={{ background: 'rgba(15,23,42,0.92)', border: 'none', color: '#fff' }}
        />
        <Bar dataKey="total_cost" fill="#d97706" radius={[4, 4, 0, 0]} name="Cost" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopStatesBar({
  data,
}: {
  data: { state: string; shipments: number; total_cost: number }[];
}) {
  const axisColor = useAxisColor();
  const gridColor = useGridColor();
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 12, bottom: 6 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="state"
          tick={{ fill: axisColor, fontSize: 11 }}
          width={110}
        />
        <Tooltip
          formatter={(v) => `${v} shipments`}
          contentStyle={{ background: 'rgba(15,23,42,0.92)', border: 'none', color: '#fff' }}
        />
        <Bar dataKey="shipments" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModePie({
  data,
}: {
  data: { mode: string; shipments: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="shipments"
          nameKey="mode"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={MIXED[i % MIXED.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n) => [`${v} shipments`, n]}
          contentStyle={{ background: 'rgba(15,23,42,0.92)', border: 'none', color: '#fff' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FuelTrendChart({
  data,
}: {
  data: { week_start: string; diesel_price: number | null; surcharge_pct: number | null }[];
}) {
  const axisColor = useAxisColor();
  const gridColor = useGridColor();
  // Display chronological (API returns desc).
  const rows = [...data]
    .reverse()
    .map((r) => ({
      week: r.week_start.slice(5),
      diesel: r.diesel_price == null ? null : Number(r.diesel_price),
      fsc: r.surcharge_pct == null ? null : Number(r.surcharge_pct) * 100,
    }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="week" tick={{ fill: axisColor, fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fill: axisColor, fontSize: 11 }}
          tickFormatter={(v) => `$${v.toFixed(2)}`}
          domain={['dataMin - 0.1', 'dataMax + 0.1']}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: axisColor, fontSize: 11 }}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(15,23,42,0.92)', border: 'none', color: '#fff' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="diesel"
          stroke="#d97706"
          strokeWidth={2}
          name="Diesel $/gal"
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="fsc"
          stroke="#4a6fa5"
          strokeWidth={2}
          name="FSC %"
          strokeDasharray="4 2"
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

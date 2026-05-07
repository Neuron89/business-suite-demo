'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { ScopeParameter } from '@moc/shared';

interface Props {
  baseline: ScopeParameter[];
  postChange: ScopeParameter[];
}

function formatDelta(baseline: number | null, postChange: number | null): string {
  if (baseline == null || postChange == null) return '-';
  const delta = postChange - baseline;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${Number.isInteger(delta) ? delta : delta.toFixed(2)}`;
}

function formatPctChange(baseline: number | null, postChange: number | null): string {
  if (baseline == null || postChange == null) return '-';
  if (baseline === 0) return postChange === 0 ? '0%' : 'N/A';
  const pct = ((postChange - baseline) / Math.abs(baseline)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function getDeltaColor(baseline: number | null, postChange: number | null): string {
  if (baseline == null || postChange == null) return 'text-gray-400';
  if (postChange > baseline) return 'text-green-600 dark:text-green-400';
  if (postChange < baseline) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}

export default function ScopeComparisonView({ baseline, postChange }: Props) {
  const chartData = baseline.map((bp, i) => {
    const pp = postChange[i];
    return {
      name: bp.name,
      unit: bp.unit,
      Baseline: bp.value,
      'Expected': pp?.value ?? null,
    };
  });

  const anyPostChange = postChange.some((p) => p.value != null);

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Improvement Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Parameter</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Unit</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Baseline</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Expected</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Delta</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">% Change</th>
              </tr>
            </thead>
            <tbody>
              {baseline.map((bp, i) => {
                const pp = postChange[i];
                const deltaColor = getDeltaColor(bp.value, pp?.value ?? null);
                const postFilled = pp?.value != null;
                return (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-200">{bp.name}</td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">{bp.unit}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-200">
                      {bp.value != null ? bp.value : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {postFilled ? (
                        <span className="text-gray-700 dark:text-gray-200">{pp.value}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">pending</span>
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${deltaColor}`}>
                      {formatDelta(bp.value, pp?.value ?? null)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${deltaColor}`}>
                      {formatPctChange(bp.value, pp?.value ?? null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar Chart */}
      {anyPostChange && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Visual Comparison</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Note: Parameters with different units are shown on a shared axis for visual comparison only.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: string, props: any) => {
                    if (value == null) return ['pending', name];
                    return [`${value} ${props.payload.unit || ''}`, name];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend />
                <Bar dataKey="Baseline" fill="#6b7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expected" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => {
                    const bp = baseline[index]?.value;
                    const pp = postChange[index]?.value;
                    let color = '#3b82f6'; // blue default
                    if (bp != null && pp != null) {
                      color = pp > bp ? '#16a34a' : pp < bp ? '#dc2626' : '#6b7280';
                    }
                    return <Cell key={index} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

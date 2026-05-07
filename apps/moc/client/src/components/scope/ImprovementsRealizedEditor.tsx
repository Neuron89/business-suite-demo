'use client';

import type { ScopeParameter } from '@moc/shared';

interface Props {
  baseline: ScopeParameter[];
  postChange: ScopeParameter[];
  realized: ScopeParameter[];
  onChange: (params: ScopeParameter[]) => void;
}

function formatDelta(from: number | null, to: number | null): string {
  if (from == null || to == null) return '-';
  const d = to - from;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

function formatPct(from: number | null, to: number | null): string {
  if (from == null || to == null) return '-';
  if (from === 0) return to === 0 ? '0%' : 'N/A';
  const pct = ((to - from) / Math.abs(from)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function getDeltaColor(baseline: number | null, realized: number | null, expected: number | null): string {
  if (baseline == null || realized == null) return 'text-gray-400';
  if (expected != null) {
    // Green if met or exceeded expected improvement direction
    const expectedDelta = expected - baseline;
    const realizedDelta = realized - baseline;
    if (expectedDelta >= 0 && realizedDelta >= expectedDelta) return 'text-green-600 dark:text-green-400';
    if (expectedDelta < 0 && realizedDelta <= expectedDelta) return 'text-green-600 dark:text-green-400';
  }
  if (realized > baseline) return 'text-amber-600 dark:text-amber-400';
  if (realized < baseline) return 'text-amber-600 dark:text-amber-400';
  return 'text-gray-500';
}

export default function ImprovementsRealizedEditor({ baseline, postChange, realized, onChange }: Props) {
  function updateValue(index: number, value: number | null) {
    const updated = [...realized];
    updated[index] = { ...updated[index], value };
    onChange(updated);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Improvements Realized</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Enter the actual realized values to validate that expected improvements came to fruition.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Parameter</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Baseline</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Expected</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Realized</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Unit</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Delta vs Baseline</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">% Change</th>
            </tr>
          </thead>
          <tbody>
            {realized.map((param, i) => {
              const bp = baseline[i];
              const ep = postChange[i];
              const color = getDeltaColor(bp?.value ?? null, param.value, ep?.value ?? null);
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{param.name}</td>
                  <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                    {bp?.value != null ? bp.value : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                    {ep?.value != null ? ep.value : '-'}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={param.value ?? ''}
                      onChange={(e) => updateValue(i, e.target.value ? Number(e.target.value) : null)}
                      className="input-field text-sm py-1 w-32"
                      placeholder="Enter value"
                      step="any"
                    />
                  </td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{param.unit}</td>
                  <td className={`py-2 px-3 text-right font-mono font-medium ${color}`}>
                    {formatDelta(bp?.value ?? null, param.value)}
                  </td>
                  <td className={`py-2 px-3 text-right font-mono font-medium ${color}`}>
                    {formatPct(bp?.value ?? null, param.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

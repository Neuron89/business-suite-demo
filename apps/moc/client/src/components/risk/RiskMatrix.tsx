'use client';

import { getRiskLevel, SEVERITY_LABELS, LIKELIHOOD_LABELS } from '@moc/shared';

const RISK_CELL_COLORS: Record<string, string> = {
  low: 'bg-green-100 border-green-300',
  medium: 'bg-yellow-100 border-yellow-300',
  high: 'bg-orange-100 border-orange-300',
  critical: 'bg-red-100 border-red-300',
};

interface Assessment {
  id: number;
  severity_before: number;
  likelihood_before: number;
  severity_after: number;
  likelihood_after: number;
  hazard_description: string;
}

export default function RiskMatrix({ assessments }: { assessments: Assessment[] }) {
  // Count dots per cell (before and after)
  const beforeDots: Record<string, number> = {};
  const afterDots: Record<string, number> = {};

  for (const a of assessments) {
    const bKey = `${a.severity_before}-${a.likelihood_before}`;
    beforeDots[bKey] = (beforeDots[bKey] || 0) + 1;
    const aKey = `${a.severity_after}-${a.likelihood_after}`;
    afterDots[aKey] = (afterDots[aKey] || 0) + 1;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Before Controls</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> After Controls</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {[1, 2, 3, 4, 5].map((s) => (
                <th key={s} className="p-1 text-center font-medium text-gray-600 dark:text-gray-300">
                  {s}<br /><span className="text-gray-400 dark:text-gray-500 font-normal">{SEVERITY_LABELS[s]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((l) => (
              <tr key={l}>
                <td className="p-1 text-right font-medium text-gray-600 dark:text-gray-300 pr-2 whitespace-nowrap">
                  {l} <span className="text-gray-400 dark:text-gray-500 font-normal">{LIKELIHOOD_LABELS[l]}</span>
                </td>
                {[1, 2, 3, 4, 5].map((s) => {
                  const risk = getRiskLevel(s, l);
                  const cellKey = `${s}-${l}`;
                  const bCount = beforeDots[cellKey] || 0;
                  const aCount = afterDots[cellKey] || 0;

                  return (
                    <td key={s} className={`p-2 border ${RISK_CELL_COLORS[risk]} text-center relative`} style={{ minWidth: '60px', height: '50px' }}>
                      <span className="text-gray-500 font-mono">{s * l}</span>
                      {(bCount > 0 || aCount > 0) && (
                        <div className="flex justify-center gap-1 mt-1">
                          {bCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center" title={`${bCount} before`}>
                              {bCount}
                            </span>
                          )}
                          {aCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center" title={`${aCount} after`}>
                              {aCount}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>&#8593; Likelihood</span>
          <span>Severity &#8594;</span>
        </div>
      </div>
    </div>
  );
}

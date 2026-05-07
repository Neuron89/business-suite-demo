'use client';

import type { ScopeParameter } from '@moc/shared';

interface Props {
  baseline: ScopeParameter[];
  postChange: ScopeParameter[];
  onChange: (params: ScopeParameter[]) => void;
}

export default function ScopePostChangeEditor({ baseline, postChange, onChange }: Props) {
  function updateValue(index: number, value: number | null) {
    const updated = [...postChange];
    updated[index] = { ...updated[index], value };
    onChange(updated);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Expected Improvement Values</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Enter the expected improvement values for each metric after the change is implemented.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Parameter</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Baseline Value</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Post-Change Value</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Unit</th>
            </tr>
          </thead>
          <tbody>
            {postChange.map((param, i) => {
              const baselineParam = baseline[i];
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{param.name}</td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                    {baselineParam?.value != null ? baselineParam.value : '-'}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

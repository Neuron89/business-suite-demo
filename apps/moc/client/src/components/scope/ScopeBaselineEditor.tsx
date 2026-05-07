'use client';

import type { ScopeParameter } from '@moc/shared';

interface Props {
  parameters: ScopeParameter[];
  onChange: (params: ScopeParameter[]) => void;
}

const PRESETS = [
  { name: 'FPQ (First Pass Quality)', unit: '%' },
  { name: 'Yield Improvement', unit: '%' },
  { name: 'Cost Savings (One-time)', unit: '$' },
  { name: 'Cost Savings (Recurring)', unit: '$/year' },
  { name: 'Reduced Waste', unit: 'lbs' },
  { name: 'Hours per Batch', unit: 'hrs' },
  { name: 'Throughput', unit: 'units/hr' },
  { name: 'Downtime Reduction', unit: 'hrs/month' },
  { name: 'Energy Savings', unit: '$/year' },
  { name: 'Defect Rate', unit: '%' },
];

export default function ScopeBaselineEditor({ parameters, onChange }: Props) {
  function addRow() {
    onChange([...parameters, { name: '', value: null, unit: '' }]);
  }

  function addPreset(preset: { name: string; unit: string }) {
    if (parameters.some((p) => p.name === preset.name)) return;
    onChange([...parameters, { name: preset.name, value: null, unit: preset.unit }]);
  }

  function updateRow(index: number, field: keyof ScopeParameter, value: string | number | null) {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  function removeRow(index: number) {
    onChange(parameters.filter((_, i) => i !== index));
  }

  const usedNames = new Set(parameters.map((p) => p.name));
  const availablePresets = PRESETS.filter((p) => !usedNames.has(p.name));

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Improvement Expected — Baseline Parameters</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Define the current baseline values for key improvement metrics. These will be compared against expected and realized improvement values.
      </p>

      {availablePresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Quick add:</span>
          {availablePresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addPreset(preset)}
              className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      )}

      {parameters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Parameter Name</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Value</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Unit</th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((param, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => updateRow(i, 'name', e.target.value)}
                      className="input-field text-sm py-1"
                      placeholder="e.g. Output"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={param.value ?? ''}
                      onChange={(e) => updateRow(i, 'value', e.target.value ? Number(e.target.value) : null)}
                      className="input-field text-sm py-1"
                      placeholder="0"
                      step="any"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={param.unit}
                      onChange={(e) => updateRow(i, 'unit', e.target.value)}
                      className="input-field text-sm py-1"
                      placeholder="e.g. lbs/hr"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Remove parameter"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
      >
        + Add Parameter
      </button>
    </div>
  );
}

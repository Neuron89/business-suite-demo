'use client';

import { useState } from 'react';
import type { ScopeParameter } from '@moc/shared';

const PRESETS: { name: string; unit: string }[] = [
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

function getDeltaColor(baseline: number | null, value: number | null): string {
  if (baseline == null || value == null) return 'text-gray-400';
  if (value > baseline) return 'text-green-600 dark:text-green-400';
  if (value < baseline) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}

type Tab = 'baseline' | 'post_change' | 'report';

export default function ScopeValidationTestPage() {
  const [activeTab, setActiveTab] = useState<Tab>('baseline');
  const [baseline, setBaseline] = useState<ScopeParameter[]>([]);
  const [postChange, setPostChange] = useState<ScopeParameter[]>([]);

  function addRow() {
    const newParam: ScopeParameter = { name: '', value: null, unit: '' };
    setBaseline([...baseline, newParam]);
    setPostChange([...postChange, { ...newParam }]);
  }

  function addPreset(preset: { name: string; unit: string }) {
    if (baseline.some((p) => p.name === preset.name)) return;
    setBaseline([...baseline, { name: preset.name, value: null, unit: preset.unit }]);
    setPostChange([...postChange, { name: preset.name, value: null, unit: preset.unit }]);
  }

  function updateBaseline(index: number, field: keyof ScopeParameter, value: string | number | null) {
    const updated = [...baseline];
    updated[index] = { ...updated[index], [field]: value };
    setBaseline(updated);
    // Sync name/unit to postChange
    if (field === 'name' || field === 'unit') {
      const updatedPost = [...postChange];
      updatedPost[index] = { ...updatedPost[index], [field]: value };
      setPostChange(updatedPost);
    }
  }

  function updatePostChangeValue(index: number, value: number | null) {
    const updated = [...postChange];
    updated[index] = { ...updated[index], value };
    setPostChange(updated);
  }

  function removeRow(index: number) {
    setBaseline(baseline.filter((_, i) => i !== index));
    setPostChange(postChange.filter((_, i) => i !== index));
  }

  const usedNames = new Set(baseline.map((p) => p.name));
  const availablePresets = PRESETS.filter((p) => !usedNames.has(p.name));
  const anyPostChange = postChange.some((p) => p.value != null);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'baseline', label: 'Baseline Setup' },
    { key: 'post_change', label: 'Post-Change Values' },
    { key: 'report', label: 'Comparison Report' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Scope Validation — Test Mode</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Test the scope validation workflow: define baseline parameters, enter post-change expected values, then view the comparison report.
      </p>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Baseline Tab */}
      {activeTab === 'baseline' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Improvement Expected — Baseline Parameters</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Define the current baseline values for key improvement metrics.
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

          {baseline.length > 0 && (
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
                  {baseline.map((param, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => updateBaseline(i, 'name', e.target.value)}
                          className="input-field text-sm py-1"
                          placeholder="e.g. Output"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={param.value ?? ''}
                          onChange={(e) => updateBaseline(i, 'value', e.target.value ? Number(e.target.value) : null)}
                          className="input-field text-sm py-1"
                          placeholder="0"
                          step="any"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={param.unit}
                          onChange={(e) => updateBaseline(i, 'unit', e.target.value)}
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

          {baseline.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setActiveTab('post_change')}
                className="btn-primary"
              >
                Next: Post-Change Values
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post-Change Tab */}
      {activeTab === 'post_change' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Expected Improvement Values</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Enter the expected improvement values for each metric after the change is implemented.
          </p>

          {baseline.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-3">No baseline parameters defined yet.</p>
              <button onClick={() => setActiveTab('baseline')} className="btn-primary text-sm">Go to Baseline Setup</button>
            </div>
          ) : (
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
                        <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{param.name || `Parameter ${i + 1}`}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                          {baselineParam?.value != null ? baselineParam.value : '-'}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={param.value ?? ''}
                            onChange={(e) => updatePostChangeValue(i, e.target.value ? Number(e.target.value) : null)}
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
          )}

          {baseline.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setActiveTab('report')}
                className="btn-primary"
              >
                View Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {baseline.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-3">No data to display. Set up baseline parameters first.</p>
              <button onClick={() => setActiveTab('baseline')} className="btn-primary text-sm">Go to Baseline Setup</button>
            </div>
          ) : (
            <>
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
                            <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-200">{bp.name || `Parameter ${i + 1}`}</td>
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
                              {formatPct(bp.value, pp?.value ?? null)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              {anyPostChange && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Parameters Defined</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{baseline.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Improved (Expected)</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {baseline.filter((bp, i) => {
                          const pp = postChange[i];
                          return bp.value != null && pp?.value != null && pp.value > bp.value;
                        }).length}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Declined (Expected)</p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {baseline.filter((bp, i) => {
                          const pp = postChange[i];
                          return bp.value != null && pp?.value != null && pp.value < bp.value;
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

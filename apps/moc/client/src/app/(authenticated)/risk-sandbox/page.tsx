'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import CrfRiskQuestionnaire from '@/components/crf/CrfRiskQuestionnaire';
import {
  CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS,
  CRF_HAZARD_QUESTION_LABELS,
  CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS,
  CRF_SIGNIFICANCE_QUESTION_LABELS,
  CRF_RISK_LEVEL_LABELS, CRF_RISK_LEVEL_COLORS, CRF_RISK_LEVELS,
  calculateCrfRiskLevel, getCrfRiskReason, getCrfRiskDescription,
  getCrfChangeCategory, CRF_REVIEWS_REQUIRED, CRF_CHANGE_TYPES, CRF_CHANGE_TYPE_LABELS,
} from '@moc/shared';
import type { CrfRiskAnswers, CrfChangeType } from '@moc/shared';

function makeEmptyAnswers(): CrfRiskAnswers {
  const falseMap = (keys: readonly string[]) =>
    Object.fromEntries(keys.map((k) => [k, false]));
  return {
    hazard_l1: falseMap(CRF_HAZARD_L1_QUESTIONS),
    hazard_l2: falseMap(CRF_HAZARD_L2_QUESTIONS),
    significance_l0: falseMap(CRF_SIGNIFICANCE_L0_QUESTIONS),
    significance_l1: falseMap(CRF_SIGNIFICANCE_L1_QUESTIONS),
    significance_l2: falseMap(CRF_SIGNIFICANCE_L2_QUESTIONS),
  };
}

// Decision tree rules in order
const DECISION_RULES = [
  { id: 'R1', label: 'No "Yes" answers at all', test: (h1: number, h2: number, s0: number, s1: number, s2: number) => h1 + h2 + s0 + s1 + s2 === 0, result: '---' },
  { id: 'R2', label: 'Only training needed (Significance L0 only)', test: (_h1: number, h2: number, s0: number, s1: number, s2: number, h1: number) => h1 === 0 && h2 === 0 && s1 === 0 && s2 === 0 && s0 >= 1, result: 'L0' },
  { id: 'R3a', label: 'Hazard L2 >= 1 AND Significance L2 >= 1', test: (_h1: number, h2: number, _s0: number, _s1: number, s2: number) => h2 >= 1 && s2 >= 1, result: 'L3' },
  { id: 'R3b', label: 'Hazard L2 >= 1 (safety procedure conflict)', test: (_h1: number, h2: number) => h2 >= 1, result: 'L2' },
  { id: 'R4a', label: 'Hazard L1 >= 2 AND Significance L2 >= 1', test: (h1: number, _h2: number, _s0: number, _s1: number, s2: number) => h1 >= 2 && s2 >= 1, result: 'L3' },
  { id: 'R4b', label: 'Hazard L1 >= 2 (multiple hazard concerns)', test: (h1: number) => h1 >= 2, result: 'L2' },
  { id: 'R5', label: 'Any Significance L2 >= 1 (major process changes)', test: (_h1: number, _h2: number, _s0: number, _s1: number, s2: number) => s2 >= 1, result: 'L2' },
  { id: 'R6', label: 'Single Hazard L1 = 1', test: (h1: number) => h1 === 1, result: 'L1' },
  { id: 'R7', label: 'Any Significance L1 >= 1', test: (_h1: number, _h2: number, _s0: number, s1: number) => s1 >= 1, result: 'L1' },
] as const;

// Risk matrix cell definitions (severity x likelihood style mapping to risk levels)
const RISK_MATRIX: { hazard: string; sig: string; level: string; color: string }[][] = [
  // Each row = hazard level (None, L1x1, L1x2+, L2), each col = significance level (None, L0 only, L1, L2)
  [
    { hazard: 'None', sig: 'None', level: '---', color: CRF_RISK_LEVEL_COLORS['---'] },
    { hazard: 'None', sig: 'L0 only', level: 'L0', color: CRF_RISK_LEVEL_COLORS['L0'] },
    { hazard: 'None', sig: 'L1', level: 'L1', color: CRF_RISK_LEVEL_COLORS['L1'] },
    { hazard: 'None', sig: 'L2', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
  ],
  [
    { hazard: '1x L1', sig: 'None', level: 'L1', color: CRF_RISK_LEVEL_COLORS['L1'] },
    { hazard: '1x L1', sig: 'L0 only', level: 'L1', color: CRF_RISK_LEVEL_COLORS['L1'] },
    { hazard: '1x L1', sig: 'L1', level: 'L1', color: CRF_RISK_LEVEL_COLORS['L1'] },
    { hazard: '1x L1', sig: 'L2', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
  ],
  [
    { hazard: '2+ L1', sig: 'None', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: '2+ L1', sig: 'L0 only', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: '2+ L1', sig: 'L1', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: '2+ L1', sig: 'L2', level: 'L3', color: CRF_RISK_LEVEL_COLORS['L3'] },
  ],
  [
    { hazard: 'L2', sig: 'None', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: 'L2', sig: 'L0 only', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: 'L2', sig: 'L1', level: 'L2', color: CRF_RISK_LEVEL_COLORS['L2'] },
    { hazard: 'L2', sig: 'L2', level: 'L3', color: CRF_RISK_LEVEL_COLORS['L3'] },
  ],
];

function getMatrixPosition(h1: number, h2: number, s0: number, s1: number, s2: number): { row: number; col: number } {
  // Row: hazard level
  let row = 0;
  if (h2 >= 1) row = 3;
  else if (h1 >= 2) row = 2;
  else if (h1 === 1) row = 1;

  // Col: significance level
  let col = 0;
  if (s2 >= 1) col = 3;
  else if (s1 >= 1) col = 2;
  else if (s0 >= 1) col = 1;

  return { row, col };
}

export default function RiskSandboxPage() {
  const { token } = useAuth();
  const [answers, setAnswers] = useState<CrfRiskAnswers>(makeEmptyAnswers());
  const [changeType, setChangeType] = useState<CrfChangeType>('process');

  const countYeses = (group: Record<string, boolean | null>, keys: readonly string[]) =>
    keys.reduce((n, k) => n + (group[k] ? 1 : 0), 0);

  const counts = useMemo(() => ({
    hazardL1: countYeses(answers.hazard_l1, CRF_HAZARD_L1_QUESTIONS),
    hazardL2: countYeses(answers.hazard_l2, CRF_HAZARD_L2_QUESTIONS),
    sigL0: countYeses(answers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS),
    sigL1: countYeses(answers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS),
    sigL2: countYeses(answers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS),
  }), [answers]);

  const riskLevel = useMemo(
    () => calculateCrfRiskLevel(counts.hazardL1, counts.hazardL2, counts.sigL0, counts.sigL1, counts.sigL2),
    [counts],
  );

  const reason = useMemo(
    () => getCrfRiskReason(counts.hazardL1, counts.hazardL2, counts.sigL0, counts.sigL1, counts.sigL2),
    [counts],
  );

  const category = getCrfChangeCategory(changeType);
  const reviewsRequired = CRF_REVIEWS_REQUIRED[riskLevel]?.[category] || [];

  const matrixPos = getMatrixPosition(counts.hazardL1, counts.hazardL2, counts.sigL0, counts.sigL1, counts.sigL2);

  // Collect "Yes" question labels per group
  const yesQuestions = useMemo(() => {
    const collect = (group: Record<string, boolean | null>, keys: readonly string[], labels: Record<string, string>) =>
      keys.filter((k) => group[k]).map((k) => labels[k] || k);
    return {
      hazardL1: collect(answers.hazard_l1, CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_QUESTION_LABELS),
      hazardL2: collect(answers.hazard_l2, CRF_HAZARD_L2_QUESTIONS, CRF_HAZARD_QUESTION_LABELS),
      sigL0: collect(answers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_QUESTION_LABELS),
      sigL1: collect(answers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_QUESTION_LABELS),
      sigL2: collect(answers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS, CRF_SIGNIFICANCE_QUESTION_LABELS),
    };
  }, [answers]);

  // Decision tree trace
  const decisionTrace = useMemo(() => {
    const { hazardL1: h1, hazardL2: h2, sigL0: s0, sigL1: s1, sigL2: s2 } = counts;
    const trace: { id: string; label: string; triggered: boolean; result: string }[] = [];
    let found = false;
    for (const rule of DECISION_RULES) {
      const triggered = !found && rule.test(h1, h2, s0, s1, s2, h1);
      trace.push({ id: rule.id, label: rule.label, triggered, result: rule.result });
      if (triggered) found = true;
    }
    return trace;
  }, [counts]);

  if (!token) {
    return <div className="text-gray-500 text-center py-12">Checking authentication...</div>;
  }

  const SIG_COL_HEADERS = ['None', 'L0 only', 'L1', 'L2'];
  const HAZ_ROW_HEADERS = ['None', '1x L1', '2+ L1', 'L2'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Risk Assessment Sandbox</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Interactive CRF risk questionnaire with verbose calculation output. Changes here do not affect any MOC.
          </p>
        </div>
        <button
          onClick={() => setAnswers(makeEmptyAnswers())}
          className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* Questionnaire */}
      <CrfRiskQuestionnaire answers={answers} onChange={setAnswers} changeType={changeType} />

      {/* Verbose Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Yes Count Summary */}
        <div className="card p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Yes Count Summary</h2>
          <div className="space-y-3">
            {[
              { label: 'Hazard L1', count: counts.hazardL1, total: CRF_HAZARD_L1_QUESTIONS.length, items: yesQuestions.hazardL1 },
              { label: 'Hazard L2', count: counts.hazardL2, total: CRF_HAZARD_L2_QUESTIONS.length, items: yesQuestions.hazardL2 },
              { label: 'Significance L0', count: counts.sigL0, total: CRF_SIGNIFICANCE_L0_QUESTIONS.length, items: yesQuestions.sigL0 },
              { label: 'Significance L1', count: counts.sigL1, total: CRF_SIGNIFICANCE_L1_QUESTIONS.length, items: yesQuestions.sigL1 },
              { label: 'Significance L2', count: counts.sigL2, total: CRF_SIGNIFICANCE_L2_QUESTIONS.length, items: yesQuestions.sigL2 },
            ].map((g) => (
              <div key={g.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{g.label}</span>
                  <span className={`text-sm font-bold ${g.count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                    {g.count} / {g.total}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${g.total > 0 ? (g.count / g.total) * 100 : 0}%`,
                      backgroundColor: g.count > 0 ? '#ef4444' : '#9ca3af',
                    }}
                  />
                </div>
                {g.items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {g.items.map((q, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400 pl-3 border-l-2 border-red-300 dark:border-red-600">
                        {q}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Decision Tree Trace */}
        <div className="card p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Decision Tree Trace</h2>
          <div className="space-y-2">
            {decisionTrace.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg text-sm transition-colors ${
                  step.triggered
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700'
                    : 'bg-gray-50 dark:bg-gray-900'
                }`}
              >
                <span className={`flex-shrink-0 font-mono text-xs px-1.5 py-0.5 rounded ${
                  step.triggered
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {step.id}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={step.triggered ? 'text-amber-800 dark:text-amber-200 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                    {step.label}
                  </span>
                </div>
                <span className="flex-shrink-0">
                  {step.triggered ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[step.result as keyof typeof CRF_RISK_LEVEL_COLORS] || '#9ca3af' }}>
                      TRIGGERED: {step.result}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">--</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Final Result */}
          <div className="mt-6 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Final Risk Level:</span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[riskLevel] }}
              >
                {riskLevel} &mdash; {getCrfRiskDescription(riskLevel, answers)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reason: {reason}</p>
          </div>
        </div>

        {/* Reviews Required */}
        <div className="card p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Reviews Required</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Change Type</label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as CrfChangeType)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {CRF_CHANGE_TYPES.map((ct) => (
                <option key={ct} value={ct}>{CRF_CHANGE_TYPE_LABELS[ct]}</option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 mb-4">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Category: <span className="text-gray-700 dark:text-gray-200">{category === 'procedure_staffing' ? 'Procedure / Staffing' : 'Chemical / Equipment / Tech.'}</span>
            </span>
          </div>

          {reviewsRequired.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {reviewsRequired.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No reviews required at this risk level.</p>
          )}

          {/* Full matrix table */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">All Risk Levels &times; Categories</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1.5 px-2 text-left text-gray-500">Level</th>
                    <th className="py-1.5 px-2 text-left text-gray-500">Proc. / Staff</th>
                    <th className="py-1.5 px-2 text-left text-gray-500">Chem. / Equip. / Tech.</th>
                  </tr>
                </thead>
                <tbody>
                  {CRF_RISK_LEVELS.map((lvl) => (
                    <tr
                      key={lvl}
                      className={`border-b border-gray-100 dark:border-gray-800 ${lvl === riskLevel ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                    >
                      <td className="py-1.5 px-2 font-medium" style={{ color: CRF_RISK_LEVEL_COLORS[lvl] }}>{lvl}</td>
                      <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                        {CRF_REVIEWS_REQUIRED[lvl]?.procedure_staffing?.join(', ') || 'None'}
                      </td>
                      <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                        {CRF_REVIEWS_REQUIRED[lvl]?.chemical_equipment_tech?.join(', ') || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Risk Matrix Visual */}
        <div className="card p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Risk Matrix Visual</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Hazard level (rows) vs. Significance level (columns). Your current position is highlighted.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-xs text-gray-500 dark:text-gray-400 text-left border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    Hazard \ Significance
                  </th>
                  {SIG_COL_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="p-2 text-xs font-medium text-gray-600 dark:text-gray-300 text-center border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISK_MATRIX.map((row, ri) => (
                  <tr key={ri}>
                    <td className="p-2 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      {HAZ_ROW_HEADERS[ri]}
                    </td>
                    {row.map((cell, ci) => {
                      const isActive = ri === matrixPos.row && ci === matrixPos.col;
                      return (
                        <td
                          key={ci}
                          className={`p-2 text-center border-2 transition-all duration-300 ${
                            isActive
                              ? 'border-gray-900 dark:border-white ring-2 ring-amber-400 scale-105 z-10 relative'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          style={{
                            backgroundColor: cell.color + (isActive ? '' : '30'),
                          }}
                        >
                          <span
                            className={`text-sm font-bold ${isActive ? 'text-white' : ''}`}
                            style={{ color: isActive ? '#fff' : cell.color }}
                          >
                            {cell.level}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Risk Level Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {CRF_RISK_LEVELS.map((lvl) => (
              <div key={lvl} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[lvl] }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">{lvl}</span> {CRF_RISK_LEVEL_LABELS[lvl]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

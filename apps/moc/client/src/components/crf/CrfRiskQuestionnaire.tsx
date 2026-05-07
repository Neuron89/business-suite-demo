'use client';

import {
  CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS,
  CRF_HAZARD_QUESTION_LABELS,
  CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS,
  CRF_SIGNIFICANCE_QUESTION_LABELS,
  CRF_RISK_LEVEL_COLORS,
  calculateCrfRiskLevel, getCrfRiskReason, getCrfRiskDescription,
  getCrfChangeCategory, CRF_REVIEWS_REQUIRED,
} from '@moc/shared';
import type { CrfRiskAnswers, CrfRiskLevel, CrfChangeType } from '@moc/shared';

interface Props {
  answers: CrfRiskAnswers;
  onChange: (answers: CrfRiskAnswers) => void;
  changeType?: string;
  readOnly?: boolean;
}

function QuestionGroup({
  title,
  levelLabel,
  questions,
  labels,
  answers,
  groupKey,
  onChange,
  readOnly,
}: {
  title: string;
  levelLabel: string;
  questions: readonly string[];
  labels: Record<string, string>;
  answers: Record<string, boolean | null>;
  groupKey: keyof CrfRiskAnswers;
  onChange: (groupKey: keyof CrfRiskAnswers, question: string, value: boolean) => void;
  readOnly?: boolean;
}) {
  const answeredCount = questions.reduce((n, q) => n + (answers[q] !== null && answers[q] !== undefined ? 1 : 0), 0);
  const yesCount = questions.reduce((n, q) => n + (answers[q] === true ? 1 : 0), 0);
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
        {title} <span className="text-xs font-normal text-gray-400">({levelLabel})</span>
        <span className={`ml-2 text-xs font-normal ${allAnswered ? 'text-gray-500' : 'text-amber-500'}`}>
          {allAnswered
            ? `(${yesCount} of ${questions.length} Yes)`
            : `(${answeredCount} of ${questions.length} answered)`
          }
        </span>
      </h4>
      <div className="space-y-2">
        {questions.map((q) => {
          const isUnanswered = answers[q] === null || answers[q] === undefined;
          return (
            <div key={q} className={`flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 ${isUnanswered && !readOnly ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
              {readOnly ? (
                <span className={`text-sm font-medium flex-shrink-0 w-8 ${answers[q] === true ? 'text-red-600' : answers[q] === false ? 'text-gray-400' : 'text-amber-400'}`}>
                  {answers[q] === true ? 'Yes' : answers[q] === false ? 'No' : '—'}
                </span>
              ) : (
                <div className="flex gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`${groupKey}_${q}`}
                      checked={answers[q] === true}
                      onChange={() => onChange(groupKey, q, true)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-300">Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`${groupKey}_${q}`}
                      checked={answers[q] === false}
                      onChange={() => onChange(groupKey, q, false)}
                      className="text-gray-400 focus:ring-gray-400"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-300">No</span>
                  </label>
                </div>
              )}
              <span className="text-sm text-gray-700 dark:text-gray-200">{labels[q] || q}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CrfRiskQuestionnaire({ answers, onChange, changeType, readOnly }: Props) {
  function handleChange(groupKey: keyof CrfRiskAnswers, question: string, value: boolean) {
    const updated = {
      ...answers,
      [groupKey]: { ...answers[groupKey], [question]: value },
    };
    onChange(updated);
  }

  // Calculate risk level
  const countYeses = (group: Record<string, boolean | null>, keys: readonly string[]) =>
    keys.reduce((n, k) => n + (group[k] ? 1 : 0), 0);

  const riskLevel = calculateCrfRiskLevel(
    countYeses(answers.hazard_l1, CRF_HAZARD_L1_QUESTIONS),
    countYeses(answers.hazard_l2, CRF_HAZARD_L2_QUESTIONS),
    countYeses(answers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS),
    countYeses(answers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS),
    countYeses(answers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS),
  );

  const hazL1 = countYeses(answers.hazard_l1, CRF_HAZARD_L1_QUESTIONS);
  const hazL2 = countYeses(answers.hazard_l2, CRF_HAZARD_L2_QUESTIONS);
  const sigL0 = countYeses(answers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS);
  const sigL1 = countYeses(answers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS);
  const sigL2 = countYeses(answers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS);

  const reason = getCrfRiskReason(hazL1, hazL2, sigL0, sigL1, sigL2);

  // Reviews required
  const category = changeType ? getCrfChangeCategory(changeType as CrfChangeType) : null;
  const reviewsRequired = category
    ? CRF_REVIEWS_REQUIRED[riskLevel]?.[category] || []
    : [];

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Risk Assessment</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Answer the following questions to determine the risk level of this change.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Degree of Hazard */}
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Degree of Hazard</h3>
          <QuestionGroup
            title="Level 1 Questions"
            levelLabel="L1"
            questions={CRF_HAZARD_L1_QUESTIONS}
            labels={CRF_HAZARD_QUESTION_LABELS}
            answers={answers.hazard_l1}
            groupKey="hazard_l1"
            onChange={handleChange}
            readOnly={readOnly}
          />
          <QuestionGroup
            title="Level 2 Questions"
            levelLabel="L2"
            questions={CRF_HAZARD_L2_QUESTIONS}
            labels={CRF_HAZARD_QUESTION_LABELS}
            answers={answers.hazard_l2}
            groupKey="hazard_l2"
            onChange={handleChange}
            readOnly={readOnly}
          />
        </div>

        {/* Degree of Significance */}
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Degree of Significance</h3>
          <QuestionGroup
            title="Baseline Questions"
            levelLabel="L0"
            questions={CRF_SIGNIFICANCE_L0_QUESTIONS}
            labels={CRF_SIGNIFICANCE_QUESTION_LABELS}
            answers={answers.significance_l0}
            groupKey="significance_l0"
            onChange={handleChange}
            readOnly={readOnly}
          />
          <QuestionGroup
            title="Level 1 Questions"
            levelLabel="L1"
            questions={CRF_SIGNIFICANCE_L1_QUESTIONS}
            labels={CRF_SIGNIFICANCE_QUESTION_LABELS}
            answers={answers.significance_l1}
            groupKey="significance_l1"
            onChange={handleChange}
            readOnly={readOnly}
          />
          <QuestionGroup
            title="Level 2 Questions"
            levelLabel="L2"
            questions={CRF_SIGNIFICANCE_L2_QUESTIONS}
            labels={CRF_SIGNIFICANCE_QUESTION_LABELS}
            answers={answers.significance_l2}
            groupKey="significance_l2"
            onChange={handleChange}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Risk Level Result */}
      <div className="mt-6 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Calculated Risk Level:</span>
            <span
              className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[riskLevel] }}
            >
              {riskLevel} — {getCrfRiskDescription(riskLevel, answers)}
            </span>
          </div>
          {reviewsRequired.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Reviews Required: </span>
              <div className="inline-flex gap-2 ml-2">
                {reviewsRequired.map((r) => (
                  <span key={r} className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {reason && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Decision path: {reason}
          </p>
        )}
      </div>
    </div>
  );
}

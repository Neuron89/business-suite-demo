import db from '../db/connection';
import {
  calculateCrfRiskLevel,
  CRF_HAZARD_L1_QUESTIONS,
  CRF_HAZARD_L2_QUESTIONS,
  CRF_SIGNIFICANCE_L0_QUESTIONS,
  CRF_SIGNIFICANCE_L1_QUESTIONS,
  CRF_SIGNIFICANCE_L2_QUESTIONS,
} from '@moc/shared';
import type { CrfRiskAnswers } from '@moc/shared';

const RISK_ORDER: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Recalculate and store the aggregate risk_level on a MOC request.
 * Uses the highest (worst) risk_level_before from all risk assessments.
 */
export async function recalcMocRiskLevel(mocId: number): Promise<string | null> {
  const assessments = await db('risk_assessments')
    .where('moc_id', mocId)
    .select('risk_level_before');

  if (assessments.length === 0) {
    await db('moc_requests').where('id', mocId).update({ risk_level: null });
    return null;
  }

  let worst = 'low';
  for (const a of assessments) {
    if ((RISK_ORDER[a.risk_level_before] || 0) > (RISK_ORDER[worst] || 0)) {
      worst = a.risk_level_before;
    }
  }

  await db('moc_requests').where('id', mocId).update({ risk_level: worst });
  return worst;
}

function countYeses(answers: Record<string, boolean | null>, keys: readonly string[]): number {
  return keys.reduce((n, k) => n + (answers[k] ? 1 : 0), 0);
}

/**
 * Calculate and store CRF risk level from risk answers.
 */
export async function calculateAndStoreCrfRisk(
  mocId: number,
  riskAnswers: CrfRiskAnswers,
): Promise<string> {
  const hazL1 = countYeses(riskAnswers.hazard_l1, CRF_HAZARD_L1_QUESTIONS);
  const hazL2 = countYeses(riskAnswers.hazard_l2, CRF_HAZARD_L2_QUESTIONS);
  const sigL0 = countYeses(riskAnswers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS);
  const sigL1 = countYeses(riskAnswers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS);
  const sigL2 = countYeses(riskAnswers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS);

  const level = calculateCrfRiskLevel(hazL1, hazL2, sigL0, sigL1, sigL2);

  await db('moc_requests').where('id', mocId).update({ crf_risk_level: level });
  return level;
}

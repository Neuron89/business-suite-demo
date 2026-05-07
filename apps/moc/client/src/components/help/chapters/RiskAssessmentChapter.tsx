'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import RiskMatrixDiagram from '../diagrams/RiskMatrixDiagram';

export default function RiskAssessmentChapter() {
  return (
    <HelpChapter id="risk-assessment" number={6} title="Risk Assessment">
      <p className="text-theme-secondary leading-relaxed">
        Risk assessment evaluates the severity and likelihood of potential impacts from the proposed change. The system supports two matrix types depending on the template used.
      </p>

      <RiskMatrixDiagram />

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-theme-primary">How Risk Scores Work</h3>
        <p className="text-sm text-theme-secondary">
          Each risk is scored on two axes: <strong>Severity</strong> (impact if the risk occurs) and <strong>Likelihood</strong> (probability of occurrence). The cell color indicates the overall risk level:
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' },
            { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400' },
            { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' },
            { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
          ].map((r) => (
            <span key={r.label} className={`badge ${r.color}`}>{r.label}</span>
          ))}
        </div>
      </div>

      <CalloutBox variant="tip">
        The Legacy 5x5 matrix provides more granular scoring while the CRF 4x4 matrix is simpler. Both produce an overall risk level that determines the level of review required.
      </CalloutBox>

      <CalloutBox variant="warning">
        High and Critical risk MOCs require additional scrutiny and may need sign-off from facility management before proceeding.
      </CalloutBox>
    </HelpChapter>
  );
}

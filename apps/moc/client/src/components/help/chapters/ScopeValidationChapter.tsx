'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import AnnotatedMockup, { CalloutCircle } from '../AnnotatedMockup';

export default function ScopeValidationChapter() {
  return (
    <HelpChapter id="scope-validation" number={10} title="Improvement Expected & Realized">
      <p className="text-theme-secondary leading-relaxed">
        Track expected improvements from a change (FPQ, yield, cost savings, waste reduction, hours per batch, etc.) and validate that those improvements were realized after implementation.
      </p>

      <AnnotatedMockup
        title="Improvement Comparison View"
        annotations={[
          { number: 1, label: 'Baseline parameters — Current values before the change' },
          { number: 2, label: 'Expected values — Target improvement after the change' },
          { number: 3, label: 'Realized values — Actual results after implementation' },
        ]}
      >
        <div className="text-xs">
          <div className="grid grid-cols-4 gap-1 font-bold text-theme-primary border-b border-theme pb-1 mb-1">
            <span>Parameter</span>
            <span className="flex items-center gap-1"><CalloutCircle number={1} /> Baseline</span>
            <span className="flex items-center gap-1"><CalloutCircle number={2} /> Expected</span>
            <span className="flex items-center gap-1"><CalloutCircle number={3} /> Realized</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-theme-muted py-1">
            <span>FPQ</span><span>85%</span><span>92%</span>
            <span className="text-green-500 font-semibold">94%</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-theme-muted py-1">
            <span>Hours/Batch</span><span>4.5 hrs</span><span>3.5 hrs</span>
            <span className="text-green-500 font-semibold">3.2 hrs</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-theme-muted py-1">
            <span>Cost Savings</span><span>$0</span><span>$5,000/yr</span>
            <span className="text-amber-500 font-semibold">$3,200/yr</span>
          </div>
        </div>
      </AnnotatedMockup>

      <CalloutBox variant="info">
        The &ldquo;Improvements Realized&rdquo; step occurs after PSSR completion but before closing the MOC. This ensures expected outcomes are validated before the change is finalized.
      </CalloutBox>

      <CalloutBox variant="tip">
        Improvement data can be exported as CSV from the Improvements Realized tab, making it easy to aggregate hours saved, dollars saved, and other metrics across MOCs by month, quarter, or year.
      </CalloutBox>
    </HelpChapter>
  );
}

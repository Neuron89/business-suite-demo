'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';

export default function TestingSectionChapter() {
  return (
    <HelpChapter id="testing-section" number={13} title="Testing Section">
      <p className="text-theme-secondary leading-relaxed">
        The Testing section in the sidebar provides standalone versions of key MOC system features. These allow you to try out and review each function without creating an actual MOC.
      </p>

      <div className="space-y-4">
        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Risk Calculator</h4>
          <p className="text-sm text-theme-muted">
            Test the CRF risk calculation independently. Answer the change request form questions and see the resulting risk level (L0-L3) and which reviews/approvals are required. Useful for understanding how different answers affect the risk score before submitting a real MOC.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">PSSR Checklist</h4>
          <p className="text-sm text-theme-muted">
            Practice with the full Pre-Startup Safety Review checklist (Appendix VI). Mark items as Yes/No/N/A, see action items generated from &quot;No&quot; answers, and export a printable report with the checklist, action items, and blank sign-off roster. No data is saved to the database.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">DSR Checklist</h4>
          <p className="text-sm text-theme-muted">
            Practice with the full Design Safety Review checklist (Appendix IV). Evaluate each safety question, document deficiencies, and export a printable report. No data is saved to the database.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Scope Validation</h4>
          <p className="text-sm text-theme-muted">
            Test the improvement tracking workflow with three tabs: define baseline parameters (with presets like FPQ, Yield, Cost Savings), enter post-change expected values, and view a comparison report showing deltas and percentage changes. No data is saved to the database.
          </p>
        </div>
      </div>

      <CalloutBox variant="info">
        The Testing section is available to all users. Data entered in testing pages is client-side only and is not saved to the database. Refreshing the page will reset all values.
      </CalloutBox>

      <CalloutBox variant="tip">
        Use the testing pages to train new team members on the MOC system features before they work with real MOCs.
      </CalloutBox>
    </HelpChapter>
  );
}

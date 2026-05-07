'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';

export default function DsrChapter() {
  return (
    <HelpChapter id="dsr" number={9} title="DSR (Design Safety Review)">
      <p className="text-theme-secondary leading-relaxed">
        The Design Safety Review (DSR) uses the official Appendix IV checklist to evaluate safety considerations during the design phase of a change. Any &quot;No&quot; answers are considered deficiencies and must be reported in writing to the Department Manager or designee and the change originator.
      </p>

      <StepByStep steps={[
        { title: 'Open the DSR checklist', description: 'During the design review phase, navigate to the DSR section for the MOC.' },
        { title: 'Evaluate each item', description: 'Review each safety question and mark it Yes, No, or N/A. Items marked N/A are grayed out.' },
        { title: 'Document deficiencies', description: 'For any item marked "No", add detailed notes describing the deficiency and required corrective action.' },
        { title: 'Export for sign-off', description: 'Click "Export DSR" to generate a printable report with the full checklist, deficiency list, and blank sign-off roster.' },
      ]} />

      <h3 className="text-lg font-bold text-theme-primary">DSR Categories (Appendix IV)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          'A. Administration',
          'B. Material Safety / Regulatory Status',
          'C. Pressure / Vacuum Relief',
          'D. Temperature / Reaction',
          'E. Valves and Piping',
          'F. Rotating and Mechanical Equipment',
          'G. Instrumentation',
          'H. Electrical Systems',
          'I. Fire Protection',
          'J. Personnel Health / Industrial Hygiene',
        ].map((cat) => (
          <div key={cat} className="flex items-center gap-2 text-sm">
            <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-500/10 text-blue-500 text-xs">{'\u2713'}</span>
            <span className="text-theme-secondary">{cat}</span>
          </div>
        ))}
      </div>

      <CalloutBox variant="warning">
        &quot;No&quot; answers are considered deficiencies. These must be reported in writing to the Department Manager or designee and the change originator before proceeding.
      </CalloutBox>

      <CalloutBox variant="tip">
        Use the Testing section in the sidebar to practice with the DSR checklist without creating a MOC. The test page includes the same export functionality.
      </CalloutBox>
    </HelpChapter>
  );
}

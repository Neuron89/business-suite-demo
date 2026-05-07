'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';

export default function PssrChapter() {
  return (
    <HelpChapter id="pssr" number={8} title="PSSR (Pre-Startup Safety Review)">
      <p className="text-theme-secondary leading-relaxed">
        After a change is implemented, a Pre-Startup Safety Review (PSSR) ensures everything is safe and ready before resuming operations. The PSSR uses the official Appendix VI checklist with 11 categories.
      </p>

      <StepByStep steps={[
        { title: 'Implementation complete', description: 'Once the physical change is done, the MOC moves to "PSSR Pending".' },
        { title: 'Create the PSSR checklist', description: 'Navigate to the MOC detail page, open the PSSR tab, and click "Create PSSR Checklist".' },
        { title: 'Complete each category', description: 'Go through each item and mark it Yes, No, or N/A. Items marked N/A are grayed out. Items marked No become action items requiring corrective action.' },
        { title: 'Resolve action items', description: 'All "No" items appear in the Action Items section. Once corrective action is taken, click "Mark Resolved" to check them off.' },
        { title: 'Sign off', description: 'Each department involved in the MOC must sign off on the PSSR to acknowledge they have reviewed all items.' },
        { title: 'Export for manual signature', description: 'Click "Export PSSR" to generate a printable report with the full checklist, action items, and a blank sign-off roster for manual signatures.' },
        { title: 'Mark complete', description: 'Once all items pass or are N/A, mark the PSSR as complete to advance the MOC.' },
      ]} />

      <h3 className="text-lg font-bold text-theme-primary">PSSR Categories (Appendix VI)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          'A. Design and Construction',
          'B. Valves and Piping',
          'C. Equipment',
          'D. Instrument and Electrical',
          'E. Computer Software and Systems',
          'F. Operations',
          'G. Maintenance',
          'H. Relief Devices',
          'I. Fire Protection and Personnel Safety',
          'J. Occupational Health / Industrial Hygiene',
          'K. Environmental Protection',
        ].map((cat) => (
          <div key={cat} className="flex items-center gap-2 text-sm">
            <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-500/10 text-amber-500 text-xs">{'\u2713'}</span>
            <span className="text-theme-secondary">{cat}</span>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-bold text-theme-primary mt-4">Action Items</h3>
      <p className="text-theme-secondary leading-relaxed">
        Any item marked &quot;No&quot; automatically becomes an action item requiring corrective action. Action items are displayed in a dedicated section with the category, description, and notes. Once the corrective action has been taken, click the &quot;Mark Resolved&quot; button to check it off. Resolved items show with a green checkmark and strikethrough text.
      </p>

      <h3 className="text-lg font-bold text-theme-primary mt-4">Export &amp; Sign-Off</h3>
      <p className="text-theme-secondary leading-relaxed">
        The PSSR can be exported as a printable HTML report for manual sign-off. The export includes the full checklist with statuses, the action items list with a &quot;Resolved&quot; column, and a blank sign-off roster with space for name, date, and signature. Digital sign-off is also available directly in the application.
      </p>

      <CalloutBox variant="warning">
        The PSSR must be fully completed before the MOC can be closed. All items must be marked Yes or N/A, and all action items should be resolved.
      </CalloutBox>

      <CalloutBox variant="tip">
        PSSR items can be completed over multiple sessions. Your progress is saved automatically. Use the testing section in the sidebar to practice with the PSSR checklist without creating a MOC.
      </CalloutBox>
    </HelpChapter>
  );
}

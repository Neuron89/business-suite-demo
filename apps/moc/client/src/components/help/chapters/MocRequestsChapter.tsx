'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';
import AnnotatedMockup, { CalloutCircle } from '../AnnotatedMockup';
import StatusBadge from '@/components/shared/StatusBadge';

export default function MocRequestsChapter() {
  return (
    <HelpChapter id="moc-requests" number={3} title="MOC Requests">
      <p className="text-theme-secondary leading-relaxed">
        MOC Requests are the core of the system. Each request tracks a proposed change from creation through approval, implementation, and closure.
      </p>

      <AnnotatedMockup
        title="MOC List View"
        annotations={[
          { number: 1, label: '"+ New MOC Request" button — starts a new change request' },
          { number: 2, label: 'Search and filter bar — filter by status, date, keyword' },
          { number: 3, label: 'MOC table rows — click any row to view details' },
        ]}
      >
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-theme-primary text-sm">MOC Requests</span>
            <div className="flex items-center gap-1">
              <CalloutCircle number={1} />
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>+ New MOC</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <CalloutCircle number={2} />
            <div className="flex-1 h-7 border border-theme rounded-lg bg-card-surface" />
          </div>
          <div className="border border-theme rounded-lg bg-card-surface divide-y divide-gray-200 dark:divide-gray-700">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1"><CalloutCircle number={3} /> <span className="text-theme-primary font-semibold">MOC-2024-001</span></div>
              <StatusBadge status="under_review" />
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-theme-primary font-semibold">MOC-2024-002</span>
              <StatusBadge status="approved" />
            </div>
          </div>
        </div>
      </AnnotatedMockup>

      <h3 className="text-lg font-bold text-theme-primary">Creating a New MOC</h3>
      <StepByStep steps={[
        { title: 'Click "+ New MOC Request"', description: 'From the MOC Requests page or Dashboard.' },
        { title: 'Choose a template', description: 'Select either a Legacy form or CRF (Change Request Form) template.' },
        { title: 'Fill in the details', description: 'Complete all required fields: title, description, change type, affected areas, etc.' },
        { title: 'Save as Draft or Submit', description: 'Save as draft to continue later, or submit to start the review process.' },
      ]} />

      <CalloutBox variant="tip">
        Click any row in the MOC table to open its detail page with full information, timeline, attachments, and review status.
      </CalloutBox>

      <CalloutBox variant="warning">
        Once a MOC is submitted, you cannot edit it unless it is returned to you by a reviewer. Make sure all information is correct before submitting.
      </CalloutBox>
    </HelpChapter>
  );
}

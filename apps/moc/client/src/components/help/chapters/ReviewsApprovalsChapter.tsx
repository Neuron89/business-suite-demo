'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';
import ReviewProcessDiagram from '../diagrams/ReviewProcessDiagram';

export default function ReviewsApprovalsChapter() {
  return (
    <HelpChapter id="reviews-approvals" number={7} title="Reviews & Approvals">
      <p className="text-theme-secondary leading-relaxed">
        Once a MOC passes risk assessment, it enters the review phase. Three departments review in parallel: EHS, Operations, and QC.
      </p>

      <ReviewProcessDiagram />

      <h3 className="text-lg font-bold text-theme-primary">Review Process</h3>
      <StepByStep steps={[
        { title: 'MOC enters "Under Review"', description: 'After risk assessment is complete, the MOC is assigned to reviewers.' },
        { title: 'Parallel reviews begin', description: 'EHS, Operations, and QC each review the MOC independently.' },
        { title: 'Each reviewer takes action', description: 'Approve, reject, or add review notes. Reviewers can also request the MOC be returned for changes.' },
        { title: 'All approvals received', description: 'When all three departments approve, the MOC moves to "Approved" status.' },
      ]} />

      <CalloutBox variant="role" title="Reviewer Actions">
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li><strong>Approve</strong> — Confirm the change meets your department&apos;s requirements</li>
          <li><strong>Reject</strong> — Deny the change with a reason (MOC moves to Rejected)</li>
          <li><strong>Return</strong> — Send back to the requestor for revisions (MOC returns to Draft)</li>
          <li><strong>Add Notes</strong> — Provide feedback or conditions without changing status</li>
        </ul>
      </CalloutBox>

      <CalloutBox variant="warning">
        If any single reviewer rejects, the entire MOC is rejected. All three departments must approve for the MOC to proceed.
      </CalloutBox>
    </HelpChapter>
  );
}

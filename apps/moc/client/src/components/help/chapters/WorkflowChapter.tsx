'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StatusBadge from '@/components/shared/StatusBadge';
import WorkflowDiagram from '../diagrams/WorkflowDiagram';

export default function WorkflowChapter() {
  return (
    <HelpChapter id="workflow" number={5} title="Workflow & Status Flow">
      <p className="text-theme-secondary leading-relaxed">
        Every MOC follows a defined workflow from creation to closure. The diagram below shows all possible status transitions.
      </p>

      <WorkflowDiagram />

      <h3 className="text-lg font-bold text-theme-primary">Status Reference</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { status: 'draft', desc: 'MOC created but not yet submitted' },
          { status: 'submitted', desc: 'Submitted for departmental review (risk assessed during creation)' },
          { status: 'under_review', desc: 'Being reviewed by assigned departments' },
          { status: 'approved', desc: 'All reviews passed — ready to implement' },
          { status: 'rejected', desc: 'Denied by one or more reviewers' },
          { status: 'returned', desc: 'Sent back to requestor for changes' },
          { status: 'implementing', desc: 'Change is being carried out' },
          { status: 'pssr_pending', desc: 'Pre-Startup Safety Review needed' },
          { status: 'pssr_complete', desc: 'PSSR checklist completed' },
          { status: 'improvements_realized', desc: 'Validating expected improvements were realized' },
          { status: 'closed', desc: 'MOC fully completed and archived' },
        ].map((s) => (
          <div key={s.status} className="flex items-start gap-2">
            <StatusBadge status={s.status} />
            <span className="text-sm text-theme-muted">{s.desc}</span>
          </div>
        ))}
      </div>

      <CalloutBox variant="info">
        A MOC can only move forward through the workflow. The only exception is <strong>Returned</strong>, which sends it back to Draft for revisions.
      </CalloutBox>
    </HelpChapter>
  );
}

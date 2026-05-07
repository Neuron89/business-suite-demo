'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import AnnotatedMockup, { CalloutCircle } from '../AnnotatedMockup';
import StatusBadge from '@/components/shared/StatusBadge';

export default function DashboardChapter() {
  return (
    <HelpChapter id="dashboard" number={2} title="Dashboard">
      <p className="text-theme-secondary leading-relaxed">
        The Dashboard gives you a real-time overview of all MOC activity. It&apos;s the first thing you see after logging in.
      </p>

      <AnnotatedMockup
        title="Dashboard Overview"
        annotations={[
          { number: 1, label: 'Stat cards — Quick counts (Open MOCs, Pending Reviews, etc.)' },
          { number: 2, label: 'Status distribution chart — Bar chart showing MOCs by status' },
          { number: 3, label: 'Pending reviews table — MOCs awaiting your action' },
        ]}
      >
        <div className="space-y-3 text-xs">
          {/* Stat cards row */}
          <div className="flex gap-2">
            <div className="flex-1 border border-l-4 border-l-blue-500 border-theme rounded-lg p-2 bg-card-surface">
              <div className="flex items-center gap-1"><CalloutCircle number={1} /></div>
              <div className="text-[10px] text-theme-muted mt-1">Open MOCs</div>
              <div className="text-lg font-bold text-theme-primary">12</div>
            </div>
            <div className="flex-1 border border-l-4 border-l-amber-500 border-theme rounded-lg p-2 bg-card-surface">
              <div className="text-[10px] text-theme-muted">Pending Reviews</div>
              <div className="text-lg font-bold text-theme-primary">5</div>
            </div>
            <div className="flex-1 border border-l-4 border-l-green-500 border-theme rounded-lg p-2 bg-card-surface">
              <div className="text-[10px] text-theme-muted">Closed This Month</div>
              <div className="text-lg font-bold text-theme-primary">8</div>
            </div>
          </div>
          {/* Chart area */}
          <div className="border border-theme rounded-lg p-2 bg-card-surface flex items-center justify-center h-12">
            <CalloutCircle number={2} /> <span className="text-[10px] text-theme-muted ml-1">Status Distribution Chart</span>
          </div>
          {/* Table */}
          <div className="border border-theme rounded-lg p-2 bg-card-surface">
            <div className="flex items-center gap-1 mb-1"><CalloutCircle number={3} /> <span className="text-[10px] font-semibold text-theme-primary">Pending Reviews</span></div>
            <div className="flex justify-between text-[10px] text-theme-muted border-b border-theme pb-1 mb-1">
              <span>MOC-2024-001</span> <StatusBadge status="under_review" />
            </div>
            <div className="flex justify-between text-[10px] text-theme-muted">
              <span>MOC-2024-005</span> <StatusBadge status="risk_assessment" />
            </div>
          </div>
        </div>
      </AnnotatedMockup>

      <CalloutBox variant="tip">
        Click any stat card to jump directly to a filtered view of those MOCs. For example, clicking &quot;Open MOCs&quot; shows all non-closed, non-draft requests.
      </CalloutBox>
    </HelpChapter>
  );
}

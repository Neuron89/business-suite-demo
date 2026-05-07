'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';
import AnnotatedMockup, { CalloutCircle } from '../AnnotatedMockup';

export default function GettingStarted() {
  return (
    <HelpChapter id="getting-started" number={1} title="Getting Started">
      <p className="text-theme-secondary leading-relaxed">
        The MOC System helps you manage changes in the nylon manufacturing facility. Here&apos;s how to log in and navigate the application.
      </p>

      <StepByStep steps={[
        { title: 'Open the login page', description: 'Navigate to the MOC System URL in your browser. You\'ll see the login screen.' },
        { title: 'Enter your credentials', description: 'Type your email address and password, then click "Sign In".' },
        { title: 'You\'re in!', description: 'After login you\'ll land on the Dashboard with an overview of all activity.' },
      ]} />

      <AnnotatedMockup
        title="Application Layout"
        annotations={[
          { number: 1, label: 'Sidebar — Main navigation (always visible)' },
          { number: 2, label: 'Top bar — Breadcrumbs, dark mode toggle, notifications' },
          { number: 3, label: 'Content area — The current page' },
        ]}
      >
        <div className="flex gap-2 text-xs">
          <div className="w-24 bg-gray-800 dark:bg-gray-900 rounded-lg p-2 text-white flex flex-col gap-1">
            <div className="flex items-center gap-1"><CalloutCircle number={1} /> <span className="text-[10px]">Sidebar</span></div>
            <div className="h-3 bg-white/10 rounded mt-1" />
            <div className="h-3 bg-amber-500/30 rounded" />
            <div className="h-3 bg-white/10 rounded" />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-8 bg-card-surface border border-theme rounded-lg flex items-center px-2 gap-1">
              <CalloutCircle number={2} /> <span className="text-[10px] text-theme-muted">Top Bar</span>
            </div>
            <div className="flex-1 bg-card-surface border border-theme rounded-lg p-2 min-h-[60px] flex items-center justify-center">
              <div className="flex items-center gap-1"><CalloutCircle number={3} /> <span className="text-[10px] text-theme-muted">Content Area</span></div>
            </div>
          </div>
        </div>
      </AnnotatedMockup>

      <CalloutBox variant="role" title="User Roles">
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li><strong>Admin</strong> — Full access to all features, user management, templates</li>
          <li><strong>MOC Manager</strong> — Create and manage MOCs, manage templates</li>
          <li><strong>EHS</strong> — Review MOCs for environmental, health &amp; safety compliance</li>
          <li><strong>Operations</strong> — Review MOCs for operational impact</li>
          <li><strong>QC</strong> — Review MOCs for quality control compliance</li>
        </ul>
      </CalloutBox>

      <CalloutBox variant="tip" title="Dark Mode">
        Click the sun/moon toggle in the top-right corner to switch between light and dark mode. Your preference is saved automatically.
      </CalloutBox>
    </HelpChapter>
  );
}

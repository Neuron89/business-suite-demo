'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';

export default function AdminFeaturesChapter() {
  return (
    <HelpChapter id="admin-features" number={13} title="Admin Features">
      <p className="text-theme-secondary leading-relaxed">
        Administrative features are available to Admin and MOC Manager roles. These include user management, template configuration, and the audit trail.
      </p>

      <div className="space-y-4">
        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">User Management</h4>
          <p className="text-sm text-theme-muted">
            Add, edit, and deactivate user accounts. Assign roles (Admin, MOC Manager, EHS, Operations, QC) to control what each user can access.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Template Management</h4>
          <p className="text-sm text-theme-muted">
            Create and edit MOC form templates. Define which fields are required, configure risk matrix type (Legacy 5x5 or CRF 4x4), and activate/deactivate templates.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Audit Trail</h4>
          <p className="text-sm text-theme-muted">
            View a complete log of all actions taken in the system. Every status change, review, edit, and login is recorded with timestamp and user information.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Reports</h4>
          <p className="text-sm text-theme-muted">
            Generate reports on MOC activity, review turnaround times, risk distribution, and other metrics. Reports can be filtered by date range and exported.
          </p>
        </div>

        <div className="card">
          <h4 className="text-sm font-bold text-theme-primary mb-2">System Tickets</h4>
          <p className="text-sm text-theme-muted">
            View and manage system support tickets submitted by users through the feedback button.
          </p>
        </div>
      </div>

      <CalloutBox variant="role" title="Access Required">
        User management, template management, and system tickets require <strong>Admin</strong> or <strong>MOC Manager</strong> role. The audit trail is also accessible to <strong>EHS</strong> users. Reports are available to Admin, EHS, Operations, and MOC Manager roles.
      </CalloutBox>
    </HelpChapter>
  );
}

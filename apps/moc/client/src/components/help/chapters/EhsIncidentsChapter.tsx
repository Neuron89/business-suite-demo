'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';

export default function EhsIncidentsChapter() {
  return (
    <HelpChapter id="ehs-incidents" number={11} title="EHS Incidents">
      <p className="text-theme-secondary leading-relaxed">
        The EHS Incidents module tracks environmental, health, and safety incidents that may be related to management of change activities.
      </p>

      <StepByStep steps={[
        { title: 'Report a new incident', description: 'Click "+ New Incident" from the EHS Incidents page. Fill in date, type, severity, and description.' },
        { title: 'Link to a MOC (optional)', description: 'If the incident is related to a change, link it to the relevant MOC request.' },
        { title: 'Track investigation', description: 'Update the incident with root cause analysis, corrective actions, and follow-up items.' },
        { title: 'Close the incident', description: 'Once all corrective actions are complete, close the incident record.' },
      ]} />

      <CalloutBox variant="role" title="Who Can Report">
        All roles can create and view EHS incidents. EHS and Admin users have additional capabilities for managing and closing incidents.
      </CalloutBox>

      <CalloutBox variant="warning">
        Report incidents as soon as possible. Timely reporting helps ensure proper investigation and corrective action.
      </CalloutBox>
    </HelpChapter>
  );
}

'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';

export default function TemplatesChapter() {
  return (
    <HelpChapter id="templates" number={4} title="Templates">
      <p className="text-theme-secondary leading-relaxed">
        Templates define the form structure for MOC requests. The system supports two types of forms, each with different fields and risk assessment approaches.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card border-l-4 border-l-blue-500">
          <h4 className="text-sm font-bold text-theme-primary mb-2">Legacy Form</h4>
          <ul className="text-sm text-theme-muted space-y-1 list-disc list-inside">
            <li>Traditional MOC format</li>
            <li>5x5 risk matrix</li>
            <li>Standard change types</li>
            <li>Suitable for most changes</li>
          </ul>
        </div>
        <div className="card border-l-4 border-l-purple-500">
          <h4 className="text-sm font-bold text-theme-primary mb-2">CRF (Change Request Form)</h4>
          <ul className="text-sm text-theme-muted space-y-1 list-disc list-inside">
            <li>Detailed change request format</li>
            <li>4x4 risk matrix with questionnaire</li>
            <li>Implementation plan section</li>
            <li>Extended change type categories</li>
          </ul>
        </div>
      </div>

      <CalloutBox variant="role" title="Admin / MOC Manager Only">
        Template management (creating, editing, activating/deactivating templates) is available under <strong>Administration &rarr; Templates</strong>. Regular users select from active templates when creating a new MOC.
      </CalloutBox>

      <CalloutBox variant="tip">
        When creating a new MOC, the template you choose determines which fields are available and which risk matrix is used. Choose the template that best matches your change type.
      </CalloutBox>
    </HelpChapter>
  );
}

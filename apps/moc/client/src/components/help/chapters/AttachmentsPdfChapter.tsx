'use client';

import HelpChapter from '../HelpChapter';
import CalloutBox from '../CalloutBox';
import StepByStep from '../StepByStep';

export default function AttachmentsPdfChapter() {
  return (
    <HelpChapter id="attachments-pdf" number={12} title="Attachments & PDF Export">
      <p className="text-theme-secondary leading-relaxed">
        You can attach supporting documents to any MOC request and export the full MOC record as a PDF for offline review or archiving.
      </p>

      <h3 className="text-lg font-bold text-theme-primary">Uploading Attachments</h3>
      <StepByStep steps={[
        { title: 'Open a MOC detail page', description: 'Navigate to the MOC you want to add files to.' },
        { title: 'Find the Attachments section', description: 'Scroll down or click the Attachments tab.' },
        { title: 'Click "Upload" or drag files', description: 'Select files from your computer or drag and drop them into the upload area.' },
        { title: 'Files are saved automatically', description: 'Uploaded files appear in the attachment list immediately.' },
      ]} />

      <h3 className="text-lg font-bold text-theme-primary">PDF Export</h3>
      <p className="text-sm text-theme-secondary">
        Click the <strong>&quot;Export PDF&quot;</strong> button on any MOC detail page to generate a complete PDF document including all form data, risk scores, review history, and PSSR results.
      </p>

      <CalloutBox variant="tip">
        PDF exports include a timestamp and the current status. Export after the MOC is closed for a complete record.
      </CalloutBox>

      <CalloutBox variant="info">
        Supported file types for attachments include PDF, images (PNG, JPG), Word documents, Excel spreadsheets, and text files.
      </CalloutBox>
    </HelpChapter>
  );
}

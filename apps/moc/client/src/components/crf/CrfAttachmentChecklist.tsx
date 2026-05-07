'use client';

import { CRF_ATTACHMENT_TYPES, CRF_ATTACHMENT_TYPE_LABELS } from '@moc/shared';

interface Props {
  checklist: Record<string, boolean>;
  onChange: (checklist: Record<string, boolean>) => void;
  readOnly?: boolean;
}

export default function CrfAttachmentChecklist({ checklist, onChange, readOnly }: Props) {
  function toggle(key: string) {
    onChange({ ...checklist, [key]: !checklist[key] });
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Attachment Checklist</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Check off documents that have been prepared or attached.</p>

      <div className="space-y-2">
        {CRF_ATTACHMENT_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checklist[type]}
              onChange={() => toggle(type)}
              disabled={readOnly}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {CRF_ATTACHMENT_TYPE_LABELS[type]}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

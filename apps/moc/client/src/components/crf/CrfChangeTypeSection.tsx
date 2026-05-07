'use client';

import { CRF_CHANGE_TYPES, CRF_CHANGE_TYPE_LABELS, CRF_CHANGE_DURATIONS, CRF_CHANGE_DURATION_LABELS } from '@moc/shared';

interface Props {
  changeType: string;
  changeDuration: string;
  temporaryEndDate: string;
  onChange: (field: string, value: any) => void;
}

export default function CrfChangeTypeSection({ changeType, changeDuration, temporaryEndDate, onChange }: Props) {
  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Change Type</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Type of Change *</label>
        <select
          value={changeType}
          onChange={(e) => onChange('crf_change_type', e.target.value)}
          className="input-field"
          required
        >
          <option value="">Select change type...</option>
          {CRF_CHANGE_TYPES.map((t) => (
            <option key={t} value={t}>{CRF_CHANGE_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Duration *</label>
        <div className="flex gap-4">
          {CRF_CHANGE_DURATIONS.map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="change_duration"
                value={d}
                checked={changeDuration === d}
                onChange={() => onChange('change_duration', d)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">{CRF_CHANGE_DURATION_LABELS[d]}</span>
            </label>
          ))}
        </div>
      </div>

      {changeDuration === 'temporary' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Temporary End Date *</label>
          <input
            type="date"
            value={temporaryEndDate}
            onChange={(e) => onChange('temporary_end_date', e.target.value)}
            className="input-field"
            required
          />
        </div>
      )}
    </div>
  );
}

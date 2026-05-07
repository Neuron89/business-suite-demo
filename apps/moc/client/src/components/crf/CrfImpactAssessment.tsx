'use client';

import { CRF_IMPACT_AREAS, CRF_IMPACT_AREA_LABELS } from '@moc/shared';
import type { CrfImpactItem } from '@moc/shared';

interface Props {
  items: CrfImpactItem[];
  onChange: (items: CrfImpactItem[]) => void;
  readOnly?: boolean;
}

export default function CrfImpactAssessment({ items, onChange, readOnly }: Props) {
  function toggleAffected(area: string) {
    const updated = items.map((item) =>
      item.area === area ? { ...item, affected: !item.affected, description: !item.affected ? item.description : '' } : item
    );
    onChange(updated);
  }

  function updateDescription(area: string, description: string) {
    const updated = items.map((item) =>
      item.area === area ? { ...item, description } : item
    );
    onChange(updated);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Impact Assessment</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Identify areas affected by this change and provide details.</p>

      <div className="space-y-3">
        {CRF_IMPACT_AREAS.map((area) => {
          const item = items.find((i) => i.area === area);
          const affected = item?.affected || false;
          const description = item?.description || '';

          return (
            <div key={area} className={`rounded-lg border p-3 transition-colors ${affected ? 'border-brand-300 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center gap-3">
                {readOnly ? (
                  <span className={`text-sm font-medium ${affected ? 'text-green-600' : 'text-gray-400'}`}>
                    {affected ? 'Yes' : 'No'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleAffected(area)}
                    className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${affected ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${affected ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {CRF_IMPACT_AREA_LABELS[area]}
                </span>
              </div>
              {affected && (
                <div className="mt-2 ml-15">
                  {readOnly ? (
                    description && <p className="text-sm text-gray-600 dark:text-gray-300 ml-[60px]">{description}</p>
                  ) : (
                    <textarea
                      value={description}
                      onChange={(e) => updateDescription(area, e.target.value)}
                      className="input-field text-sm ml-[60px]"
                      rows={2}
                      placeholder="Describe the impact..."
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

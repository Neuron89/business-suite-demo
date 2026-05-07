'use client';

import type { CrfPostImplVerification } from '@moc/shared';

interface Props {
  verifications: CrfPostImplVerification[];
  onChange: (verifications: CrfPostImplVerification[]) => void;
  readOnly?: boolean;
}

export default function CrfPostImplementation({ verifications, onChange, readOnly }: Props) {
  function addRow() {
    onChange([...verifications, { activity: '', verified_by: '', date: '', comments: '' }]);
  }

  function removeRow(index: number) {
    onChange(verifications.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof CrfPostImplVerification, value: string) {
    const updated = [...verifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Post-Implementation Verification</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track verification activities after implementation.</p>
        </div>
        {!readOnly && (
          <button type="button" onClick={addRow} className="btn-secondary text-sm">Add Row</button>
        )}
      </div>

      {verifications.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
          {readOnly ? 'No verification activities recorded.' : 'No verification activities yet. Click "Add Row" to begin.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Activity</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Verified By</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Comments</th>
                {!readOnly && <th className="py-2 px-3 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {verifications.map((v, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-700 dark:text-gray-200">{v.activity || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={v.activity}
                        onChange={(e) => updateRow(i, 'activity', e.target.value)}
                        className="input-field text-sm py-1"
                        placeholder="Verification activity"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{v.verified_by || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={v.verified_by}
                        onChange={(e) => updateRow(i, 'verified_by', e.target.value)}
                        className="input-field text-sm py-1"
                        placeholder="Name"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{v.date || '-'}</span>
                    ) : (
                      <input
                        type="date"
                        value={v.date}
                        onChange={(e) => updateRow(i, 'date', e.target.value)}
                        className="input-field text-sm py-1"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{v.comments || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={v.comments}
                        onChange={(e) => updateRow(i, 'comments', e.target.value)}
                        className="input-field text-sm py-1"
                        placeholder="Comments"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="py-2 px-3">
                      <button type="button" onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { CRF_IMPLEMENTATION_TASK_TYPES, CRF_IMPLEMENTATION_TASK_LABELS } from '@moc/shared';
import type { CrfImplementationTask } from '@moc/shared';

interface Props {
  tasks: CrfImplementationTask[];
  onChange: (tasks: CrfImplementationTask[]) => void;
  readOnly?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'na', label: 'N/A', color: 'bg-gray-100 text-gray-500' },
];

export default function CrfImplementationPlan({ tasks, onChange, readOnly }: Props) {
  function updateTask(index: number, field: keyof CrfImplementationTask, value: string) {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Implementation Plan</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Track implementation tasks and their progress.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Task</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Assigned To</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Target Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Completion Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, i) => {
              const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];
              return (
                <tr key={task.task_type} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-200 font-medium">
                    {CRF_IMPLEMENTATION_TASK_LABELS[task.task_type as keyof typeof CRF_IMPLEMENTATION_TASK_LABELS] || task.task_type}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{task.assigned_to || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={task.assigned_to}
                        onChange={(e) => updateTask(i, 'assigned_to', e.target.value)}
                        className="input-field text-sm py-1"
                        placeholder="Name"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{task.target_date || '-'}</span>
                    ) : (
                      <input
                        type="date"
                        value={task.target_date}
                        onChange={(e) => updateTask(i, 'target_date', e.target.value)}
                        className="input-field text-sm py-1"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-gray-600 dark:text-gray-300">{task.completion_date || '-'}</span>
                    ) : (
                      <input
                        type="date"
                        value={task.completion_date}
                        onChange={(e) => updateTask(i, 'completion_date', e.target.value)}
                        className="input-field text-sm py-1"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className={`badge ${statusInfo.color}`}>{statusInfo.label}</span>
                    ) : (
                      <select
                        value={task.status}
                        onChange={(e) => updateTask(i, 'status', e.target.value)}
                        className={`text-xs rounded border px-2 py-1 font-medium ${statusInfo.color}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

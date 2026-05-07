'use client';

import { MOC_STATUS_LABELS } from '@moc/shared';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  risk_assessment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  under_review: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  returned: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  implementing: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  dsr: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  pssr_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  pssr_complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  orc: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  ready_for_startup: 'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-400',
  awaiting_action_items: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  improvements_realized: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
  closed: 'bg-gray-200 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  const label = MOC_STATUS_LABELS[status] || status.replace(/_/g, ' ');

  return (
    <span className={`badge ${style} capitalize`}>
      {label}
    </span>
  );
}

'use client';

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

export default function RiskBadge({ level }: { level: string }) {
  const style = RISK_STYLES[level] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';

  return (
    <span className={`badge ${style} capitalize`}>
      {level}
    </span>
  );
}

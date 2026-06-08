'use client';

const statusColors: Record<string, { bg: string; text: string }> = {
  submitted: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
  under_review: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  resolved: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
  closed: { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
  returned: { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
};

const statusLabels: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
  returned: 'Returned',
};

export default function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' };

  return (
    <span
      className="badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {statusLabels[status] || status}
    </span>
  );
}

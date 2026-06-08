'use client';

const severityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
  medium: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  high: { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
  critical: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
};

export default function SeverityBadge({ severity }: { severity: string }) {
  const colors = severityColors[severity] || { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' };

  return (
    <span
      className="badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

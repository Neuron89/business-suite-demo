'use client';

import { ReactNode } from 'react';

type CalloutVariant = 'tip' | 'warning' | 'role' | 'info';

const VARIANT_STYLES: Record<CalloutVariant, { border: string; bg: string; icon: string; label: string }> = {
  tip: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon: '💡',
    label: 'Tip',
  },
  warning: {
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
    icon: '⚠',
    label: 'Warning',
  },
  role: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    icon: '👤',
    label: 'Role Note',
  },
  info: {
    border: 'border-l-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    icon: 'ℹ',
    label: 'Info',
  },
};

interface CalloutBoxProps {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
}

export default function CalloutBox({ variant = 'tip', title, children }: CalloutBoxProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <div className={`border-l-4 ${style.border} ${style.bg} rounded-r-lg p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{style.icon}</span>
        <span className="text-sm font-bold text-theme-primary">
          {title || style.label}
        </span>
      </div>
      <div className="text-sm text-theme-secondary leading-relaxed">
        {children}
      </div>
    </div>
  );
}

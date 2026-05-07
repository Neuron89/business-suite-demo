'use client';

import { ReactNode } from 'react';

interface Annotation {
  number: number;
  label: string;
}

interface AnnotatedMockupProps {
  title: string;
  annotations: Annotation[];
  children: ReactNode;
}

function CalloutCircle({ number }: { number: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0"
      style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
    >
      {number}
    </span>
  );
}

export default function AnnotatedMockup({ title, annotations, children }: AnnotatedMockupProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-bold text-theme-primary">{title}</div>

      {/* Mockup area */}
      <div className="border-2 border-dashed border-theme rounded-xl p-4 bg-page">
        {children}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {annotations.map((a) => (
          <div key={a.number} className="flex items-center gap-2">
            <CalloutCircle number={a.number} />
            <span className="text-sm text-theme-muted">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { CalloutCircle };

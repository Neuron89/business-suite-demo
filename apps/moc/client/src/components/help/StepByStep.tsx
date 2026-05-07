'use client';

interface Step {
  title: string;
  description: string;
}

interface StepByStepProps {
  steps: Step[];
}

export default function StepByStep({ steps }: StepByStepProps) {
  return (
    <div className="relative pl-8">
      {/* Connecting line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-amber-300 dark:bg-amber-500/30" />

      {steps.map((step, i) => (
        <div key={i} className="relative flex items-start gap-4 pb-6 last:pb-0">
          {/* Circle */}
          <div
            className="absolute left-[-32px] w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {i + 1}
          </div>
          <div className="pt-1">
            <div className="text-sm font-bold text-theme-primary">{step.title}</div>
            <div className="text-sm text-theme-muted mt-0.5">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

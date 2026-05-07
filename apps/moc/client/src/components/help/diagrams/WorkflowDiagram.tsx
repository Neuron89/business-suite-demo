'use client';

const STATES = [
  { id: 'draft', label: 'Draft', x: 80, y: 40, color: '#6b7280' },
  { id: 'submitted', label: 'Submitted', x: 240, y: 40, color: '#3b82f6' },
  { id: 'risk_assessment', label: 'Risk\nAssessment', x: 400, y: 40, color: '#eab308' },
  { id: 'under_review', label: 'Under\nReview', x: 560, y: 40, color: '#8b5cf6' },
  { id: 'approved', label: 'Approved', x: 400, y: 160, color: '#22c55e' },
  { id: 'rejected', label: 'Rejected', x: 240, y: 260, color: '#ef4444' },
  { id: 'returned', label: 'Returned', x: 80, y: 160, color: '#f97316' },
  { id: 'implementing', label: 'Implementing', x: 560, y: 160, color: '#06b6d4' },
  { id: 'pssr_pending', label: 'PSSR\nPending', x: 560, y: 260, color: '#f59e0b' },
  { id: 'pssr_complete', label: 'PSSR\nComplete', x: 400, y: 260, color: '#10b981' },
  { id: 'improvements_realized', label: 'Improvements\nRealized', x: 400, y: 360, color: '#14b8a6' },
  { id: 'closed', label: 'Closed', x: 560, y: 360, color: '#6b7280' },
];

const TRANSITIONS = [
  { from: 'draft', to: 'submitted', label: 'Submit' },
  { from: 'submitted', to: 'risk_assessment', label: '' },
  { from: 'risk_assessment', to: 'under_review', label: '' },
  { from: 'under_review', to: 'approved', label: 'Approve' },
  { from: 'under_review', to: 'rejected', label: 'Reject' },
  { from: 'under_review', to: 'returned', label: 'Return' },
  { from: 'returned', to: 'draft', label: 'Revise' },
  { from: 'approved', to: 'implementing', label: '' },
  { from: 'implementing', to: 'pssr_pending', label: '' },
  { from: 'pssr_pending', to: 'pssr_complete', label: 'Complete' },
  { from: 'pssr_complete', to: 'improvements_realized', label: 'Validate' },
  { from: 'improvements_realized', to: 'closed', label: 'Close' },
];

function getState(id: string) {
  return STATES.find((s) => s.id === id)!;
}

export default function WorkflowDiagram() {
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 700 420" className="w-full min-w-[500px]" style={{ maxHeight: 420 }}>
        {/* Arrows */}
        <defs>
          <marker id="wf-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-400 dark:fill-gray-500" />
          </marker>
        </defs>

        {TRANSITIONS.map((t, i) => {
          const from = getState(t.from);
          const to = getState(t.to);
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          return (
            <g key={i}>
              <line
                x1={from.x} y1={from.y + 18}
                x2={to.x} y2={to.y + 18}
                className="stroke-gray-300 dark:stroke-gray-600"
                strokeWidth={1.5}
                markerEnd="url(#wf-arrow)"
              />
              {t.label && (
                <text x={mx} y={my + 10} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={9} fontWeight={600}>
                  {t.label}
                </text>
              )}
            </g>
          );
        })}

        {/* State nodes */}
        {STATES.map((s) => (
          <g key={s.id}>
            <rect
              x={s.x - 50} y={s.y}
              width={100} height={36}
              rx={8}
              fill={s.color}
              fillOpacity={0.15}
              stroke={s.color}
              strokeWidth={2}
            />
            {s.label.includes('\n') ? (
              s.label.split('\n').map((line, li) => (
                <text key={li} x={s.x} y={s.y + 15 + li * 12} textAnchor="middle" fontSize={10} fontWeight={700} fill={s.color}>
                  {line}
                </text>
              ))
            ) : (
              <text x={s.x} y={s.y + 22} textAnchor="middle" fontSize={11} fontWeight={700} fill={s.color}>
                {s.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

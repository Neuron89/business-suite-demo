'use client';

const LANES = [
  { label: 'EHS', color: '#22c55e', y: 0 },
  { label: 'Operations', color: '#3b82f6', y: 1 },
  { label: 'QC', color: '#8b5cf6', y: 2 },
];

const STEPS = [
  { lane: 0, label: 'EHS\nReview', x: 120 },
  { lane: 1, label: 'Ops\nReview', x: 120 },
  { lane: 2, label: 'QC\nReview', x: 120 },
];

export default function ReviewProcessDiagram() {
  const laneH = 70;
  const headerW = 80;
  const totalH = LANES.length * laneH + 40;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 520 270" className="w-full min-w-[400px]" style={{ maxHeight: 270 }}>
        <defs>
          <marker id="rp-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-400 dark:fill-gray-500" />
          </marker>
        </defs>

        {/* Lane backgrounds */}
        {LANES.map((lane, i) => (
          <g key={lane.label}>
            <rect x={0} y={30 + i * laneH} width={520} height={laneH}
              className={i % 2 === 0 ? 'fill-gray-100 dark:fill-gray-800/30' : 'fill-transparent'} />
            <rect x={0} y={30 + i * laneH} width={headerW} height={laneH}
              fill={lane.color} fillOpacity={0.1} stroke={lane.color} strokeWidth={1} strokeOpacity={0.3} />
            <text x={headerW / 2} y={30 + i * laneH + laneH / 2 + 4}
              textAnchor="middle" fontSize={11} fontWeight={700} fill={lane.color}>
              {lane.label}
            </text>
          </g>
        ))}

        {/* MOC Submitted node */}
        <rect x={95} y={2} width={90} height={24} rx={6}
          className="fill-blue-500/15 stroke-blue-500" strokeWidth={1.5} />
        <text x={140} y={18} textAnchor="middle" fontSize={9} fontWeight={700} className="fill-blue-500">
          MOC Submitted
        </text>

        {/* Arrows from submitted to each lane */}
        {LANES.map((lane, i) => (
          <line key={`start-${i}`} x1={140} y1={26} x2={140} y2={30 + i * laneH + 18}
            className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} markerEnd="url(#rp-arrow)" />
        ))}

        {/* Review boxes in each lane */}
        {STEPS.map((step, i) => {
          const lane = LANES[step.lane];
          const cy = 30 + step.lane * laneH + laneH / 2;
          return (
            <g key={i}>
              <rect x={180} y={cy - 16} width={80} height={32} rx={6}
                fill={lane.color} fillOpacity={0.15} stroke={lane.color} strokeWidth={1.5} />
              {step.label.split('\n').map((line, li) => (
                <text key={li} x={220} y={cy - 4 + li * 12} textAnchor="middle" fontSize={9} fontWeight={700} fill={lane.color}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Arrows from review to approve/reject */}
        {LANES.map((lane, i) => {
          const cy = 30 + i * laneH + laneH / 2;
          return (
            <g key={`out-${i}`}>
              <line x1={260} y1={cy} x2={310} y2={cy}
                className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} markerEnd="url(#rp-arrow)" />
              {/* Approve */}
              <rect x={314} y={cy - 12} width={60} height={24} rx={5}
                className="fill-green-500/15 stroke-green-500" strokeWidth={1} />
              <text x={344} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700} className="fill-green-600 dark:fill-green-400">
                Approve
              </text>
              {/* Or reject */}
              <rect x={384} y={cy - 12} width={52} height={24} rx={5}
                className="fill-red-500/15 stroke-red-500" strokeWidth={1} />
              <text x={410} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700} className="fill-red-600 dark:fill-red-400">
                Reject
              </text>
            </g>
          );
        })}

        {/* All approved → final */}
        <line x1={444} y1={30 + laneH + laneH / 2} x2={470} y2={30 + laneH + laneH / 2}
          className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} markerEnd="url(#rp-arrow)" />
        <rect x={474} y={30 + laneH + laneH / 2 - 14} width={42} height={28} rx={6}
          className="fill-amber-500/15 stroke-amber-500" strokeWidth={1.5} />
        <text x={495} y={30 + laneH + laneH / 2 + 4} textAnchor="middle" fontSize={8} fontWeight={700}
          style={{ fill: 'var(--accent)' }}>
          Done
        </text>
      </svg>
    </div>
  );
}

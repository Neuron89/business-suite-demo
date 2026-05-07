'use client';

const LEGACY_COLORS = [
  ['#22c55e', '#22c55e', '#eab308', '#f97316', '#ef4444'],
  ['#22c55e', '#eab308', '#eab308', '#f97316', '#ef4444'],
  ['#eab308', '#eab308', '#f97316', '#f97316', '#ef4444'],
  ['#f97316', '#f97316', '#f97316', '#ef4444', '#ef4444'],
  ['#ef4444', '#ef4444', '#ef4444', '#ef4444', '#ef4444'],
];

const CRF_COLORS = [
  ['#22c55e', '#22c55e', '#eab308', '#f97316'],
  ['#22c55e', '#eab308', '#f97316', '#ef4444'],
  ['#eab308', '#f97316', '#ef4444', '#ef4444'],
  ['#f97316', '#ef4444', '#ef4444', '#ef4444'],
];

function Matrix({ title, colors, labels }: { title: string; colors: string[][]; labels: string[] }) {
  const size = colors.length;
  const cellSize = 44;
  const offset = 40;
  const w = offset + size * cellSize + 10;
  const h = offset + size * cellSize + 30;

  return (
    <div className="flex-1 min-w-[220px]">
      <div className="text-sm font-bold text-theme-primary mb-2 text-center">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 260 }}>
        {/* Y axis label */}
        <text x={6} y={offset + (size * cellSize) / 2} textAnchor="middle" fontSize={9} fontWeight={600}
          className="fill-theme-muted" transform={`rotate(-90, 6, ${offset + (size * cellSize) / 2})`}>
          Severity
        </text>

        {/* Grid */}
        {colors.map((row, ri) =>
          row.map((color, ci) => (
            <rect
              key={`${ri}-${ci}`}
              x={offset + ci * cellSize}
              y={offset + ri * cellSize}
              width={cellSize - 2}
              height={cellSize - 2}
              rx={6}
              fill={color}
              fillOpacity={0.25}
              stroke={color}
              strokeWidth={1.5}
            />
          ))
        )}

        {/* X axis labels */}
        {labels.map((l, i) => (
          <text key={`x-${i}`} x={offset + i * cellSize + cellSize / 2 - 1} y={offset + size * cellSize + 14}
            textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
            {l}
          </text>
        ))}

        {/* Y axis labels */}
        {labels.map((l, i) => (
          <text key={`y-${i}`} x={offset - 6} y={offset + i * cellSize + cellSize / 2 + 3}
            textAnchor="end" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
            {l}
          </text>
        ))}

        {/* X axis title */}
        <text x={offset + (size * cellSize) / 2} y={offset + size * cellSize + 26}
          textAnchor="middle" fontSize={9} fontWeight={600} className="fill-gray-400 dark:fill-gray-500">
          Likelihood
        </text>
      </svg>
    </div>
  );
}

export default function RiskMatrixDiagram() {
  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <Matrix
        title="Legacy 5x5 Risk Matrix"
        colors={LEGACY_COLORS}
        labels={['1', '2', '3', '4', '5']}
      />
      <Matrix
        title="CRF 4x4 Risk Matrix"
        colors={CRF_COLORS}
        labels={['1', '2', '3', '4']}
      />
    </div>
  );
}

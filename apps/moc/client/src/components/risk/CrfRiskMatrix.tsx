'use client';

import { calculateCrfRiskLevel } from '@moc/shared';
import type { CrfRiskLevel } from '@moc/shared';

/**
 * Questionnaire-based risk matrix.
 *
 * Axes map to the decision-tree inputs:
 *   Rows (Hazard):      None → L1 (1) → L1 (2+) → L2
 *   Columns (Significance): None → L0 only → L1 → L2
 *
 * Each cell shows the risk level that `calculateCrfRiskLevel` would
 * produce for that combination.  The cell matching the current answers
 * gets a highlighted ring so users can see where they sit in the matrix.
 *
 * Uses a colorblind-friendly palette (blue → yellow sequential ramp)
 * plus distinct shapes per level for redundant visual coding.
 */

interface Props {
  hazardL1: number;
  hazardL2: number;
  sigL0: number;
  sigL1: number;
  sigL2: number;
}

// Colorblind-safe palette (blue-to-orange-brown sequential ramp with high
// luminance contrast between each step).
const CB_COLORS: Record<CrfRiskLevel, string> = {
  '---': '#d1d5db', // neutral gray
  L0:    '#2166ac', // blue
  L1:    '#fee08b', // yellow
  L2:    '#f46d43', // orange
  L3:    '#9e0142', // dark magenta-red
};

// Text color that contrasts with each background
const CB_TEXT: Record<CrfRiskLevel, string> = {
  '---': '#374151',
  L0:    '#ffffff',
  L1:    '#374151',
  L2:    '#ffffff',
  L3:    '#ffffff',
};

// Distinct shape SVGs per level so the matrix is readable without color.
// Each is a 20×20 inline SVG rendered in the cell.
function LevelShape({ level, color }: { level: CrfRiskLevel; color: string }) {
  const fill = color;
  const size = 18;

  switch (level) {
    // --- : empty circle (outline only)
    case '---':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
          <circle cx="10" cy="10" r="7" fill="none" stroke={fill} strokeWidth="2" />
        </svg>
      );
    // L0 : filled circle
    case 'L0':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
          <circle cx="10" cy="10" r="7" fill={fill} />
        </svg>
      );
    // L1 : filled square
    case 'L1':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
          <rect x="3" y="3" width="14" height="14" rx="2" fill={fill} />
        </svg>
      );
    // L2 : filled triangle (pointing up)
    case 'L2':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
          <polygon points="10,2 18,17 2,17" fill={fill} />
        </svg>
      );
    // L3 : filled diamond
    case 'L3':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
          <polygon points="10,1 19,10 10,19 1,10" fill={fill} />
        </svg>
      );
  }
}

// Representative (hazL1, hazL2) pairs for each row
const HAZARD_ROWS: { label: string; hazL1: number; hazL2: number }[] = [
  { label: 'None',     hazL1: 0, hazL2: 0 },
  { label: 'L1 (×1)',  hazL1: 1, hazL2: 0 },
  { label: 'L1 (×2+)', hazL1: 2, hazL2: 0 },
  { label: 'L2',       hazL1: 0, hazL2: 1 },
];

// Representative (sigL0, sigL1, sigL2) tuples for each column
const SIG_COLS: { label: string; sigL0: number; sigL1: number; sigL2: number }[] = [
  { label: 'None',    sigL0: 0, sigL1: 0, sigL2: 0 },
  { label: 'L0 only', sigL0: 1, sigL1: 0, sigL2: 0 },
  { label: 'L1',      sigL0: 0, sigL1: 1, sigL2: 0 },
  { label: 'L2',      sigL0: 0, sigL1: 0, sigL2: 1 },
];

function currentHazardRow(hazL1: number, hazL2: number): number {
  if (hazL2 >= 1) return 3;
  if (hazL1 >= 2) return 2;
  if (hazL1 === 1) return 1;
  return 0;
}

function currentSigCol(sigL0: number, sigL1: number, sigL2: number): number {
  if (sigL2 >= 1) return 3;
  if (sigL1 >= 1) return 2;
  if (sigL0 >= 1) return 1;
  return 0;
}

function riskLevelForCell(hRow: typeof HAZARD_ROWS[number], sCol: typeof SIG_COLS[number]): CrfRiskLevel {
  return calculateCrfRiskLevel(hRow.hazL1, hRow.hazL2, sCol.sigL0, sCol.sigL1, sCol.sigL2);
}

export default function CrfRiskMatrix({ hazardL1, hazardL2, sigL0, sigL1, sigL2 }: Props) {
  const activeRow = currentHazardRow(hazardL1, hazardL2);
  const activeCol = currentSigCol(sigL0, sigL1, sigL2);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[360px]">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-300">
          {(['---', 'L0', 'L1', 'L2', 'L3'] as CrfRiskLevel[]).map((lvl) => (
            <span key={lvl} className="flex items-center gap-1.5">
              <LevelShape level={lvl} color={CB_COLORS[lvl]} />
              <span className="font-medium">{lvl}</span>
            </span>
          ))}
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 text-right text-[10px] text-gray-400 dark:text-gray-500">
                Hazard ↓ &nbsp;Significance →
              </th>
              {SIG_COLS.map((col, ci) => (
                <th
                  key={ci}
                  className={`p-2 text-center font-medium text-gray-600 dark:text-gray-300 ${ci === activeCol ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HAZARD_ROWS.map((row, ri) => (
              <tr key={ri}>
                <td
                  className={`p-2 text-right font-medium text-gray-600 dark:text-gray-300 pr-3 whitespace-nowrap ${ri === activeRow ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                >
                  {row.label}
                </td>
                {SIG_COLS.map((col, ci) => {
                  const level = riskLevelForCell(row, col);
                  const isActive = ri === activeRow && ci === activeCol;
                  const bgColor = CB_COLORS[level];
                  const textColor = CB_TEXT[level];

                  return (
                    <td
                      key={ci}
                      className={`p-2 border text-center ${isActive ? 'ring-3 ring-offset-1 ring-gray-800 dark:ring-white' : ''}`}
                      style={{
                        backgroundColor: bgColor,
                        minWidth: '70px',
                        height: '52px',
                        opacity: isActive ? 1 : 0.5,
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <LevelShape level={level} color={textColor} />
                        <span className="font-bold text-[11px]" style={{ color: textColor }}>
                          {level}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

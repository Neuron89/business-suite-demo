// US state + Canadian province + common export-destination mapping.
// Used everywhere we aggregate or filter by state so "NH", "N.H.",
// "new hampshire" all collapse to a single canonical label.

export const STATE_FULL: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
  PR: 'Puerto Rico',
  // Canadian provinces
  ON: 'Ontario', QC: 'Quebec', BC: 'British Columbia', AB: 'Alberta',
  MB: 'Manitoba', SK: 'Saskatchewan', NS: 'Nova Scotia', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island',
};

const FULL_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FULL).map(([abbr, name]) => [name.toLowerCase(), abbr])
);

// Return canonical full name. If input is unrecognized, return the trimmed
// input unchanged so we don't silently drop real country names like Mexico.
export function canonicalState(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Strip periods / multiple spaces
  const cleaned = raw.replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const upper = cleaned.toUpperCase();

  // Already full name?
  if (FULL_TO_ABBR[cleaned.toLowerCase()]) {
    return STATE_FULL[FULL_TO_ABBR[cleaned.toLowerCase()]];
  }

  // Two-letter abbreviation?
  if (upper.length === 2 && STATE_FULL[upper]) return STATE_FULL[upper];

  // Unknown — return cleaned input so countries / weird entries survive.
  return cleaned;
}

export function toStateAbbr(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = String(input).trim().replace(/\./g, '');
  const upper = cleaned.toUpperCase();
  if (upper.length === 2 && STATE_FULL[upper]) return upper;
  const abbr = FULL_TO_ABBR[cleaned.toLowerCase()];
  return abbr || null;
}

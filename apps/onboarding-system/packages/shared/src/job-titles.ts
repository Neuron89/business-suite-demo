/**
 * Canonical job-title catalog for NYCOA. Grouped by org-chart department so
 * the intake form can present a clean optgroup dropdown.
 *
 * Future use: a title here will eventually map to a default equipment +
 * access + software package via a TITLE_DEFAULTS table — that's a separate
 * structure so individual hires can still override.
 */

export interface JobTitle {
  /** Display label shown to HR + on the ticket. */
  label: string;
  /** Stable key used for downstream integrations (directory, defaults). */
  key: string;
}

export interface TitleGroup {
  /** Org-chart bucket. */
  department: string;
  titles: JobTitle[];
}

const t = (label: string): JobTitle => ({
  label,
  key: label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''),
});

export const JOB_TITLE_GROUPS: TitleGroup[] = [
  {
    department: 'Lab & R&D',
    titles: [
      t('R&D Lead Engineer'),
      t('R&D Engineer'),
      t('Lab Supervisor'),
      t('Lead Lab Technician'),
      t('Lab Technician A'),
      t('Lab Technician B'),
      t('R&D Lab Technician'),
    ],
  },
  {
    department: 'Operations',
    titles: [
      t('Operations EVP'),
      t('Sr. Director Operations / R&D'),
      t('Quality & Operations Manager'),
      t('Shift Supervisor'),
      t('Manufacturing Engineer'),
      t('Quality Foreman'),
      t('Production Specialist'),
      t('Compounding Operator A'),
      t('Compounding Operator B'),
      t('Polymer Operator A'),
      t('Polymer Operator B'),
      t('Training Specialist'),
      t('Lead Packager'),
      t('Relief Operator'),
      t('Operator'),
      t('Packager'),
    ],
  },
  {
    department: 'Shipping & Maintenance',
    titles: [
      t('Maintenance Manager'),
      t('Shipping & Warehouse Manager'),
      t('Maintenance Scheduler/Planner'),
      t('Maintenance Foreman'),
      t('Shipping/Receiving Lead Operator'),
      t('Mechanic AA'),
      t('Mechanic A'),
      t('Mechanic B'),
      t('Welder A'),
      t('Welder B'),
      t('Electrician A'),
      t('Electrician B'),
      t('Material Handler A'),
      t('Material Handler'),
      t('Janitor'),
    ],
  },
  {
    department: 'Sales & Business Development',
    titles: [
      t('Sales EVP'),
      t('VP of Sales'),
      t('Business Development Director'),
      t('Business Development Manager'),
      t('Director of Product Management'),
      t('Customer Service Lead'),
      t('Inside Sales'),
    ],
  },
  {
    department: 'Finance & Admin',
    titles: [
      t('Director of Finance'),
      t('Plant Accountant'),
      t('Accounts Payable/Admin'),
    ],
  },
  {
    department: 'EHS, HR & IT',
    titles: [
      t('EHS Manager'),
      t('EHS Specialist'),
      t('IT Specialist'),
      t('Director of HR'),
      t('HR Generalist'),
    ],
  },
];

/** Flat list, useful for validation. */
export const ALL_JOB_TITLES: JobTitle[] = JOB_TITLE_GROUPS.flatMap((g) => g.titles);
export const ALL_JOB_TITLE_LABELS = ALL_JOB_TITLES.map((t) => t.label);
export const ALL_JOB_TITLE_KEYS = ALL_JOB_TITLES.map((t) => t.key);

/** Find the department a title belongs to. */
export function departmentForTitle(label: string): string | null {
  for (const g of JOB_TITLE_GROUPS) {
    if (g.titles.some((t) => t.label === label)) return g.department;
  }
  return null;
}

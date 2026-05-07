/**
 * Identifiers for each downstream system the portal links to.
 * Adding a new module = adding a new entry here, a tile in MODULES, and an
 * `has_<key>_access` column in the directory.
 */
export const MODULE_KEYS = [
  'moc',
  'it',
  'it_test',
  'qc',
  'sds',
  'complaint',
  'iqms_chat',
  'employee_db',
  'shipping',
  'sharepoint',
  'outlook',
] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const PORTAL_ROLES = ['employee', 'manager', 'hr', 'admin'] as const;
export type PortalRole = typeof PORTAL_ROLES[number];

/**
 * Static module catalog. Each module describes a system the portal can link
 * the user to and (optionally) pull tasks from. Visibility is controlled by
 * the matching `access[<key>]` flag on the directory record.
 */
export interface ModuleDescriptor {
  key: ModuleKey;
  label: string;
  description: string;
  /** Tailwind-friendly hex used for the tile accent. */
  color: string;
  /** Single-letter glyph rendered in the tile (cheap iconography for now). */
  glyph: string;
  /** Where the tile click navigates. Resolved against env on the server. */
  urlEnvVar: string;
  /** Optional suffix appended to the resolved URL (e.g. '/test-login'). */
  pathSuffix?: string;
  /** Where to fetch tasks from for this user (optional). */
  taskSource?: 'moc' | 'it_request' | null;
  /** Roles allowed to see this tile even if no per-user flag is set. */
  alwaysVisibleTo?: PortalRole[];
  /**
   * If true, this tile shows for everyone, has no per-user access flag in the
   * directory, and is hidden from the admin access grid. Use for external
   * links (SharePoint, Outlook) that aren't gated.
   */
  external?: boolean;
  /**
   * If true, only portal admins ever see this tile. Used for IT/test
   * sandboxes that shouldn't appear on regular users' home pages.
   */
  adminOnly?: boolean;
}

export const MODULES: ModuleDescriptor[] = [
  {
    key: 'moc',
    label: 'Management of Change',
    description: 'Submit, review, and track MOC requests, PSSRs, and DSRs.',
    color: '#f59e0b',
    glyph: 'M',
    urlEnvVar: 'MOC_URL',
    taskSource: 'moc',
  },
  {
    key: 'it',
    label: 'IT Requests',
    description: 'Hardware, software, access, and onboarding tickets.',
    color: '#3b82f6',
    glyph: 'I',
    urlEnvVar: 'IT_REQUEST_URL',
    taskSource: 'it_request',
  },
  {
    key: 'it_test',
    label: 'IT Requests — Test',
    description: 'Sandbox with role-switch login (HR, Manager, EHS, IT, Employee) for walking workflows.',
    color: '#f59e0b',
    glyph: 'T',
    urlEnvVar: 'IT_REQUEST_URL',
    pathSuffix: '/test-login',
    external: true,
    adminOnly: true,
  },
  {
    key: 'complaint',
    label: 'Complaint Tracker',
    description: 'Customer complaints, RCAs, and corrective actions.',
    color: '#ef4444',
    glyph: 'C',
    urlEnvVar: 'COMPLAINT_URL',
  },
  {
    key: 'qc',
    label: 'QC Lab',
    description: 'Lab results, sample tracking, and certificates of analysis.',
    color: '#22c55e',
    glyph: 'Q',
    urlEnvVar: 'QC_LAB_URL',
  },
  {
    key: 'sds',
    label: 'SDS Portal',
    description: 'Safety data sheets and chemical inventory.',
    color: '#8b5cf6',
    glyph: 'S',
    urlEnvVar: 'SDS_PORTAL_URL',
  },
  {
    key: 'iqms_chat',
    label: 'IQMS Chat',
    description: 'Ask questions about ERP data in plain English.',
    color: '#06b6d4',
    glyph: 'A',
    urlEnvVar: 'IQMS_CHAT_URL',
  },
  {
    key: 'employee_db',
    label: 'Employee Directory',
    description: 'IT asset and onboarding source of truth.',
    color: '#0ea5e9',
    glyph: 'E',
    urlEnvVar: 'EMPLOYEE_DB_URL',
    alwaysVisibleTo: ['admin'],
  },
  {
    key: 'shipping',
    label: 'Shipping Command',
    description: 'Freight cost dashboard, rate book, and fuel surcharge tracker.',
    color: '#14b8a6',
    glyph: 'F',
    urlEnvVar: 'SHIPPING_URL',
  },
  {
    key: 'sharepoint',
    label: 'SharePoint',
    description: 'Company SharePoint site — documents, lists, and team pages.',
    color: '#0078d4',
    glyph: 'P',
    urlEnvVar: 'SHAREPOINT_URL',
    external: true,
  },
  {
    key: 'outlook',
    label: 'Outlook',
    description: 'Email and calendar.',
    color: '#0364b8',
    glyph: 'O',
    urlEnvVar: 'OUTLOOK_URL',
    external: true,
  },
];

export const TASK_SEVERITY = ['info', 'warning', 'critical'] as const;
export type TaskSeverity = typeof TASK_SEVERITY[number];

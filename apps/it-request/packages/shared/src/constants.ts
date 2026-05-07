export const REQUEST_TYPES = ['hardware', 'software', 'permission', 'access', 'onboarding', 'other'] as const;
export type RequestType = typeof REQUEST_TYPES[number];

export const REQUEST_STATUSES = ['draft', 'submitted', 'manager_review', 'it_review', 'approved', 'denied', 'in_progress', 'waiting', 'completed', 'cancelled'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const ROLES = ['employee', 'manager', 'it_admin', 'hr', 'ehs'] as const;
export type Role = typeof ROLES[number];

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  manager: 'Manager',
  it_admin: 'IT',
  hr: 'HR',
  ehs: 'EHS',
};

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type UrgencyLevel = typeof URGENCY_LEVELS[number];

export const HARDWARE_CATEGORIES = ['laptop', 'desktop', 'monitor', 'peripheral', 'mobile_device', 'other'] as const;
export type HardwareCategory = typeof HARDWARE_CATEGORIES[number];

export const LAPTOP_SIZES = ['14_inch', '16_inch'] as const;
export const LAPTOP_FEATURES = ['touchscreen', 'tablet_style', 'standard', '2_in_1'] as const;

export const PERMISSION_TYPES = ['folder_access', 'shared_mailbox', 'distribution_list', 'security_group', 'application_access', 'admin_rights', 'other'] as const;
export type PermissionType = typeof PERMISSION_TYPES[number];

export const ACCESS_LEVELS = ['read', 'read_write', 'full_control', 'owner'] as const;
export type AccessLevel = typeof ACCESS_LEVELS[number];

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern', 'temporary'] as const;
export type EmploymentType = typeof EMPLOYMENT_TYPES[number];

export const WORK_LOCATIONS = ['onsite', 'remote', 'hybrid'] as const;
export type WorkLocation = typeof WORK_LOCATIONS[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  manager_review: 'Manager Review',
  it_review: 'IT Review',
  approved: 'Approved',
  denied: 'Denied',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  submitted: '#3b82f6',
  manager_review: '#f59e0b',
  it_review: '#8b5cf6',
  approved: '#22c55e',
  denied: '#ef4444',
  in_progress: '#06b6d4',
  waiting: '#a855f7',
  completed: '#10b981',
  cancelled: '#6b7280',
};

/** Workflow stages for the kanban board (collapses 9 statuses into 4 columns). */
export const KANBAN_COLUMNS: { key: string; label: string; statuses: RequestStatus[]; color: string }[] = [
  { key: 'open',        label: 'Open',         statuses: ['submitted', 'manager_review', 'it_review', 'approved'], color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress',  statuses: ['in_progress'],                                          color: '#06b6d4' },
  { key: 'waiting',     label: 'Waiting',      statuses: ['waiting'],                                              color: '#a855f7' },
  { key: 'closed',      label: 'Closed',       statuses: ['completed', 'denied', 'cancelled'],                     color: '#10b981' },
];

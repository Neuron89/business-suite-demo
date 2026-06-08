// Roles (same as MOC system)
export const ROLES = ['admin', 'operations', 'qc'] as const;
export type Role = typeof ROLES[number];

// Complaint statuses
export const COMPLAINT_STATUSES = [
  'submitted',
  'under_review',
  'resolved',
  'closed',
  'rejected',
  'returned',
] as const;
export type ComplaintStatus = typeof COMPLAINT_STATUSES[number];

// Complaint types
export const COMPLAINT_TYPES = [
  'quality',
  'delivery',
  'packaging',
  'documentation',
  'contamination',
  'other',
] as const;
export type ComplaintType = typeof COMPLAINT_TYPES[number];

// Severity levels
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

// Status labels for display
export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
  returned: 'Returned',
};

// Complaint type labels
export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  quality: 'Quality',
  delivery: 'Delivery',
  packaging: 'Packaging',
  documentation: 'Documentation',
  contamination: 'Contamination',
  other: 'Other',
};

// Severity labels
export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Role labels
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  operations: 'Operations',
  qc: 'QC',
};

// Workflow transitions: status -> who can transition -> allowed target statuses
export const WORKFLOW_TRANSITIONS: Record<ComplaintStatus, { roles: Role[]; to: ComplaintStatus[] }> = {
  submitted: {
    roles: ['admin', 'qc'],
    to: ['under_review', 'rejected', 'returned'],
  },
  under_review: {
    roles: ['admin', 'qc'],
    to: ['resolved', 'rejected', 'returned'],
  },
  resolved: {
    roles: ['admin', 'qc'],
    to: ['closed', 'under_review'],
  },
  closed: {
    roles: ['admin'],
    to: ['under_review'],
  },
  rejected: {
    roles: ['admin'],
    to: ['under_review'],
  },
  returned: {
    roles: ['admin', 'qc', 'operations'],
    to: ['submitted', 'under_review'],
  },
};

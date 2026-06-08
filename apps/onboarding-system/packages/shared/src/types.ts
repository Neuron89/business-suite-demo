import type { RequestType, RequestStatus, Role, UrgencyLevel, HardwareCategory, PermissionType, AccessLevel, EmploymentType, WorkLocation } from './constants';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  department: string;
  manager_id: number | null;
  manager_name?: string;
  manager_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  manager_id: number | null;
}

export interface TicketCategory {
  id: number;
  name: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

export interface BaseTicket {
  id: number;
  request_number: string;
  requester_id: number;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  request_type: RequestType;
  status: RequestStatus;
  urgency: UrgencyLevel;
  title: string;
  justification: string;

  // Routing
  manager_id: number | null;
  manager_name?: string;
  manager_email?: string;
  manager_notes?: string;
  manager_decision_at?: string;
  it_admin_id?: number | null;
  it_admin_name?: string;
  it_admin_notes?: string;
  it_decision_at?: string;

  // Ticketing fields
  assignee_id?: number | null;
  assignee_name?: string;
  category_id?: number | null;
  category_name?: string;
  category_color?: string;
  due_date?: string | null;
  closed_at?: string | null;
  resolution_notes?: string;

  created_at: string;
  updated_at: string;
}

/** Backwards-compat alias — old code referred to BaseRequest. */
export type BaseRequest = BaseTicket;

export interface HardwareTicket extends BaseTicket {
  request_type: 'hardware';
  hardware_specs: {
    laptop_size?: string;
    laptop_features?: string[];
    description: string;
    quantity: number;
    preferred_brand?: string;
    current_equipment?: string;
  };
}

export interface SoftwareTicket extends BaseTicket {
  request_type: 'software';
  software_details: {
    software_name: string;
    vendor_url?: string;
    version?: string;
    license_type?: string;
    estimated_cost?: string;
    number_of_licenses: number;
    business_purpose: string;
    notes?: string;
  };
}

export interface PermissionTicket extends BaseTicket {
  request_type: 'permission';
  permission_details: {
    permission_type: PermissionType;
    resource_name: string;
    resource_path?: string;
    access_level: AccessLevel;
    duration?: string;
    current_access?: string;
    notes?: string;
  };
}

export interface AccessTicket extends BaseTicket {
  request_type: 'access';
  access_details: {
    access_type: 'shared_mailbox' | 'distribution_list' | 'teams_channel' | 'sharepoint_site' | 'network_drive' | 'other';
    resource_name: string;
    resource_email?: string;
    access_level: AccessLevel;
    duration?: string;
    notes?: string;
  };
}

export interface OnboardingTicket extends BaseTicket {
  request_type: 'onboarding';
  onboarding_details: OnboardingDetails;
}

export interface OnboardingDetails {
  full_name: string;
  preferred_name?: string;
  employee_number: string;
  badge_number: string;
  job_title: string;
  department: string;
  manager_email: string;
  manager_name?: string;
  start_date: string;
  employment_type: EmploymentType;
  work_location: WorkLocation;
  office_location?: string;
  personal_email?: string;
  phone?: string;

  // Equipment
  needs_laptop: boolean;
  laptop_preference?: '14_inch' | '16_inch' | 'desktop' | 'no_preference';
  needs_monitor: boolean;
  monitor_count?: number;
  needs_phone: boolean;
  needs_headset: boolean;
  other_equipment?: string;

  // Accounts / access
  email_alias_preference?: string;
  needs_m365: boolean;
  needs_vpn: boolean;
  software_needed: string[];
  shared_mailboxes: string[];
  distribution_lists: string[];
  security_groups: string[];
  network_drives: string[];

  // Misc
  similar_to_employee_email?: string;
  notes?: string;
}

export interface OtherTicket extends BaseTicket {
  request_type: 'other';
  other_details: {
    category: string;
    description: string;
    notes?: string;
  };
}

export type Ticket = HardwareTicket | SoftwareTicket | PermissionTicket | AccessTicket | OnboardingTicket | OtherTicket;

/** Backwards-compat alias. */
export type ITRequest = Ticket;

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketHistory {
  id: number;
  ticket_id: number;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  changed_by: number;
  changed_by_name: string;
  comment?: string;
  created_at: string;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  storage_path: string;
  created_at: string;
}

export type AccountType =
  | "domain"
  | "admin"
  | "service"
  | "shared_mailbox"
  | "third_party";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  domain: "Employee",
  admin: "Admin",
  service: "Service",
  shared_mailbox: "Shared mailbox",
  third_party: "Third-party",
};

export interface HardwareAsset {
  id: number;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  status: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  assigned_date: string | null;
  return_due_date: string | null;
  employee_id?: number | null;
  notes?: string | null;
}

export interface SoftwareSubscription {
  id: number;
  name: string;
  vendor: string | null;
  license_identifier: string | null;
  status: string;
  cost_center: string | null;
  billing_cycle: string | null;
  cost: number | null;
  renewal_date: string | null;
  assigned_date: string | null;
  employee_id: number | null;
  notes: string | null;
}

export interface DirectoryGroup {
  id: number;
  group_name: string;
  group_scope: string | null;
  group_type: string | null;
  description: string | null;
  source: string;
  employee_id?: number | null;
}

export interface UnifiNfcCard {
  card_id: string;
  card_type: string | null;
}

export interface UnifiDoor {
  id: string;
  name: string;
  full_name: string | null;
  floor: string | null;
}

export interface UnifiScheduleSlot {
  start_time: string;
  end_time: string;
}

export interface UnifiWeekSchedule {
  monday?: UnifiScheduleSlot[];
  tuesday?: UnifiScheduleSlot[];
  wednesday?: UnifiScheduleSlot[];
  thursday?: UnifiScheduleSlot[];
  friday?: UnifiScheduleSlot[];
  saturday?: UnifiScheduleSlot[];
  sunday?: UnifiScheduleSlot[];
  [day: string]: UnifiScheduleSlot[] | undefined;
}

export interface UnifiSchedule {
  id: string;
  name: string;
  type: string | null;
  week_schedule: UnifiWeekSchedule | null;
}

export interface UnifiAccessPolicy {
  policy_id: string;
  policy_name: string;
  doors: UnifiDoor[];
  schedule: UnifiSchedule | null;
}

export interface UnifiAccessInfo {
  unifi_id: string;
  status: string;
  employee_number: string | null;
  avatar_relative_path: string | null;
  phone: string | null;
  nfc_cards: UnifiNfcCard[];
  access_policies: UnifiAccessPolicy[];
}

export type NavView =
  | "users"
  | "hardware"
  | "subscriptions"
  | "devices"
  | "licenses"
  | "directory-groups"
  | "distribution-groups"
  | "access-policies"
  | "jobs";

export type ProvisioningJobKind = "onboard_defaults" | "disable_defaults";
export type ProvisioningJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "partial";

export interface ProvisioningJobStepResult {
  status?: string;
  reason?: string;
  error?: string;
  added?: string[];
  already_member?: string[];
  missing_or_failed?: string[];
  removed?: string[];
  remaining?: string[];
  removed_count?: number;
  unifi_user_id?: string;
  method?: string;
  [key: string]: unknown;
}

export interface ProvisioningJob {
  id: number;
  employee_id: number | null;
  employee_email: string | null;
  employee_name: string | null;
  kind: ProvisioningJobKind;
  status: ProvisioningJobStatus;
  attempts: number;
  max_attempts: number;
  result: Record<string, ProvisioningJobStepResult> | null;
  error: string | null;
  triggered_by: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_run_at: string | null;
}

export type DistributionGroupType =
  | "m365_unified"
  | "distribution"
  | "mail_enabled_security";

export interface DistributionGroupActor {
  employee_id: number | null;
  display_name: string | null;
  email: string | null;
  status: string | null;
  external: boolean;
}

export interface DistributionGroupSummary {
  id: number;
  m365_id: string;
  display_name: string;
  mail: string | null;
  group_type: DistributionGroupType;
  description: string | null;
  hidden_from_gal: boolean;
  member_count: number;
  owner_count: number;
  terminated_count: number;
  external_count: number;
  send_on_behalf_count: number;
  synced_at: string | null;
  flags: string[];
}

export interface DistributionGroupDetail extends DistributionGroupSummary {
  members: DistributionGroupActor[];
  owners: DistributionGroupActor[];
  send_on_behalf: DistributionGroupActor[];
  send_as_note: string;
}

export interface DistributionGroupsResponse {
  distribution_groups: DistributionGroupSummary[];
}

export interface DistributionGroupResponse {
  distribution_group: DistributionGroupDetail;
}

export interface M365Device {
  id: number;
  device_id: string;
  display_name: string | null;
  operating_system: string | null;
  compliance_state: string | null;
  last_sync_time: string | null;
  managed_by?: string | null;
}

export interface M365LicenseAssignment {
  id: number;
  sku_id: string;
  sku_part_number: string | null;
  sku_name: string | null;
  assigned_date: string | null;
}

export interface Company {
  id: number;
  name: string;
}

export interface EmployeeRecord {
  id: number;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  full_name: string;
  email: string;
  department: string | null;
  title: string | null;
  status: string;
  account_type: AccountType;
  created_at: string | null;
  updated_at: string | null;
  start_date: string | null;
  termination_date: string | null;
  birthday: string | null;
  manager_email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  extension: string | null;
  office_location: string | null;
  alternate_emails: string[];
  has_scada_account: boolean;
  scada_checked_at: string | null;
  directory_synced_at: string | null;
  directory_sync_error: string | null;
  initial_password: string | null;
  notes: string | null;
  hardware_assets: HardwareAsset[];
  software_subscriptions: SoftwareSubscription[];
  m365_devices: M365Device[];
  license_assignments: M365LicenseAssignment[];
  directory_groups: DirectoryGroup[];
  unifi_access: UnifiAccessInfo | null;
  primary_employee_id: number | null;
  linked_accounts: LinkedAccountSummary[];
}

export interface LinkedAccountSummary {
  id: number;
  email: string;
  full_name: string;
  account_type: AccountType;
  status: string;
  company_id: number | null;
}

export interface EmployeesResponse {
  employees: EmployeeRecord[];
}

export interface OffboardingTask {
  id: number;
  description: string;
  task_type: string | null;
  category: string | null;
  status: string;
  automatable: boolean;
  automation_key: string | null;
  requires_confirmation: boolean;
  completed_by: string | null;
  completed_at: string | null;
  due_date: string | null;
  notes: string | null;
}

export interface OffboardingEvent {
  id: number;
  employee_id: number;
  event_type: string;
  status: string;
  urgency: string | null;
  delegate_email: string | null;
  initiated_by: string | null;
  it_signoff_name: string | null;
  it_signoff_date: string | null;
  manager_signoff_name: string | null;
  manager_signoff_date: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  notes: string | null;
  tasks: OffboardingTask[];
}

export interface OffboardingStartOptions {
  urgency: "immediate" | "standard";
  delegate_email?: string;
  litigation_hold?: boolean;
  convert_shared_mailbox?: boolean;
  initiated_by?: string;
  notes?: string;
}

export interface OffboardingStatusResponse {
  event: OffboardingEvent;
  categories: Record<string, OffboardingTask[]>;
  progress: { total: number; completed: number };
}

// Onboarding types (same task/event shape as offboarding)
export type OnboardingTask = OffboardingTask;
export type OnboardingEvent = OffboardingEvent;

export interface OnboardingStartOptions {
  initiated_by?: string;
  notes?: string;
}

export interface OnboardingStatusResponse {
  event: OnboardingEvent;
  categories: Record<string, OnboardingTask[]>;
  progress: { total: number; completed: number };
}


import type { Role, MocStatus, MocType, AffectedArea, EhsQuestion, EhsAnswerValue, PssrCategory, ReviewDecision, CustomFieldType, StandardMocField, SkippableStep, EhsIncidentType, EhsIncidentSeverity, EhsIncidentStatus, Department, FormVersion, CrfImpactArea, CrfImplementationTaskType, ComplianceFlag } from './constants';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MocRequest {
  id: number;
  moc_number: string;
  title: string;
  description: string;
  change_type: MocType;
  status: MocStatus;
  affected_areas: AffectedArea[];
  ehs_assessment: Record<EhsQuestion, EhsAnswerValue>;
  departments_involved: Department[];
  justification: string;
  proposed_start_date: string;
  proposed_end_date: string;
  is_psm_relevant: boolean;
  emergency_change: boolean;
  compliance_flag: ComplianceFlag | null;
  additional_reviewers: string[] | null;
  template_id: number | null;
  custom_field_values: Record<string, unknown>;
  created_by: number;
  created_at: string;
  updated_at: string;
  // CRF fields (nullable — only populated for crf_v1 MOCs)
  form_version: FormVersion;
  crf_change_type: string | null;
  change_duration: string | null;
  temporary_end_date: string | null;
  impact_assessment: CrfImpactItem[] | null;
  crf_risk_answers: CrfRiskAnswers | null;
  crf_risk_level: string | null;
  implementation_tasks: CrfImplementationTask[] | null;
  post_impl_verifications: CrfPostImplVerification[] | null;
  attachment_checklist: Record<string, boolean> | null;
  // Improvement Expected / Realized
  scope_baseline: ScopeParameter[] | null;
  scope_post_change: ScopeParameter[] | null;
  scope_realized: ScopeParameter[] | null;
  // Joined fields
  creator_name?: string;
  template_name?: string;
  template_field_config?: Record<StandardMocField, FieldConfigEntry>;
  template_custom_fields?: CustomFieldDefinition[];
  template_workflow_config?: WorkflowConfig;
}

// ── Scope Validation ──────────────────────────────────────────────────

export interface ScopeParameter {
  name: string;
  value: number | null;
  unit: string;
}

// ── CRF Types ──────────────────────────────────────────────────────────

export interface CrfImpactItem {
  area: CrfImpactArea;
  affected: boolean;
  description: string;
}

export interface CrfRiskAnswers {
  hazard_l1: Record<string, boolean | null>;
  hazard_l2: Record<string, boolean | null>;
  significance_l0: Record<string, boolean | null>;
  significance_l1: Record<string, boolean | null>;
  significance_l2: Record<string, boolean | null>;
}

export interface CrfImplementationTask {
  task_type: CrfImplementationTaskType;
  assigned_to: string;
  target_date: string;
  completion_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'na';
}

export interface CrfPostImplVerification {
  activity: string;
  verified_by: string;
  date: string;
  comments: string;
}

// ── Template System ────────────────────────────────────────────────────

export interface FieldConfigEntry {
  visible: boolean;
  required: boolean;
}

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[] | null;
}

export interface WorkflowConfig {
  risk_assessment_required: boolean;
  pssr_required: boolean;
  required_reviewers: Role[];
  skip_steps: SkippableStep[];
  form_version?: FormVersion;
}

export interface MocTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  field_config: Record<StandardMocField, FieldConfigEntry>;
  custom_fields: CustomFieldDefinition[];
  workflow_config: WorkflowConfig;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export interface RiskAssessment {
  id: number;
  moc_id: number;
  hazard_description: string;
  consequences: string;
  existing_controls: string;
  severity_before: number;
  likelihood_before: number;
  risk_level_before: string;
  proposed_controls: string;
  severity_after: number;
  likelihood_after: number;
  risk_level_after: string;
  assessed_by: number;
  created_at: string;
  updated_at: string;
  assessor_name?: string;
}

export interface Review {
  id: number;
  moc_id: number;
  reviewer_id: number;
  reviewer_role: Role;
  decision: ReviewDecision;
  comments: string;
  created_at: string;
  reviewer_name?: string;
}

export interface WorkflowHistory {
  id: number;
  moc_id: number;
  from_status: MocStatus | null;
  to_status: MocStatus;
  changed_by: number;
  comment: string;
  created_at: string;
  changer_name?: string;
}

export interface PssrChecklist {
  id: number;
  moc_id: number;
  created_by: number;
  completed_at: string | null;
  created_at: string;
  items?: PssrItem[];
}

export interface PssrItem {
  id: number;
  checklist_id: number;
  category: PssrCategory;
  description: string;
  status: 'pass' | 'fail' | 'na' | 'pending';
  notes: string;
  verified_by: number | null;
  action_type?: 'pre_startup' | 'post_startup';
  action_resolved?: boolean;
  is_custom?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DsrChecklist {
  id: number;
  moc_id: number;
  created_by: number;
  completed_at: string | null;
  created_at: string;
  items?: DsrItem[];
}

export interface DsrItem {
  id: number;
  checklist_id: number;
  category: string;
  description: string;
  status: 'pass' | 'fail' | 'na' | 'pending';
  notes: string;
  verified_by: number | null;
  action_resolved: boolean;
  is_custom?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  moc_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  created_at: string;
  uploader_name?: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  changes: Record<string, unknown>;
  ip_address: string;
  created_at: string;
  user_name?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  entity_type: string;
  entity_id: number;
  is_read: boolean;
  created_at: string;
}

export interface SystemRequest {
  id: number;
  user_id: number;
  description: string;
  screenshot_data: string | null;
  page_url: string;
  status: 'new' | 'reviewed' | 'in_progress' | 'completed' | 'dismissed';
  admin_notes: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  total_mocs: number;
  open_mocs: number;
  pending_reviews: number;
  overdue_mocs: number;
  by_status: Record<string, number>;
  by_risk_level: Record<string, number>;
  recent_activity: WorkflowHistory[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'created_at' | 'updated_at'>;
  tokens: AuthTokens;
}

export interface EhsIncident {
  id: number;
  title: string;
  description: string;
  incident_type: EhsIncidentType;
  severity: EhsIncidentSeverity;
  status: EhsIncidentStatus;
  incident_date: string;
  location: string;
  affected_persons: string;
  root_cause: string;
  corrective_actions: string;
  moc_id: number | null;
  reported_by: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  reporter_name?: string;
  assignee_name?: string;
  moc_title?: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

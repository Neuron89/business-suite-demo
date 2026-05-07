import { z } from 'zod';
import {
  ROLES,
  MOC_STATUSES,
  MOC_TYPES,
  AFFECTED_AREAS,
  EHS_QUESTIONS, EHS_ANSWER_VALUES,
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  REVIEW_DECISIONS,
  PSSR_CATEGORIES,
  CUSTOM_FIELD_TYPES,
  STANDARD_MOC_FIELDS,
  SKIPPABLE_STEPS,
  EHS_INCIDENT_TYPES,
  EHS_INCIDENT_SEVERITIES,
  EHS_INCIDENT_STATUSES,
  DEPARTMENTS,
  FORM_VERSIONS,
  CRF_CHANGE_TYPES,
  CRF_CHANGE_DURATIONS,
  CRF_IMPACT_AREAS,
  CRF_IMPLEMENTATION_TASK_TYPES,
  COMPLIANCE_FLAGS,
} from './constants';

// ── Auth ────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(ROLES),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ── Users ───────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(ROLES),
  assigned_areas: z.array(z.enum(AFFECTED_AREAS)).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
  admin_access: z.boolean().optional(),
  is_approver: z.boolean().optional(),
  assigned_areas: z.array(z.enum(AFFECTED_AREAS)).optional(),
});

// ── CRF Sub-Schemas ────────────────────────────────────────────────────

const crfImpactItemSchema = z.object({
  area: z.enum(CRF_IMPACT_AREAS),
  affected: z.boolean(),
  description: z.string().default(''),
});

const crfRiskAnswersSchema = z.object({
  hazard_l1: z.record(z.string(), z.boolean().nullable()),
  hazard_l2: z.record(z.string(), z.boolean().nullable()),
  significance_l0: z.record(z.string(), z.boolean().nullable()),
  significance_l1: z.record(z.string(), z.boolean().nullable()),
  significance_l2: z.record(z.string(), z.boolean().nullable()),
});

const crfImplTaskSchema = z.object({
  task_type: z.enum(CRF_IMPLEMENTATION_TASK_TYPES),
  assigned_to: z.string().default(''),
  target_date: z.string().default(''),
  completion_date: z.string().default(''),
  status: z.enum(['pending', 'in_progress', 'completed', 'na']).default('pending'),
});

const crfPostImplSchema = z.object({
  activity: z.string().default(''),
  verified_by: z.string().default(''),
  date: z.string().default(''),
  comments: z.string().default(''),
});

// ── Scope Validation ────────────────────────────────────────────────────

export const scopeParameterSchema = z.object({
  name: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string().default(''),
});

// ── MOC Requests ────────────────────────────────────────────────────────

export const saveDraftMocSchema = z.object({
  template_id: z.number().int().positive().nullable().default(null),
  compliance_flag: z.enum(COMPLIANCE_FLAGS).nullable().optional(),
  title: z.string().max(200).default(''),
  description: z.string().default(''),
  change_type: z.enum(MOC_TYPES).nullable().optional(),
  affected_areas: z.array(z.enum(AFFECTED_AREAS)).default([]),
  ehs_assessment: z.record(z.enum(EHS_QUESTIONS), z.enum(EHS_ANSWER_VALUES)).default({}),
  departments_involved: z.array(z.enum(DEPARTMENTS)).default([]),
  justification: z.string().default(''),
  proposed_start_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  proposed_end_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  is_psm_relevant: z.boolean().default(false),
  emergency_change: z.boolean().default(false),
  purchasing_involved: z.boolean().default(false),
  npd_involved: z.boolean().default(false),
  custom_field_values: z.record(z.string(), z.unknown()).default({}),
  form_version: z.enum(FORM_VERSIONS).default('legacy'),
  crf_change_type: z.enum(CRF_CHANGE_TYPES).nullable().optional(),
  change_duration: z.enum(CRF_CHANGE_DURATIONS).nullable().optional(),
  temporary_end_date: z.string().nullable().optional(),
  impact_assessment: z.array(crfImpactItemSchema).nullable().optional(),
  crf_risk_answers: crfRiskAnswersSchema.nullable().optional(),
  implementation_tasks: z.array(crfImplTaskSchema).nullable().optional(),
  post_impl_verifications: z.array(crfPostImplSchema).nullable().optional(),
  attachment_checklist: z.record(z.string(), z.boolean()).nullable().optional(),
  scope_baseline: z.array(scopeParameterSchema).nullable().optional(),
  scope_post_change: z.array(scopeParameterSchema).nullable().optional(),
  scope_realized: z.array(scopeParameterSchema).nullable().optional(),
});

export const createMocSchema = z.object({
  template_id: z.number().int().positive().nullable().default(null),
  compliance_flag: z.enum(COMPLIANCE_FLAGS),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  change_type: z.enum(MOC_TYPES),
  affected_areas: z.array(z.enum(AFFECTED_AREAS)).default([]),
  ehs_assessment: z.record(z.enum(EHS_QUESTIONS), z.enum(EHS_ANSWER_VALUES)).default({}),
  departments_involved: z.array(z.enum(DEPARTMENTS)).default([]),
  justification: z.string().default(''),
  proposed_start_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  proposed_end_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  is_psm_relevant: z.boolean().default(false),
  emergency_change: z.boolean().default(false),
  purchasing_involved: z.boolean().default(false),
  npd_involved: z.boolean().default(false),
  custom_field_values: z.record(z.string(), z.unknown()).default({}),
  // CRF fields (all optional — legacy MOCs omit these)
  form_version: z.enum(FORM_VERSIONS).default('legacy'),
  crf_change_type: z.enum(CRF_CHANGE_TYPES).nullable().optional(),
  change_duration: z.enum(CRF_CHANGE_DURATIONS).nullable().optional(),
  temporary_end_date: z.string().nullable().optional(),
  impact_assessment: z.array(crfImpactItemSchema).nullable().optional(),
  crf_risk_answers: crfRiskAnswersSchema.nullable().optional(),
  implementation_tasks: z.array(crfImplTaskSchema).nullable().optional(),
  post_impl_verifications: z.array(crfPostImplSchema).nullable().optional(),
  attachment_checklist: z.record(z.string(), z.boolean()).nullable().optional(),
  // Improvement Expected / Realized
  scope_baseline: z.array(scopeParameterSchema).nullable().optional(),
  scope_post_change: z.array(scopeParameterSchema).nullable().optional(),
  scope_realized: z.array(scopeParameterSchema).nullable().optional(),
});

export const updateMocSchema = createMocSchema.partial();

export const updateMocAdminFieldsSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  moc_number: z.string().regex(/^MOC-\d{4}-\d{3}-(L0|L1|L2|L3)$/, 'MOC number must be in MOC-YYYY-NNN-LEVEL format').optional(),
});

export const mocFilterSchema = z.object({
  status: z.enum(MOC_STATUSES).optional(),
  change_type: z.enum(MOC_TYPES).optional(),
  exclude_status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Risk Assessment ─────────────────────────────────────────────────────

export const createRiskAssessmentSchema = z.object({
  moc_id: z.number().int().positive(),
  hazard_description: z.string().min(1),
  consequences: z.string().min(1),
  existing_controls: z.string().default(''),
  severity_before: z.number().refine((n) => (SEVERITY_LEVELS as readonly number[]).includes(n)),
  likelihood_before: z.number().refine((n) => (LIKELIHOOD_LEVELS as readonly number[]).includes(n)),
  proposed_controls: z.string().min(1),
  severity_after: z.number().refine((n) => (SEVERITY_LEVELS as readonly number[]).includes(n)),
  likelihood_after: z.number().refine((n) => (LIKELIHOOD_LEVELS as readonly number[]).includes(n)),
});

export const updateRiskAssessmentSchema = createRiskAssessmentSchema.omit({ moc_id: true }).partial();

// ── Reviews ─────────────────────────────────────────────────────────────

export const createReviewSchema = z.object({
  moc_id: z.number().int().positive(),
  decision: z.enum(REVIEW_DECISIONS),
  comments: z.string().default(''),
});

// ── PSSR ────────────────────────────────────────────────────────────────

export const createPssrChecklistSchema = z.object({
  moc_id: z.number().int().positive(),
});

export const updatePssrItemSchema = z.object({
  status: z.enum(['pass', 'fail', 'na', 'pending']),
  notes: z.string().default(''),
  verified_by: z.number().int().positive().optional(),
  action_resolved: z.boolean().optional(),
  action_type: z.enum(['pre_startup', 'post_startup']).optional(),
  assigned_to: z.number().int().positive().nullable().optional(),
});

// ── System Requests ─────────────────────────────────────────────────────

export const createSystemRequestSchema = z.object({
  description: z.string().min(1).max(2000),
  screenshot_data: z.string().nullable().optional(),
  page_url: z.string().min(1).max(500),
});

export const updateSystemRequestSchema = z.object({
  status: z.enum(['new', 'reviewed', 'in_progress', 'completed', 'dismissed']),
  admin_notes: z.string().max(2000).optional(),
});

// ── Workflow ────────────────────────────────────────────────────────────

export const transitionSchema = z.object({
  moc_id: z.number().int().positive(),
  to_status: z.enum(MOC_STATUSES),
  comment: z.string().default(''),
});

// ── Templates ──────────────────────────────────────────────────────────

const fieldConfigEntrySchema = z.object({
  visible: z.boolean(),
  required: z.boolean(),
});

const customFieldDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string()).nullable().optional(),
});

const workflowConfigSchema = z.object({
  risk_assessment_required: z.boolean(),
  pssr_required: z.boolean(),
  required_reviewers: z.array(z.enum(ROLES)).min(1),
  skip_steps: z.array(z.enum(SKIPPABLE_STEPS)).default([]),
});

const fieldConfigSchema = z.record(
  z.enum(STANDARD_MOC_FIELDS),
  fieldConfigEntrySchema
);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(''),
  is_default: z.boolean().default(false),
  field_config: fieldConfigSchema,
  custom_fields: z.array(customFieldDefinitionSchema).default([]),
  workflow_config: workflowConfigSchema,
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ── EHS Incidents ──────────────────────────────────────────────────────

export const createEhsIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  incident_type: z.enum(EHS_INCIDENT_TYPES),
  severity: z.enum(EHS_INCIDENT_SEVERITIES),
  incident_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }),
  location: z.string().min(1).max(200),
  affected_persons: z.string().default(''),
  root_cause: z.string().default(''),
  corrective_actions: z.string().default(''),
  moc_id: z.number().int().positive().nullable().default(null),
});

export const updateEhsIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  incident_type: z.enum(EHS_INCIDENT_TYPES).optional(),
  severity: z.enum(EHS_INCIDENT_SEVERITIES).optional(),
  status: z.enum(EHS_INCIDENT_STATUSES).optional(),
  incident_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  location: z.string().min(1).max(200).optional(),
  affected_persons: z.string().optional(),
  root_cause: z.string().optional(),
  corrective_actions: z.string().optional(),
  moc_id: z.number().int().positive().nullable().optional(),
  assigned_to: z.number().int().positive().nullable().optional(),
});

export const ehsIncidentFilterSchema = z.object({
  status: z.enum(EHS_INCIDENT_STATUSES).optional(),
  incident_type: z.enum(EHS_INCIDENT_TYPES).optional(),
  severity: z.enum(EHS_INCIDENT_SEVERITIES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Review Notes ────────────────────────────────────────────────────────

export const createReviewNoteSchema = z.object({
  moc_id: z.number().int().positive(),
  section_id: z.string().min(1).max(100),
  note: z.string().min(1).max(5000),
});

export const updateReviewNoteSchema = z.object({
  note: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

// ── Type exports ────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SaveDraftMocInput = z.infer<typeof saveDraftMocSchema>;
export type CreateMocInput = z.infer<typeof createMocSchema>;
export type UpdateMocInput = z.infer<typeof updateMocSchema>;
export type UpdateMocAdminFieldsInput = z.infer<typeof updateMocAdminFieldsSchema>;
export type MocFilterInput = z.infer<typeof mocFilterSchema>;
export type CreateRiskAssessmentInput = z.infer<typeof createRiskAssessmentSchema>;
export type UpdateRiskAssessmentInput = z.infer<typeof updateRiskAssessmentSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreatePssrChecklistInput = z.infer<typeof createPssrChecklistSchema>;
export type UpdatePssrItemInput = z.infer<typeof updatePssrItemSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type CreateSystemRequestInput = z.infer<typeof createSystemRequestSchema>;
export type UpdateSystemRequestInput = z.infer<typeof updateSystemRequestSchema>;
export type CreateEhsIncidentInput = z.infer<typeof createEhsIncidentSchema>;
export type UpdateEhsIncidentInput = z.infer<typeof updateEhsIncidentSchema>;
export type EhsIncidentFilterInput = z.infer<typeof ehsIncidentFilterSchema>;
export type CreateReviewNoteInput = z.infer<typeof createReviewNoteSchema>;
export type UpdateReviewNoteInput = z.infer<typeof updateReviewNoteSchema>;

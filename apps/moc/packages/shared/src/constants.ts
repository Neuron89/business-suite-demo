export const ROLES = ['super_admin', 'admin', 'ehs', 'operations', 'qc', 'moc_manager', 'maintenance', 'it', 'product_manager', 'sales', 'management', 'purchasing'] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: Role[] = ['super_admin', 'admin', 'moc_manager'];
export const SUPER_ADMIN_ROLES: Role[] = ['super_admin'];

// Roles that are auto-included in ALL MOCs regardless of affected areas
export const GLOBAL_MOC_ROLES: Role[] = ['ehs', 'moc_manager'];

// Roles included in all areas when present in departments_involved
export const ALL_AREA_ROLES: Role[] = ['maintenance'];

// Roles that can view MOC data but not take workflow actions
export const VIEW_ONLY_ROLES: Role[] = ['product_manager', 'sales'];

// All roles that should see the sidebar navigation
export const NAV_ROLES: Role[] = ['super_admin', 'admin', 'ehs', 'operations', 'qc', 'moc_manager', 'maintenance', 'it', 'product_manager', 'sales', 'management', 'purchasing'];

// Plant Manager must be included on every MOC and his approval is always required
export const REQUIRED_APPROVER_EMAIL = 'demo.manager@acme.demo';

// Departments that are always auto-added to every MOC
export const ALWAYS_REQUIRED_DEPARTMENTS: Department[] = ['management', 'ehs'];

// Users who must be emailed on every MOC regardless of department involvement
export const ALWAYS_NOTIFY_EMAILS: string[] = ['demo.manager@acme.demo', 'demo.manager@acme.demo'];

export const MOC_STATUSES = [
  'draft',
  'submitted',
  'risk_assessment',
  'under_review',
  'approved',
  'rejected',
  'returned',
  'implementing',
  'dsr',
  'pssr_pending',
  'pssr_complete',
  'orc',
  'ready_for_startup',
  'awaiting_action_items',
  'improvements_realized',
  'closed',
] as const;
export type MocStatus = (typeof MOC_STATUSES)[number];

export const MOC_TYPES = [
  'process_change',
  'equipment_change',
  'chemical_change',
  'procedure_change',
  'facility_change',
  'technology_change',
  'organizational_change',
] as const;
export type MocType = (typeof MOC_TYPES)[number];

// Compliance flag — type of change classification (shown at top of form)
export const COMPLIANCE_FLAGS = ['emergency', 'temporary', 'permanent'] as const;
export type ComplianceFlag = (typeof COMPLIANCE_FLAGS)[number];

export const COMPLIANCE_FLAG_LABELS: Record<ComplianceFlag, string> = {
  emergency: 'Emergency',
  temporary: 'Temporary',
  permanent: 'Permanent',
};

export const COMPLIANCE_FLAG_COLORS: Record<ComplianceFlag, string> = {
  emergency: '#ef4444',
  temporary: '#f59e0b',
  permanent: '#3b82f6',
};

export const AFFECTED_AREAS = [
  'batch',
  'zimmer',
  'compounding',
  'general_plant',
  'dryers',
  'maintenance',
  'packaging',
  'warehouse',
  'utilities',
  'exterior',
  'front_office',
  'lab',
  'r_and_d',
] as const;
export type AffectedArea = (typeof AFFECTED_AREAS)[number];

export const AFFECTED_AREA_LABELS: Record<AffectedArea, string> = {
  batch: 'Batch',
  zimmer: 'Zimmer',
  compounding: 'Compounding',
  general_plant: 'General Plant',
  dryers: 'Dryers',
  maintenance: 'Maintenance',
  packaging: 'Packaging',
  warehouse: 'Warehouse',
  utilities: 'Utilities',
  exterior: 'Exterior',
  front_office: 'Front Office',
  lab: 'Lab',
  r_and_d: 'R&D',
};

// Maps affected areas to departments that should be involved
export const AFFECTED_AREA_DEPARTMENTS: Record<AffectedArea, Department[]> = {
  batch: ['operations'],
  zimmer: ['operations'],
  compounding: ['operations'],
  general_plant: ['operations'],
  dryers: ['operations'],
  maintenance: ['maintenance'],
  packaging: ['operations'],
  warehouse: ['operations'],
  utilities: ['maintenance', 'engineering'],
  exterior: ['maintenance'],
  front_office: [],
  lab: ['qc'],
  r_and_d: ['qc', 'engineering'],
};

// ── Risk question → department mappings ─────────────────────────────────
// When a CRF risk question is answered "Yes", these departments become involved.
// EHS is always-required so it's omitted here — only non-EHS implications are mapped.
export const CRF_QUESTION_DEPARTMENTS: Record<string, Department[]> = {
  // Hazard L1
  energy: ['maintenance', 'engineering'],
  exposure: [],                          // pure EHS concern
  volume: ['operations'],
  stability: ['qc'],
  // Hazard L2
  safety_procedure_conflict: [],         // pure EHS concern
  // Significance L0
  training_needed: ['operations'],
  // Significance L1
  energy_material_balance: ['engineering', 'operations'],
  tank_vessel_change: ['maintenance', 'engineering'],
  chemical_incompatibility: ['qc'],
  hazard_mitigation_reduction: [],       // pure EHS concern
  // Significance L2
  operating_conditions: ['operations', 'engineering', 'qc'],
  equipment_limitations: ['maintenance', 'engineering'],
  critical_equipment_bypass: ['maintenance', 'engineering'],
  new_raw_material: ['qc', 'operations'],
  processing_sequences: ['operations', 'qc'],
};

// When an EHS assessment question is answered "Yes", these departments become involved.
// EHS is always-required so it's omitted. Questions not listed here are pure EHS concerns.
export const EHS_QUESTION_DEPARTMENTS: Record<string, Department[]> = {
  water_cooling: ['maintenance', 'engineering'],
  alter_pollution_control: ['engineering'],
  machine_safeguarding: ['maintenance'],
  ladders_platforms: ['maintenance'],
};

export const EHS_QUESTIONS = [
  'outside_building',
  'alter_egress',
  'waste_emissions',
  'water_cooling',
  'alter_pollution_control',
  'machine_safeguarding',
  'radiation_laser',
  'ladders_platforms',
  'non_standard_ppe',
] as const;
export type EhsQuestion = (typeof EHS_QUESTIONS)[number];

export const EHS_ANSWER_VALUES = ['yes', 'no'] as const;
export type EhsAnswerValue = (typeof EHS_ANSWER_VALUES)[number];

export const EHS_ANSWER_LABELS: Record<EhsAnswerValue, string> = {
  yes: 'Yes',
  no: 'No',
};

export const EHS_QUESTION_LABELS: Record<EhsQuestion, string> = {
  outside_building: 'Be outside the existing building?',
  alter_egress: 'Alter egress routes or facility layout?',
  waste_emissions: 'Generate waste or emissions?',
  water_cooling: 'Utilize water for cooling or other purposes?',
  alter_pollution_control: 'Require altering existing pollution control equipment?',
  machine_safeguarding: 'Require machine safeguarding specifications in the purchase order?',
  radiation_laser: 'Introduce a source of radiation including laser?',
  ladders_platforms: "Include new ladders, work platforms or working 4' above another surface?",
  non_standard_ppe: 'Require the use of PPE which is not standard?',
};

export const SEVERITY_LEVELS = [1, 2, 3, 4, 5] as const;
export const LIKELIHOOD_LEVELS = [1, 2, 3, 4, 5] as const;

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Catastrophic',
};

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

export const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

export function getRiskLevel(severity: number, likelihood: number): string {
  const score = severity * likelihood;
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
}

export const PSSR_CATEGORIES = [
  'design_and_construction',
  'valves_and_piping',
  'equipment',
  'instrument_and_electrical',
  'computer_software_and_systems',
  'operations',
  'maintenance',
  'relief_devices',
  'fire_protection_and_personnel_safety',
  'occupational_health_industrial_hygiene',
  'environmental_protection',
] as const;
export type PssrCategory = (typeof PSSR_CATEGORIES)[number];

export const PSSR_CATEGORY_LABELS: Record<PssrCategory, string> = {
  design_and_construction: 'A. Design and Construction',
  valves_and_piping: 'B. Valves and Piping',
  equipment: 'C. Equipment',
  instrument_and_electrical: 'D. Instrument and Electrical',
  computer_software_and_systems: 'E. Computer Software and Systems',
  operations: 'F. Operations',
  maintenance: 'G. Maintenance',
  relief_devices: 'H. Relief Devices',
  fire_protection_and_personnel_safety: 'I. Fire Protection and Personnel Safety Equipment',
  occupational_health_industrial_hygiene: 'J. Occupational Health / Industrial Hygiene',
  environmental_protection: 'K. Environmental Protection',
};

// DSR (Design Safety Review) categories
export const DSR_CATEGORIES = [
  'administration',
  'material_safety_regulatory',
  'pressure_vacuum_relief',
  'temperature_reaction',
  'valves_and_piping',
  'rotating_mechanical_equipment',
  'instrumentation',
  'electrical_systems',
  'fire_protection',
  'personnel_health_industrial_hygiene',
] as const;
export type DsrCategory = (typeof DSR_CATEGORIES)[number];

export const DSR_CATEGORY_LABELS: Record<DsrCategory, string> = {
  administration: 'A. Administration',
  material_safety_regulatory: 'B. Material Safety / Regulatory Status',
  pressure_vacuum_relief: 'C. Pressure / Vacuum Relief',
  temperature_reaction: 'D. Temperature / Reaction',
  valves_and_piping: 'E. Valves and Piping',
  rotating_mechanical_equipment: 'F. Rotating and Mechanical Equipment',
  instrumentation: 'G. Instrumentation',
  electrical_systems: 'H. Electrical Systems',
  fire_protection: 'I. Fire Protection',
  personnel_health_industrial_hygiene: 'J. Personnel Health & Industrial Hygiene',
};

export const REVIEW_DECISIONS = ['approved', 'rejected', 'returned'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const SYSTEM_REQUEST_STATUSES = ['new', 'reviewed', 'in_progress', 'completed', 'dismissed'] as const;
export type SystemRequestStatus = (typeof SYSTEM_REQUEST_STATUSES)[number];

// Roles required to approve before advancing past under_review
// Management is always required (Plant Manager)
export const REQUIRED_REVIEWERS: Role[] = ['ehs', 'operations', 'qc'];

// Roles eligible to be required reviewers on templates (ORC = Operations Review Committee)
export const REVIEWER_ROLES: Role[] = ['ehs', 'operations', 'qc'];

// All possible review roles including ORC (EHS can assign additional reviewers)
export const ALL_REVIEWER_ROLES: string[] = ['ehs', 'operations', 'qc', 'orc'];

export const REVIEWER_ROLE_LABELS: Record<string, string> = {
  ehs: 'EHS',
  operations: 'Operations',
  qc: 'QC / Quality',
  it: 'IT',
  orc: 'ORC (Operations Review Committee)',
  management: 'Management',
};

// Template system constants
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'textarea', 'checkbox'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const STANDARD_MOC_FIELDS = [
  'title', 'description', 'change_type', 'affected_areas',
  'ehs_assessment', 'justification', 'proposed_start_date',
  'proposed_end_date', 'is_psm_relevant', 'emergency_change',
  'departments_involved',
] as const;
export type StandardMocField = (typeof STANDARD_MOC_FIELDS)[number];

export const SKIPPABLE_STEPS = ['risk_assessment', 'pssr_pending', 'pssr_complete'] as const;
export type SkippableStep = (typeof SKIPPABLE_STEPS)[number];

// Valid workflow transitions and who can trigger them
// ── EHS Incidents ──────────────────────────────────────────────────────

export const EHS_INCIDENT_TYPES = [
  'injury', 'spill', 'near_miss', 'property_damage',
  'environmental', 'fire', 'chemical_exposure', 'other',
] as const;
export type EhsIncidentType = (typeof EHS_INCIDENT_TYPES)[number];

export const EHS_INCIDENT_SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;
export type EhsIncidentSeverity = (typeof EHS_INCIDENT_SEVERITIES)[number];

export const EHS_INCIDENT_STATUSES = ['open', 'investigating', 'corrective_action', 'closed'] as const;
export type EhsIncidentStatus = (typeof EHS_INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITY_LABELS: Record<EhsIncidentSeverity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  serious: 'Serious',
  critical: 'Critical',
};

export const INCIDENT_SEVERITY_COLORS: Record<EhsIncidentSeverity, string> = {
  minor: '#22c55e',
  moderate: '#eab308',
  serious: '#f97316',
  critical: '#ef4444',
};

export const INCIDENT_STATUS_LABELS: Record<EhsIncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  corrective_action: 'Corrective Action',
  closed: 'Closed',
};

export const INCIDENT_STATUS_COLORS: Record<EhsIncidentStatus, string> = {
  open: '#ef4444',
  investigating: '#f97316',
  corrective_action: '#eab308',
  closed: '#22c55e',
};

// ── Departments ────────────────────────────────────────────────────────

export const DEPARTMENTS = ['ehs', 'operations', 'qc', 'it', 'maintenance', 'engineering', 'management'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  ehs: 'EHS',
  operations: 'Operations',
  qc: 'QC / Quality',
  it: 'IT',
  maintenance: 'Maintenance',
  engineering: 'Engineering',
  management: 'Management',
};

// ── CRF (Change Request Form) System ─────────────────────────────────

export const FORM_VERSIONS = ['legacy', 'crf_v1'] as const;
export type FormVersion = (typeof FORM_VERSIONS)[number];

export const CRF_CHANGE_TYPES = [
  'recipe', 'process', 'product', 'equipment', 'material',
  'document', 'packaging', 'it_system', 'other',
] as const;
export type CrfChangeType = (typeof CRF_CHANGE_TYPES)[number];

export const CRF_CHANGE_TYPE_LABELS: Record<CrfChangeType, string> = {
  recipe: 'Recipe',
  process: 'Process',
  product: 'Product',
  equipment: 'Equipment',
  material: 'Material',
  document: 'Document',
  packaging: 'Packaging',
  it_system: 'IT System',
  other: 'Other',
};

export const CRF_CHANGE_DURATIONS = ['permanent', 'temporary'] as const;
export type CrfChangeDuration = (typeof CRF_CHANGE_DURATIONS)[number];

export const CRF_CHANGE_DURATION_LABELS: Record<CrfChangeDuration, string> = {
  permanent: 'Permanent',
  temporary: 'Temporary',
};

export const CRF_IMPACT_AREAS = [
  'product_quality', 'regulatory_compliance', 'ehs',
  'sops_work_instructions', 'customer_requirements', 'raw_materials_suppliers',
  'process_validation', 'equipment_tooling', 'training',
  'document_control', 'inventory_wip', 'other',
] as const;
export type CrfImpactArea = (typeof CRF_IMPACT_AREAS)[number];

export const CRF_IMPACT_AREA_LABELS: Record<CrfImpactArea, string> = {
  product_quality: 'Product Quality',
  regulatory_compliance: 'Regulatory Compliance',
  ehs: 'EHS (Environment, Health & Safety)',
  sops_work_instructions: 'SOPs / Work Instructions',
  customer_requirements: 'Customer Requirements',
  raw_materials_suppliers: 'Raw Materials / Suppliers',
  process_validation: 'Process Validation',
  equipment_tooling: 'Equipment / Tooling',
  training: 'Training',
  document_control: 'Document Control',
  inventory_wip: 'Inventory / WIP',
  other: 'Other',
};

// Hazard questions (Degree of Hazard)
export const CRF_HAZARD_L1_QUESTIONS = [
  'energy', 'exposure', 'volume', 'stability',
] as const;
export type CrfHazardL1Question = (typeof CRF_HAZARD_L1_QUESTIONS)[number];

export const CRF_HAZARD_L2_QUESTIONS = [
  'safety_procedure_conflict',
] as const;
export type CrfHazardL2Question = (typeof CRF_HAZARD_L2_QUESTIONS)[number];

export const CRF_HAZARD_QUESTION_LABELS: Record<string, string> = {
  energy: 'Does the change introduce or affect a source of potential chemical, mechanical, thermal, or electrical energy?',
  exposure: 'Does the change increase the potential for personnel exposure to hazardous material?',
  volume: 'Does change result in a 25% or greater increase in inventory or storage capacity for a reactive, flammable, or toxic material?',
  stability: 'Will the changed system introduce any materials known or suspected to be thermally, chemically or physically unstable?',
  safety_procedure_conflict: 'Does the change alter or conflict with an existing safety procedure?',
};

// Significance questions (Degree of Significance)
export const CRF_SIGNIFICANCE_L0_QUESTIONS = [
  'training_needed',
] as const;
export type CrfSignificanceL0Question = (typeof CRF_SIGNIFICANCE_L0_QUESTIONS)[number];

export const CRF_SIGNIFICANCE_L1_QUESTIONS = [
  'energy_material_balance', 'tank_vessel_change',
  'chemical_incompatibility', 'hazard_mitigation_reduction',
] as const;
export type CrfSignificanceL1Question = (typeof CRF_SIGNIFICANCE_L1_QUESTIONS)[number];

export const CRF_SIGNIFICANCE_L2_QUESTIONS = [
  'operating_conditions', 'equipment_limitations',
  'critical_equipment_bypass', 'new_raw_material', 'processing_sequences',
] as const;
export type CrfSignificanceL2Question = (typeof CRF_SIGNIFICANCE_L2_QUESTIONS)[number];

export const CRF_SIGNIFICANCE_QUESTION_LABELS: Record<string, string> = {
  training_needed: 'Does the change necessitate training for operators or technical personnel?',
  energy_material_balance: 'Does the change impact the energy balance or material balance?',
  tank_vessel_change: 'Does the change involve a tank/vessel change of service?',
  chemical_incompatibility: 'Does the change introduce materials that are chemically incompatible with materials handled in the same equipment during different sequences or campaigns?',
  hazard_mitigation_reduction: 'Does the proposed change reduce the effectiveness of existing hazard mitigation?',
  operating_conditions: 'Could change take the process outside of well understood and documented operating conditions?',
  equipment_limitations: 'Does the change involve production of chemicals in equipment not designed for that purpose or create a potential for equipment limitations being exceeded?',
  critical_equipment_bypass: 'Does the change alter and/or bypass critical equipment, critical control systems, or other safety devices?',
  new_raw_material: 'Does the change introduce a different raw material, intermediate or the production of a new molecule?',
  processing_sequences: 'Does the change reorder or alter the processing sequences?',
};

// Risk levels
export const CRF_RISK_LEVELS = ['---', 'L0', 'L1', 'L2', 'L3'] as const;
export type CrfRiskLevel = (typeof CRF_RISK_LEVELS)[number];

/** @deprecated Use getCrfRiskDescription(riskLevel, riskAnswers) for accurate labels */
export const CRF_RISK_LEVEL_LABELS: Record<CrfRiskLevel, string> = {
  '---': 'No review required',
  L0: 'Procedure/Staffing Change',
  L1: 'Procedure/Staffing Change',
  L2: 'Chemical/Equipment/Tech. Change',
  L3: 'Chemical/Equipment/Tech. Change',
};

export const CRF_RISK_LEVEL_COLORS: Record<CrfRiskLevel, string> = {
  '---': '#9ca3af',
  L0: '#22c55e',
  L1: '#eab308',
  L2: '#f97316',
  L3: '#ef4444',
};

/**
 * Calculate CRF risk level using decision-tree algorithm per spec.
 *
 * Returns the risk level and a plain-English description of which rule triggered it.
 */
export interface CrfRiskResult {
  level: CrfRiskLevel;
  reason: string;
}

export function calculateCrfRiskLevel(
  hazardL1Yeses: number,
  hazardL2Yeses: number,
  sigL0Yeses: number,
  sigL1Yeses: number,
  sigL2Yeses: number,
): CrfRiskLevel {
  const total = hazardL1Yeses + hazardL2Yeses + sigL0Yeses + sigL1Yeses + sigL2Yeses;

  // Rule 1: No "Yes" answers at all
  if (total === 0) return '---';

  // Rule 2: Only training needed (Significance L0)
  if (hazardL1Yeses === 0 && hazardL2Yeses === 0 && sigL1Yeses === 0 && sigL2Yeses === 0 && sigL0Yeses >= 1) {
    return 'L0';
  }

  // Rule 3: Hazard Level Two present (safety procedure conflict) -> minimum L2
  if (hazardL2Yeses >= 1) {
    return sigL2Yeses >= 1 ? 'L3' : 'L2';
  }

  // Rule 4: Hazard Level One count >= 2 -> minimum L2
  if (hazardL1Yeses >= 2) {
    return sigL2Yeses >= 1 ? 'L3' : 'L2';
  }

  // Rule 5: Any Significance Level Two present -> L2
  if (sigL2Yeses >= 1) return 'L2';

  // Rule 6: Single Hazard Level One -> L1
  if (hazardL1Yeses === 1) return 'L1';

  // Rule 7: Any Significance Level One present -> L1
  if (sigL1Yeses >= 1) return 'L1';

  // Fallback (shouldn't reach here with valid inputs)
  return '---';
}

/**
 * Check whether every CRF risk question has been explicitly answered (not null).
 */
export function allCrfQuestionsAnswered(answers: {
  hazard_l1: Record<string, boolean | null>;
  hazard_l2: Record<string, boolean | null>;
  significance_l0: Record<string, boolean | null>;
  significance_l1: Record<string, boolean | null>;
  significance_l2: Record<string, boolean | null>;
}): boolean {
  const check = (group: Record<string, boolean | null>, keys: readonly string[]) =>
    keys.every(k => group[k] !== null && group[k] !== undefined);
  return (
    check(answers.hazard_l1, CRF_HAZARD_L1_QUESTIONS) &&
    check(answers.hazard_l2, CRF_HAZARD_L2_QUESTIONS) &&
    check(answers.significance_l0, CRF_SIGNIFICANCE_L0_QUESTIONS) &&
    check(answers.significance_l1, CRF_SIGNIFICANCE_L1_QUESTIONS) &&
    check(answers.significance_l2, CRF_SIGNIFICANCE_L2_QUESTIONS)
  );
}

/**
 * Get a plain-English reason for the calculated risk level.
 */
export function getCrfRiskReason(
  hazardL1Yeses: number,
  hazardL2Yeses: number,
  sigL0Yeses: number,
  sigL1Yeses: number,
  sigL2Yeses: number,
): string {
  const total = hazardL1Yeses + hazardL2Yeses + sigL0Yeses + sigL1Yeses + sigL2Yeses;

  if (total === 0) return 'No "Yes" answers';

  if (hazardL1Yeses === 0 && hazardL2Yeses === 0 && sigL1Yeses === 0 && sigL2Yeses === 0 && sigL0Yeses >= 1) {
    return 'Training-only change';
  }

  if (hazardL2Yeses >= 1) {
    return sigL2Yeses >= 1
      ? 'Safety procedure conflict with major process changes'
      : 'Safety procedure conflict';
  }

  if (hazardL1Yeses >= 2) {
    return sigL2Yeses >= 1
      ? 'Multiple hazard concerns with major process changes'
      : 'Multiple hazard concerns';
  }

  if (sigL2Yeses >= 1) return 'Major process changes';

  if (hazardL1Yeses === 1) return 'Single hazard concern';

  if (sigL1Yeses >= 1) return 'Significance Level One concerns only';

  return '';
}

// ── Chemical-related question tagging ─────────────────────────────────
// Questions where a "Yes" means the change involves chemicals/hazardous materials.
// Used for HAZOP determination AND for the risk level description (Chemical vs Procedure).
export const CHEMICAL_RELATED_QUESTIONS: string[] = [
  // Hazard L1
  'energy',                  // "chemical, mechanical, thermal, or electrical energy"
  'exposure',                // "hazardous material"
  'volume',                  // "reactive, flammable, or toxic material"
  'stability',               // "thermally, chemically or physically unstable"
  // Significance L1
  'chemical_incompatibility', // "chemically incompatible"
  // Significance L2
  'equipment_limitations',   // "production of chemicals in equipment"
  'new_raw_material',        // "raw material, intermediate or new molecule"
];

// Non-chemical questions (Procedure/Staffing/Equipment — no chemical involvement):
//   safety_procedure_conflict, training_needed, energy_material_balance,
//   tank_vessel_change, hazard_mitigation_reduction, operating_conditions,
//   critical_equipment_bypass, processing_sequences

/**
 * Get the risk description based on which questions were answered "Yes".
 * The description depends on whether ANY chemical-related questions triggered,
 * not on the risk level number itself.
 *
 * - If any chemical-related question = Yes → "Chemical/Equipment/Tech. Change"
 * - If only non-chemical questions = Yes  → "Procedure/Staffing Change"
 * - If no questions answered               → "No review required"
 */
export function getCrfRiskDescription(riskLevel: CrfRiskLevel, riskAnswers?: any): string {
  if (riskLevel === '---') return 'No review required';
  if (!riskAnswers) return CRF_RISK_LEVEL_LABELS[riskLevel]; // fallback

  const allAnswers: Record<string, boolean | null> = {
    ...(riskAnswers.hazard_l1 || {}),
    ...(riskAnswers.hazard_l2 || {}),
    ...(riskAnswers.significance_l0 || {}),
    ...(riskAnswers.significance_l1 || {}),
    ...(riskAnswers.significance_l2 || {}),
  };

  const hasChemical = CHEMICAL_RELATED_QUESTIONS.some((q) => allAnswers[q] === true);
  return hasChemical ? 'Chemical/Equipment/Tech. Change' : 'Procedure/Staffing Change';
}

/**
 * Get the effective change category based on risk answers (question-driven).
 * This replaces the change-type-based category for review matrix lookups.
 */
export function getCrfChangeCategoryFromAnswers(riskLevel: CrfRiskLevel, riskAnswers?: any): CrfChangeCategory {
  if (riskLevel === '---') return 'procedure_staffing';
  if (!riskAnswers) return 'chemical_equipment_tech'; // conservative default

  const allAnswers: Record<string, boolean | null> = {
    ...(riskAnswers.hazard_l1 || {}),
    ...(riskAnswers.hazard_l2 || {}),
    ...(riskAnswers.significance_l0 || {}),
    ...(riskAnswers.significance_l1 || {}),
    ...(riskAnswers.significance_l2 || {}),
  };

  const hasChemical = CHEMICAL_RELATED_QUESTIONS.some((q) => allAnswers[q] === true);
  return hasChemical ? 'chemical_equipment_tech' : 'procedure_staffing';
}

/**
 * Determine if HAZOP review is required based on which CRF questions were answered YES.
 * HAZOP is only needed when chemical-related questions are triggered.
 */
export function isHazopRequired(riskAnswers: any): boolean {
  if (!riskAnswers) return false;
  const allAnswers: Record<string, boolean | null> = {
    ...(riskAnswers.hazard_l1 || {}),
    ...(riskAnswers.hazard_l2 || {}),
    ...(riskAnswers.significance_l0 || {}),
    ...(riskAnswers.significance_l1 || {}),
    ...(riskAnswers.significance_l2 || {}),
  };
  return CHEMICAL_RELATED_QUESTIONS.some((q) => allAnswers[q] === true);
}

/**
 * Get the actual reviews required based on risk level and question answers.
 * The change category is now derived from the questions themselves (chemical vs non-chemical),
 * not from the change type dropdown. The changeCategory parameter is kept for backward
 * compatibility but is overridden when riskAnswers are available.
 */
export function getEffectiveReviewsRequired(
  riskLevel: CrfRiskLevel,
  changeCategory: CrfChangeCategory,
  riskAnswers?: any,
): CrfReviewType[] {
  // When risk answers available, derive category from questions instead of change type
  const effectiveCategory = riskAnswers
    ? getCrfChangeCategoryFromAnswers(riskLevel, riskAnswers)
    : changeCategory;
  const baseReviews = CRF_REVIEWS_REQUIRED[riskLevel]?.[effectiveCategory] || [];
  if (!riskAnswers) return baseReviews;
  // Filter out HAZOP if no chemical-related questions were answered YES
  if (!isHazopRequired(riskAnswers)) {
    return baseReviews.filter((r) => r !== 'HAZOP');
  }
  return baseReviews;
}

// ── Department suggestions by CRF change type (no longer auto-populated) ──
export const CRF_SUGGESTED_DEPARTMENTS: Record<CrfChangeType, Department[]> = {
  recipe: ['ehs', 'operations', 'qc'],
  process: ['ehs', 'operations', 'qc'],
  product: ['ehs', 'operations', 'qc'],
  equipment: ['ehs', 'operations', 'qc', 'maintenance', 'engineering'],
  material: ['ehs', 'operations', 'qc'],
  document: ['ehs', 'operations', 'qc'],
  packaging: ['ehs', 'operations', 'qc'],
  it_system: ['ehs', 'operations', 'qc', 'it'],
  other: ['ehs', 'operations', 'qc'],
};

/** @deprecated Use CRF_SUGGESTED_DEPARTMENTS instead */
export const CRF_DEFAULT_DEPARTMENTS = CRF_SUGGESTED_DEPARTMENTS;

/**
 * Derive suggested departments from risk level + change category + risk answers.
 * Maps review types to departments:
 *   DSR -> ehs, operations, qc (base)
 *   PSSR -> + maintenance, engineering
 *   HAZOP -> + engineering
 *   ORC -> flagged separately (committee)
 */
export function getDepartmentsFromRisk(
  riskLevel: CrfRiskLevel,
  changeCategory: CrfChangeCategory,
  riskAnswers?: any,
): Department[] {
  const reviews = getEffectiveReviewsRequired(riskLevel, changeCategory, riskAnswers);
  const depts = new Set<Department>(['ehs', 'operations', 'qc']);

  if (reviews.includes('PSSR')) {
    depts.add('maintenance');
    depts.add('engineering');
  }
  if (reviews.includes('HAZOP')) {
    depts.add('engineering');
  }

  return [...depts];
}

// CRF change type to legacy change_type mapping
export const CRF_TO_LEGACY_CHANGE_TYPE: Record<CrfChangeType, MocType> = {
  recipe: 'process_change',
  process: 'process_change',
  product: 'process_change',
  equipment: 'equipment_change',
  material: 'chemical_change',
  document: 'procedure_change',
  packaging: 'process_change',
  it_system: 'technology_change',
  other: 'process_change',
};

// Change categories for reviews-required lookup
export const CRF_CHANGE_CATEGORIES = {
  procedure_staffing: ['document', 'packaging', 'other'] as CrfChangeType[],
  chemical_equipment_tech: ['recipe', 'process', 'product', 'equipment', 'material', 'it_system'] as CrfChangeType[],
};

export type CrfChangeCategory = 'procedure_staffing' | 'chemical_equipment_tech';

export function getCrfChangeCategory(changeType: CrfChangeType): CrfChangeCategory {
  if (CRF_CHANGE_CATEGORIES.procedure_staffing.includes(changeType)) return 'procedure_staffing';
  return 'chemical_equipment_tech';
}

// Reviews required matrix per risk level + change category
export type CrfReviewType = 'DSR' | 'PSSR' | 'HAZOP' | 'ORC';

export const CRF_REVIEWS_REQUIRED: Record<CrfRiskLevel, Record<CrfChangeCategory, CrfReviewType[]>> = {
  '---': {
    procedure_staffing: [],
    chemical_equipment_tech: [],
  },
  L0: {
    procedure_staffing: [],
    chemical_equipment_tech: ['DSR'],
  },
  L1: {
    procedure_staffing: ['DSR'],
    chemical_equipment_tech: ['DSR', 'PSSR'],
  },
  L2: {
    procedure_staffing: ['DSR', 'ORC'],
    chemical_equipment_tech: ['DSR', 'PSSR', 'HAZOP'],
  },
  L3: {
    procedure_staffing: ['DSR', 'ORC', 'HAZOP'],
    chemical_equipment_tech: ['DSR', 'PSSR', 'HAZOP', 'ORC'],
  },
};

// Implementation task types
export const CRF_IMPLEMENTATION_TASK_TYPES = [
  'document_updates', 'staff_training', 'communicate_stakeholders',
  'equipment_changes', 'validation_activities', 'customer_notification',
  'regulatory_notification',
] as const;
export type CrfImplementationTaskType = (typeof CRF_IMPLEMENTATION_TASK_TYPES)[number];

export const CRF_IMPLEMENTATION_TASK_LABELS: Record<CrfImplementationTaskType, string> = {
  document_updates: 'Document Updates (SOPs, Work Instructions)',
  staff_training: 'Staff Training',
  communicate_stakeholders: 'Communicate to Stakeholders',
  equipment_changes: 'Equipment Changes / Installation',
  validation_activities: 'Validation Activities',
  customer_notification: 'Customer Notification',
  regulatory_notification: 'Regulatory Notification',
};

// Attachment types
export const CRF_ATTACHMENT_TYPES = [
  'updated_sops', 'training_updates', 'orc_dsr_pssr_hazop_forms', 'other',
] as const;
export type CrfAttachmentType = (typeof CRF_ATTACHMENT_TYPES)[number];

export const CRF_ATTACHMENT_TYPE_LABELS: Record<CrfAttachmentType, string> = {
  updated_sops: 'Updated SOPs',
  training_updates: 'Training Updates',
  orc_dsr_pssr_hazop_forms: 'ORC / DSR / PSSR / HAZOP Forms',
  other: 'Other',
};

// ── Review Note Sections ─────────────────────────────────────────────

export const REVIEW_NOTE_SECTIONS: Record<string, { tab: string; label: string }> = {
  'overview.description': { tab: 'overview', label: 'Description' },
  'overview.justification': { tab: 'overview', label: 'Justification' },
  'overview.details': { tab: 'overview', label: 'Details' },
  'overview.affected_areas': { tab: 'overview', label: 'Affected Areas' },
  'overview.ehs_assessment': { tab: 'overview', label: 'EHS Assessment' },
  'overview.departments': { tab: 'overview', label: 'Departments Involved' },
  'overview.crf_details': { tab: 'overview', label: 'CRF Details' },
  'risk.questionnaire': { tab: 'risk', label: 'Risk Questionnaire' },
  'risk.matrix': { tab: 'risk', label: 'Risk Matrix' },
  'impact.assessment': { tab: 'impact', label: 'Impact Assessment' },
  'implementation.tasks': { tab: 'implementation', label: 'Implementation Tasks' },
  'post_implementation.verifications': { tab: 'post_implementation', label: 'Post-Impl Verifications' },
  'pssr.checklist': { tab: 'pssr', label: 'PSSR Checklist' },
  'workflow.approvals': { tab: 'workflow', label: 'Approval Status' },
};

export function getTabForSection(sectionId: string): string | undefined {
  return REVIEW_NOTE_SECTIONS[sectionId]?.tab;
}

export function getSectionLabel(sectionId: string): string {
  return REVIEW_NOTE_SECTIONS[sectionId]?.label || sectionId;
}

export const WORKFLOW_TRANSITIONS: Record<
  string,
  { to: MocStatus; roles: Role[] }[]
> = {
  // New flow: draft -> under_review (skip submitted)
  draft: [{ to: 'under_review', roles: ['ehs', 'operations', 'qc', 'admin', 'super_admin', 'moc_manager'] }],
  // Backward compat: submitted -> under_review (for existing MOCs)
  submitted: [
    { to: 'under_review', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // Legacy: risk_assessment step is now handled during MOC creation
  risk_assessment: [
    { to: 'under_review', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // under_review: department approval is NO LONGER a hard gate (per 2026-05-01
  // change). The named approver list is still tracked for visibility, but the
  // MOC owner / admin can advance the workflow without waiting for every
  // approver to weigh in. review.ts still auto-advances when all approve.
  under_review: [
    { to: 'dsr', roles: ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'pssr_pending', roles: ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'ready_for_startup', roles: ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'rejected', roles: ['ehs', 'operations', 'qc', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'returned', roles: ['ehs', 'operations', 'qc', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // Approved kept for backward compat with existing MOCs
  approved: [
    { to: 'pssr_pending', roles: ['operations', 'admin', 'super_admin', 'moc_manager'] },
  ],
  rejected: [
    { to: 'under_review', roles: ['ehs', 'operations', 'qc', 'admin', 'super_admin', 'moc_manager'] },
  ],
  returned: [
    { to: 'under_review', roles: ['ehs', 'operations', 'qc', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // DSR -> pssr_pending (implementation phase removed)
  // NOTE: Only MOC owner + admins can trigger this (enforced in workflow service)
  dsr: [
    { to: 'pssr_pending', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // Backward compat: existing MOCs in implementing can still advance
  implementing: [
    { to: 'pssr_pending', roles: ['operations', 'ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  pssr_pending: [
    { to: 'ready_for_startup', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  orc: [
    { to: 'ready_for_startup', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  ready_for_startup: [
    { to: 'awaiting_action_items', roles: ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'closed', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  awaiting_action_items: [
    { to: 'closed', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  // Backward compat for existing MOCs
  pssr_complete: [
    { to: 'improvements_realized', roles: ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'] },
    { to: 'ready_for_startup', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
  improvements_realized: [
    { to: 'closed', roles: ['ehs', 'admin', 'super_admin', 'moc_manager'] },
  ],
};

// Status display labels (for nice UI rendering)
export const MOC_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  risk_assessment: 'Risk Assessment',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  implementing: 'Implementing',
  dsr: 'DSR',
  pssr_pending: 'PSSR Pending',
  pssr_complete: 'PSSR Complete',
  orc: 'ORC Review',
  ready_for_startup: 'Ready for Startup',
  awaiting_action_items: 'Awaiting Action Items',
  improvements_realized: 'Improvements Realized',
  closed: 'Closed',
};

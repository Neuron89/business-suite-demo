'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createMoc, getTemplates, getMoc, saveDraft, updateDraft, submitDraft, getUserNames } from '@/lib/api';
import { MOC_TYPES, AFFECTED_AREAS, AFFECTED_AREA_LABELS, AFFECTED_AREA_DEPARTMENTS, EHS_QUESTIONS, EHS_QUESTION_LABELS, EHS_QUESTION_DEPARTMENTS, CRF_IMPACT_AREAS, CRF_IMPLEMENTATION_TASK_TYPES, CRF_ATTACHMENT_TYPES, calculateCrfRiskLevel, CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS, CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS, CRF_RISK_LEVEL_COLORS, getCrfRiskDescription, COMPLIANCE_FLAGS, COMPLIANCE_FLAG_LABELS, COMPLIANCE_FLAG_COLORS, DEPARTMENTS, DEPARTMENT_LABELS, CRF_QUESTION_DEPARTMENTS, CRF_HAZARD_QUESTION_LABELS, CRF_SIGNIFICANCE_QUESTION_LABELS, getCrfChangeCategory, ALWAYS_REQUIRED_DEPARTMENTS, allCrfQuestionsAnswered, CHEMICAL_RELATED_QUESTIONS, getEffectiveReviewsRequired } from '@moc/shared';
import type { EhsAnswerValue, CrfRiskLevel, ComplianceFlag, AffectedArea, Department } from '@moc/shared';
import type { FieldConfigEntry, CustomFieldDefinition, CrfImpactItem, CrfRiskAnswers, CrfImplementationTask, CrfPostImplVerification, ScopeParameter } from '@moc/shared';
import CrfChangeTypeSection from '@/components/crf/CrfChangeTypeSection';
import CrfImpactAssessment from '@/components/crf/CrfImpactAssessment';
import CrfRiskQuestionnaire from '@/components/crf/CrfRiskQuestionnaire';
import CrfRiskMatrix from '@/components/risk/CrfRiskMatrix';
import CrfAttachmentChecklist from '@/components/crf/CrfAttachmentChecklist';
import CrfImplementationPlan from '@/components/crf/CrfImplementationPlan';
import CrfPostImplementation from '@/components/crf/CrfPostImplementation';
import ScopeBaselineEditor from '@/components/scope/ScopeBaselineEditor';

function getDefaultCrfRiskAnswers(): CrfRiskAnswers {
  return {
    hazard_l1: { energy: null, exposure: null, volume: null, stability: null },
    hazard_l2: { safety_procedure_conflict: null },
    significance_l0: { training_needed: null },
    significance_l1: { energy_material_balance: null, tank_vessel_change: null, chemical_incompatibility: null, hazard_mitigation_reduction: null },
    significance_l2: { operating_conditions: null, equipment_limitations: null, critical_equipment_bypass: null, new_raw_material: null, processing_sequences: null },
  };
}

function getDefaultImpactAssessment(): CrfImpactItem[] {
  return CRF_IMPACT_AREAS.map((area) => ({ area, affected: false, description: '' }));
}

function getDefaultImplementationTasks(): CrfImplementationTask[] {
  return CRF_IMPLEMENTATION_TASK_TYPES.map((t) => ({
    task_type: t, assigned_to: '', target_date: '', completion_date: '', status: 'pending' as const,
  }));
}

export default function NewMocPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [existingDraftId, setExistingDraftId] = useState<number | null>(draftId ? parseInt(draftId) : null);
  const [activeDepartments, setActiveDepartments] = useState<string[]>([]);
  const [form, setForm] = useState({
    compliance_flag: '' as string,
    title: '',
    description: '',
    change_type: '' as string,
    affected_areas: [] as string[],
    ehs_assessment: {} as Record<string, EhsAnswerValue>,
    departments_involved: [] as string[],
    justification: '',
    proposed_start_date: '',
    proposed_end_date: '',
    is_psm_relevant: false,
    emergency_change: false,
    purchasing_involved: false,
    npd_involved: false,
    custom_field_values: {} as Record<string, any>,
    // CRF fields
    crf_change_type: '',
    change_duration: 'permanent',
    temporary_end_date: '',
    impact_assessment: getDefaultImpactAssessment(),
    crf_risk_answers: getDefaultCrfRiskAnswers(),
    implementation_tasks: getDefaultImplementationTasks(),
    post_impl_verifications: [] as CrfPostImplVerification[],
    attachment_checklist: Object.fromEntries(CRF_ATTACHMENT_TYPES.map((t) => [t, false])) as Record<string, boolean>,
    // Scope Validation
    scope_baseline: [] as ScopeParameter[],
  });

  // Compute risk level in real-time from risk answers
  const computedRiskLevel: CrfRiskLevel = useMemo(() => {
    const ra = form.crf_risk_answers;
    const countYeses = (answers: Record<string, boolean | null>, keys: readonly string[]) =>
      keys.reduce((n: number, k: string) => n + (answers[k] ? 1 : 0), 0);
    return calculateCrfRiskLevel(
      countYeses(ra.hazard_l1 || {}, CRF_HAZARD_L1_QUESTIONS),
      countYeses(ra.hazard_l2 || {}, CRF_HAZARD_L2_QUESTIONS),
      countYeses(ra.significance_l0 || {}, CRF_SIGNIFICANCE_L0_QUESTIONS),
      countYeses(ra.significance_l1 || {}, CRF_SIGNIFICANCE_L1_QUESTIONS),
      countYeses(ra.significance_l2 || {}, CRF_SIGNIFICANCE_L2_QUESTIONS),
    ) as CrfRiskLevel;
  }, [form.crf_risk_answers]);

  // Track whether all CRF risk questions have been explicitly answered
  const riskQuestionsComplete = useMemo(
    () => allCrfQuestionsAnswered(form.crf_risk_answers),
    [form.crf_risk_answers],
  );

  useEffect(() => {
    if (!token) return;
    getTemplates(token)
      .then((data) => {
        setTemplates(data);
        // Auto-select default template only if not loading a draft
        if (!draftId) {
          const def = data.find((t: any) => t.is_default);
          if (def) selectTemplate(def);
        }
      })
      .catch(console.error)
      .finally(() => setTemplatesLoading(false));
    // Fetch active user roles to filter department list
    getUserNames(token)
      .then((users) => {
        const roles = new Set(users.map((u: any) => u.role));
        setActiveDepartments(DEPARTMENTS.filter((d) => roles.has(d)));
      })
      .catch(console.error);
  }, [token]);

  // Load existing draft
  useEffect(() => {
    if (!token || !draftId) return;
    getMoc(token, parseInt(draftId))
      .then((moc) => {
        if (!['draft', 'rejected', 'returned'].includes(moc.status)) {
          setError('This MOC is not editable in its current state');
          return;
        }
        // Find and select the template
        if (templates.length > 0 && moc.template_id) {
          const tmpl = templates.find((t: any) => t.id === moc.template_id);
          if (tmpl) selectTemplate(tmpl);
        }
        // Parse JSONB fields
        const parseJson = (v: any) => typeof v === 'string' ? JSON.parse(v) : v;
        setForm({
          compliance_flag: moc.compliance_flag || '',
          title: moc.title || '',
          description: moc.description || '',
          change_type: moc.change_type || '',
          affected_areas: moc.affected_areas || [],
          ehs_assessment: parseJson(moc.ehs_assessment) || {},
          departments_involved: moc.departments_involved || [],
          justification: moc.justification || '',
          proposed_start_date: moc.proposed_start_date ? moc.proposed_start_date.split('T')[0] : '',
          proposed_end_date: moc.proposed_end_date ? moc.proposed_end_date.split('T')[0] : '',
          is_psm_relevant: moc.is_psm_relevant || false,
          emergency_change: moc.emergency_change || false,
          purchasing_involved: moc.purchasing_involved || false,
          npd_involved: moc.npd_involved || false,
          custom_field_values: parseJson(moc.custom_field_values) || {},
          crf_change_type: moc.crf_change_type || '',
          change_duration: moc.change_duration || 'permanent',
          temporary_end_date: moc.temporary_end_date || '',
          impact_assessment: parseJson(moc.impact_assessment) || getDefaultImpactAssessment(),
          crf_risk_answers: parseJson(moc.crf_risk_answers) || getDefaultCrfRiskAnswers(),
          implementation_tasks: parseJson(moc.implementation_tasks) || getDefaultImplementationTasks(),
          post_impl_verifications: parseJson(moc.post_impl_verifications) || [],
          attachment_checklist: parseJson(moc.attachment_checklist) || Object.fromEntries(CRF_ATTACHMENT_TYPES.map((t) => [t, false])),
          scope_baseline: parseJson(moc.scope_baseline) || [],
        });
        setExistingDraftId(moc.id);
      })
      .catch((err) => setError(err.message || 'Failed to load draft'));
  }, [token, draftId, templates]);

  function selectTemplate(t: any) {
    const fc = typeof t.field_config === 'string' ? JSON.parse(t.field_config) : t.field_config;
    const cf = typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields) : t.custom_fields;
    const wc = typeof t.workflow_config === 'string' ? JSON.parse(t.workflow_config) : t.workflow_config;
    setSelectedTemplate({ ...t, field_config: fc, custom_fields: cf || [], workflow_config: wc });
  }

  const isCrf = selectedTemplate?.workflow_config?.form_version === 'crf_v1';

  // Compute department involvement with reasons from ALL sources
  const deptReasons = useMemo(() => {
    const reasons: Record<string, string[]> = {};
    const add = (dept: string, reason: string) => {
      // Only include departments that have active users assigned
      if (activeDepartments.length > 0 && !activeDepartments.includes(dept)) return;
      if (!reasons[dept]) reasons[dept] = [];
      if (!reasons[dept].includes(reason)) reasons[dept].push(reason);
    };

    // 1. Always-required departments (Management, EHS)
    for (const dept of ALWAYS_REQUIRED_DEPARTMENTS) {
      add(dept, 'Always Required');
    }

    // 2. Affected areas → departments
    for (const area of form.affected_areas) {
      const depts = AFFECTED_AREA_DEPARTMENTS[area as AffectedArea] || [];
      for (const dept of depts) {
        add(dept, `Area: ${AFFECTED_AREA_LABELS[area as AffectedArea] || area}`);
      }
    }

    // 3. CRF risk questions → departments (per-question granularity)
    if (isCrf) {
      const allCrfAnswers: Record<string, boolean | null> = {
        ...(form.crf_risk_answers.hazard_l1 || {}),
        ...(form.crf_risk_answers.hazard_l2 || {}),
        ...(form.crf_risk_answers.significance_l0 || {}),
        ...(form.crf_risk_answers.significance_l1 || {}),
        ...(form.crf_risk_answers.significance_l2 || {}),
      };
      const crfLabels: Record<string, string> = { ...CRF_HAZARD_QUESTION_LABELS, ...CRF_SIGNIFICANCE_QUESTION_LABELS };
      for (const [q, val] of Object.entries(allCrfAnswers)) {
        if (val !== true) continue;
        const depts = CRF_QUESTION_DEPARTMENTS[q] || [];
        // Short label: first ~40 chars of the question text
        const label = crfLabels[q];
        const shortLabel = label ? (label.length > 45 ? label.slice(0, 42) + '...' : label) : q;
        for (const dept of depts) {
          add(dept, `Risk: ${shortLabel}`);
        }
      }

      // Chemical-specific EHS callout
      if (CHEMICAL_RELATED_QUESTIONS.some(q => allCrfAnswers[q] === true)) {
        add('ehs', 'Chemical Hazard');
      }

      // DSR ↔ Maintenance bidirectional rule
      if (riskQuestionsComplete && form.crf_change_type) {
        const reviewTypes = getEffectiveReviewsRequired(computedRiskLevel, getCrfChangeCategory(form.crf_change_type as any), form.crf_risk_answers);
        if (reviewTypes.includes('DSR')) {
          add('maintenance', 'DSR Required');
        }
      }
    }

    // 4. EHS assessment questions → departments
    for (const [q, val] of Object.entries(form.ehs_assessment)) {
      if (val !== 'yes') continue;
      const depts = EHS_QUESTION_DEPARTMENTS[q] || [];
      const label = EHS_QUESTION_LABELS[q as keyof typeof EHS_QUESTION_LABELS];
      const shortLabel = label ? (label.length > 45 ? label.slice(0, 42) + '...' : label) : q;
      for (const dept of depts) {
        add(dept, `EHS: ${shortLabel}`);
      }
    }

    // If maintenance is involved (from any source) → DSR will be required, tag it
    if (reasons['maintenance']) {
      add('maintenance', 'DSR Always Required');
    }

    return reasons;
  }, [form.affected_areas, form.crf_risk_answers, form.crf_change_type, form.ehs_assessment, computedRiskLevel, riskQuestionsComplete, isCrf, activeDepartments]);

  // Auto-determined departments (locked — can't be removed)
  const autoDepartments = useMemo(() => Object.keys(deptReasons), [deptReasons]);

  // Sync auto-determined departments into form state
  useEffect(() => {
    setForm(prev => {
      // Keep any manually-added departments that aren't auto-determined
      const manualExtras = prev.departments_involved.filter(d => !autoDepartments.includes(d));
      const newDepts = [...new Set([...autoDepartments, ...manualExtras])];
      // Avoid unnecessary re-render
      if (newDepts.length === prev.departments_involved.length &&
          newDepts.every(d => prev.departments_involved.includes(d))) return prev;
      return { ...prev, departments_involved: newDepts };
    });
  }, [autoDepartments]);

  function getFieldConfig(field: string): FieldConfigEntry {
    if (!selectedTemplate?.field_config?.[field]) return { visible: true, required: true };
    return selectedTemplate.field_config[field];
  }

  function isVisible(field: string): boolean {
    return getFieldConfig(field).visible;
  }

  function isRequired(field: string): boolean {
    const fc = getFieldConfig(field);
    return fc.visible && fc.required;
  }

  function toggleArray(field: 'affected_areas' | 'departments_involved', value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  }

  function handleCrfFieldChange(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload() {
    const payload: any = {
      template_id: selectedTemplate?.id || null,
      compliance_flag: form.compliance_flag || null,
      title: form.title,
      description: form.description,
      custom_field_values: form.custom_field_values,
      // Always include risk answers regardless of form version
      crf_risk_answers: form.crf_risk_answers,
      // Departments auto-assigned based on change type
      departments_involved: form.departments_involved,
    };

    if (isCrf) {
      payload.form_version = 'crf_v1';
      payload.change_type = 'process_change';
      payload.crf_change_type = form.crf_change_type || null;
      payload.change_duration = form.change_duration || null;
      payload.temporary_end_date = form.change_duration === 'temporary' ? form.temporary_end_date || null : null;
      payload.impact_assessment = form.impact_assessment;
      payload.implementation_tasks = form.implementation_tasks;
      payload.post_impl_verifications = form.post_impl_verifications;
      payload.attachment_checklist = form.attachment_checklist;
    } else {
      payload.change_type = form.change_type;
    }

    // Common visible fields
    if (isVisible('affected_areas')) payload.affected_areas = form.affected_areas;
    if (isVisible('ehs_assessment')) payload.ehs_assessment = form.ehs_assessment;
    if (isVisible('justification') && form.justification) payload.justification = form.justification;
    if (isVisible('proposed_start_date') && form.proposed_start_date) payload.proposed_start_date = form.proposed_start_date;
    if (isVisible('proposed_end_date') && form.proposed_end_date) payload.proposed_end_date = form.proposed_end_date;
    if (isVisible('is_psm_relevant')) payload.is_psm_relevant = form.is_psm_relevant;
    if (isVisible('emergency_change')) payload.emergency_change = form.emergency_change;
    // Always send involvement flags — they drive approver auto-population server-side
    payload.purchasing_involved = form.purchasing_involved;
    payload.npd_involved = form.npd_involved;

    if (form.scope_baseline.length > 0) {
      payload.scope_baseline = form.scope_baseline;
    }

    return payload;
  }

  async function handleSaveDraft() {
    if (!token) return;
    setError('');
    setSavingDraft(true);
    try {
      const payload = buildPayload();
      if (existingDraftId) {
        await updateDraft(token, existingDraftId, payload);
      } else {
        const draft = await saveDraft(token, payload);
        setExistingDraftId(draft.id);
      }
      router.push('/moc');
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  function fillTestData() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    setForm((prev) => ({
      ...prev,
      compliance_flag: 'permanent',
      title: 'Test MOC - Reactor Temperature Setpoint Change',
      description: 'Increase reactor R-201 temperature setpoint from 180\u00B0C to 195\u00B0C to improve conversion rate of monomer feed. This change affects the batch section and requires updated operating procedures.',
      change_type: 'process_change',
      affected_areas: ['batch', 'utilities'],
      ehs_assessment: {
        outside_building: 'no' as EhsAnswerValue,
        alter_egress: 'no' as EhsAnswerValue,
        waste_emissions: 'yes' as EhsAnswerValue,
        water_cooling: 'yes' as EhsAnswerValue,
        alter_pollution_control: 'no' as EhsAnswerValue,
      },
      departments_involved: ['operations', 'ehs', 'qc'],
      justification: 'Current conversion rate of 92% is below target. Lab trials at 195\u00B0C showed 96% conversion with no adverse side reactions. Expected yield improvement of ~4% will reduce raw material costs.',
      proposed_start_date: fmt(startDate),
      proposed_end_date: fmt(endDate),
      is_psm_relevant: true,
      emergency_change: false,
      crf_change_type: 'process',
      change_duration: 'permanent',
    }));
  }

  // Validate all required sections and scroll to the closest-to-bottom incomplete one
  function validateSections(): boolean {
    const incomplete: string[] = [];

    // Compliance flag (type of change) — always required
    if (!form.compliance_flag) incomplete.push('section-compliance');

    // Change details — title and description always required
    if (!form.title.trim() || !form.description.trim()) incomplete.push('section-details');

    // CRF-only sections
    if (isCrf) {
      if (!form.crf_change_type) incomplete.push('section-crf-change-type');
      if (!riskQuestionsComplete) incomplete.push('section-risk-questions');
    }

    // Affected areas — if visible and required
    if (isVisible('affected_areas') && isRequired('affected_areas') && form.affected_areas.length === 0) {
      incomplete.push('section-affected-areas');
    }

    // EHS assessment — every visible question must have a yes/no answer
    if (isVisible('ehs_assessment')) {
      const answered = EHS_QUESTIONS.every((q) => {
        const v = form.ehs_assessment[q];
        return v === 'yes' || v === 'no';
      });
      if (!answered) incomplete.push('section-ehs-assessment');
    }

    // Justification — if visible and required
    if (isVisible('justification') && isRequired('justification') && !form.justification.trim()) {
      incomplete.push('section-details');
    }

    if (incomplete.length === 0) return true;

    // Pick the closest-to-bottom incomplete section (last in DOM order)
    const lastIncomplete = incomplete[incomplete.length - 1];
    setHighlightedSection(lastIncomplete);
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedSection(null), 3000);

    const el = document.getElementById(lastIncomplete);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setError('Please complete all required sections before submitting.');
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setHighlightedSection(null);

    if (!validateSections()) return;

    setLoading(true);

    try {
      const payload = buildPayload();

      if (existingDraftId) {
        // Submit existing draft
        const moc = await submitDraft(token, existingDraftId, payload);
        router.push(`/moc/${moc.id}`);
      } else {
        // Direct submit (no draft)
        const moc = await createMoc(token, payload);
        router.push(`/moc/${moc.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create MOC');
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Template Selection
  if (!selectedTemplate) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">New MOC Request</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Select a template to get started.</p>

        {templatesLoading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading templates...</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No templates available. Please contact an administrator.</p>
            <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((t) => {
              const wc = typeof t.workflow_config === 'string' ? JSON.parse(t.workflow_config) : t.workflow_config;
              const isCrfTemplate = wc?.form_version === 'crf_v1';
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="card text-left hover:ring-2 hover:ring-brand-500 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t.name}</h3>
                    <div className="flex gap-1">
                      {t.is_default && <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-xs">Default</span>}
                      {isCrfTemplate && <span className="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs">CRF</span>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t.description || 'No description'}</p>
                  <div className="flex gap-2 flex-wrap">
                    {!wc?.risk_assessment_required && <span className="text-xs badge bg-yellow-100 text-yellow-700">No Risk Assessment</span>}
                    {!wc?.pssr_required && <span className="text-xs badge bg-yellow-100 text-yellow-700">No PSSR</span>}
                    <span className="text-xs badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {wc?.required_reviewers?.length || 0} reviewer{(wc?.required_reviewers?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Dynamic Form
  const customFields: CustomFieldDefinition[] = selectedTemplate.custom_fields || [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setSelectedTemplate(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {existingDraftId ? 'Edit Draft' : 'New MOC Request'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Template: <span className="font-medium text-brand-600">{selectedTemplate.name}</span>
            {isCrf && <span className="ml-2 badge bg-indigo-100 text-indigo-700 text-xs">CRF</span>}
            {existingDraftId && <span className="ml-2 badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">Draft #{existingDraftId}</span>}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">{error}</div>
        )}

        <button
          type="button"
          onClick={fillTestData}
          className="text-xs px-3 py-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          Fill Test Data
        </button>

        {/* Compliance Flag — always at the top */}
        <div id="section-compliance" className={`card transition-all duration-500 ${highlightedSection === 'section-compliance' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Type of Change *</h2>
          <div className="flex gap-3">
            {COMPLIANCE_FLAGS.map((flag) => (
              <label
                key={flag}
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                  form.compliance_flag === flag
                    ? 'border-current shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                style={form.compliance_flag === flag ? { borderColor: COMPLIANCE_FLAG_COLORS[flag], color: COMPLIANCE_FLAG_COLORS[flag] } : undefined}
              >
                <input
                  type="radio"
                  name="compliance_flag"
                  value={flag}
                  checked={form.compliance_flag === flag}
                  onChange={(e) => setForm({ ...form, compliance_flag: e.target.value })}
                  className="sr-only"
                  required
                />
                <div className="font-bold text-lg">{COMPLIANCE_FLAG_LABELS[flag]}</div>
                <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                  {flag === 'emergency' && 'Urgent change requiring expedited review'}
                  {flag === 'temporary' && 'Time-limited change with reversion plan'}
                  {flag === 'permanent' && 'Permanent modification to operations'}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div id="section-details" className={`card space-y-5 transition-all duration-500 ${highlightedSection === 'section-details' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Change Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="Brief title for this change request"
              required
              maxLength={200}
            />
          </div>

          {/* Legacy: Change Type dropdown */}
          {!isCrf && isVisible('change_type') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Change Type {isRequired('change_type') ? '*' : ''}
              </label>
              <select
                value={form.change_type}
                onChange={(e) => setForm({ ...form, change_type: e.target.value })}
                className="input-field"
                required={isRequired('change_type')}
              >
                <option value="">Select type...</option>
                {MOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              rows={4}
              placeholder="Detailed description of the proposed change"
              required
            />
          </div>

          {isVisible('justification') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Justification {isRequired('justification') ? '*' : ''}
              </label>
              <textarea
                value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Why is this change necessary?"
                required={isRequired('justification')}
              />
            </div>
          )}

          {(isVisible('proposed_start_date') || isVisible('proposed_end_date')) && (
            <div className="grid grid-cols-2 gap-4">
              {isVisible('proposed_start_date') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Proposed Start Date {isRequired('proposed_start_date') ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    value={form.proposed_start_date}
                    onChange={(e) => setForm({ ...form, proposed_start_date: e.target.value })}
                    className="input-field"
                    required={isRequired('proposed_start_date')}
                  />
                </div>
              )}
              {isVisible('proposed_end_date') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Proposed End Date {isRequired('proposed_end_date') ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    value={form.proposed_end_date}
                    onChange={(e) => setForm({ ...form, proposed_end_date: e.target.value })}
                    className="input-field"
                    required={isRequired('proposed_end_date')}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* CRF: Change Type Section */}
        {isCrf && (
          <div id="section-crf-change-type" className={`transition-all duration-500 ${highlightedSection === 'section-crf-change-type' ? 'ring-2 ring-amber-500 rounded-xl' : ''}`}>
            <CrfChangeTypeSection
              changeType={form.crf_change_type}
              changeDuration={form.change_duration}
              temporaryEndDate={form.temporary_end_date}
              onChange={handleCrfFieldChange}
            />
          </div>
        )}

        {/* CRF: Impact Assessment */}
        {isCrf && (
          <CrfImpactAssessment
            items={form.impact_assessment}
            onChange={(items) => setForm({ ...form, impact_assessment: items })}
          />
        )}

        {/* Risk Questionnaire — always visible for ALL MOCs */}
        <div id="section-risk-questions" className={`transition-all duration-500 ${highlightedSection === 'section-risk-questions' ? 'ring-2 ring-amber-500 rounded-xl' : ''}`}>
          <CrfRiskQuestionnaire
            answers={form.crf_risk_answers}
            onChange={(answers) => setForm({ ...form, crf_risk_answers: answers })}
            changeType={form.crf_change_type || undefined}
          />
          {/* Real-time risk level badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Calculated Risk Level:</span>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[computedRiskLevel] }}
            >
              {computedRiskLevel} &mdash; {getCrfRiskDescription(computedRiskLevel, form.crf_risk_answers)}
            </span>
          </div>
        </div>

        {/* Risk Matrix Visual */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Risk Matrix</h2>
          <CrfRiskMatrix
            hazardL1={(() => { const ra = form.crf_risk_answers; return CRF_HAZARD_L1_QUESTIONS.reduce((n, k) => n + (ra.hazard_l1[k] ? 1 : 0), 0); })()}
            hazardL2={(() => { const ra = form.crf_risk_answers; return CRF_HAZARD_L2_QUESTIONS.reduce((n, k) => n + (ra.hazard_l2[k] ? 1 : 0), 0); })()}
            sigL0={(() => { const ra = form.crf_risk_answers; return CRF_SIGNIFICANCE_L0_QUESTIONS.reduce((n, k) => n + (ra.significance_l0[k] ? 1 : 0), 0); })()}
            sigL1={(() => { const ra = form.crf_risk_answers; return CRF_SIGNIFICANCE_L1_QUESTIONS.reduce((n, k) => n + (ra.significance_l1[k] ? 1 : 0), 0); })()}
            sigL2={(() => { const ra = form.crf_risk_answers; return CRF_SIGNIFICANCE_L2_QUESTIONS.reduce((n, k) => n + (ra.significance_l2[k] ? 1 : 0), 0); })()}
          />
        </div>

        {/* CRF: Attachment Checklist */}
        {isCrf && (
          <CrfAttachmentChecklist
            checklist={form.attachment_checklist}
            onChange={(checklist) => setForm({ ...form, attachment_checklist: checklist })}
          />
        )}

        {/* CRF: Implementation Plan */}
        {isCrf && (
          <CrfImplementationPlan
            tasks={form.implementation_tasks}
            onChange={(tasks) => setForm({ ...form, implementation_tasks: tasks })}
          />
        )}

        {/* CRF: Post-Implementation Verification */}
        {isCrf && (
          <CrfPostImplementation
            verifications={form.post_impl_verifications}
            onChange={(v) => setForm({ ...form, post_impl_verifications: v })}
          />
        )}

        {/* Affected Areas — shown for all MOC types */}
        {isVisible('affected_areas') && (
          <div id="section-affected-areas" className={`card transition-all duration-500 ${highlightedSection === 'section-affected-areas' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Affected Areas {isRequired('affected_areas') ? '*' : ''}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AFFECTED_AREAS.map((area) => (
                <label key={area} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-2">
                  <input
                    type="checkbox"
                    checked={form.affected_areas.includes(area)}
                    onChange={() => toggleArray('affected_areas', area)}
                    className="mr-2 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{AFFECTED_AREA_LABELS[area as keyof typeof AFFECTED_AREA_LABELS] || area}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Additional Approver Involvement — Purchasing / New Product Development */}
        <div id="section-extra-approvers" className={`card transition-all duration-500 ${highlightedSection === 'section-extra-approvers' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Additional Approvers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Check any area that will need to review this MOC so the correct people are added to the approval flow.
          </p>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.purchasing_involved}
                onChange={(e) => setForm((p) => ({ ...p, purchasing_involved: e.target.checked }))}
                className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Purchasing involvement</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Adds Purchasing Lead (Purchasing) as a required approver.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.npd_involved}
                onChange={(e) => setForm((p) => ({ ...p, npd_involved: e.target.checked }))}
                className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">New Product Development involvement</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Adds NPD Lead (NPD) as a required approver.</div>
              </div>
            </label>
          </div>
        </div>

        {/* EHS Assessment — shown for all MOC types, radio buttons */}
        {isVisible('ehs_assessment') && (
          <div id="section-ehs-assessment" className={`card transition-all duration-500 ${highlightedSection === 'section-ehs-assessment' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">EHS Assessment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Will the process or equipment change:</p>
            <div className="space-y-2">
              {EHS_QUESTIONS.map((q) => (
                <div key={q} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex gap-3 flex-shrink-0">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`ehs_${q}`}
                        checked={form.ehs_assessment[q] === 'yes'}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            ehs_assessment: { ...prev.ehs_assessment, [q]: 'yes' as EhsAnswerValue },
                          }))
                        }
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Yes</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`ehs_${q}`}
                        checked={form.ehs_assessment[q] === 'no'}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            ehs_assessment: { ...prev.ehs_assessment, [q]: 'no' as EhsAnswerValue },
                          }))
                        }
                        className="text-gray-400 focus:ring-gray-400"
                      />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">No</span>
                    </label>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">{EHS_QUESTION_LABELS[q]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Department Involvement — visual breakdown with reasons */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Department Involvement</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Departments are automatically assigned based on affected areas{isCrf ? ', risk assessment,' : ''} and system rules.
          </p>

          {/* Auto-determined departments with reasons */}
          {autoDepartments.length > 0 ? (
            <div className="space-y-2 mb-4">
              {autoDepartments.map((dept) => {
                const reasons = deptReasons[dept] || [];
                return (
                  <div
                    key={dept}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-bold">
                        {(DEPARTMENT_LABELS[dept as Department] || dept).charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                          {DEPARTMENT_LABELS[dept as Department] || dept}
                        </span>
                        <span className="text-gray-400 text-xs" title="Auto-assigned — cannot be removed">&#128274;</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {reasons.map((reason) => {
                          let color = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                          if (reason === 'Always Required') color = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
                          else if (reason === 'Risk Assessment') color = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
                          else if (reason === 'Chemical Hazard') color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                          else if (reason.startsWith('Area:')) color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
                          return (
                            <span key={reason} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                              {reason}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 italic py-3 mb-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
              {isCrf
                ? 'Select affected areas and complete risk questions to determine departments'
                : 'Select affected areas to determine departments'}
            </div>
          )}

          {/* Manually add extra departments */}
          {(() => {
            const extraDepts = DEPARTMENTS.filter(d => !autoDepartments.includes(d) && activeDepartments.includes(d));
            if (extraDepts.length === 0) return null;
            return (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Add additional departments:</p>
                <div className="flex flex-wrap gap-2">
                  {extraDepts.map((dept) => {
                    const isSelected = form.departments_involved.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleArray('departments_involved', dept)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:text-brand-600'
                        }`}
                      >
                        {isSelected ? '- ' : '+ '}{DEPARTMENT_LABELS[dept] || dept}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Scope Validation — Baseline Parameters */}
        <ScopeBaselineEditor
          parameters={form.scope_baseline}
          onChange={(params) => setForm({ ...form, scope_baseline: params })}
        />

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Additional Information</h2>
            {customFields.map((cf) => (
              <CustomFieldInput
                key={cf.id}
                field={cf}
                value={form.custom_field_values[cf.id]}
                onChange={(val) => setForm({
                  ...form,
                  custom_field_values: { ...form.custom_field_values, [cf.id]: val },
                })}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="btn-secondary"
          >
            {savingDraft ? 'Saving...' : 'Save as Draft'}
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting...' : 'Submit MOC Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: any;
  onChange: (val: any) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {field.label} {field.required ? '*' : ''}
          </label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {field.label} {field.required ? '*' : ''}
          </label>
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="input-field"
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      );
    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {field.label} {field.required ? '*' : ''}
          </label>
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            required={field.required}
          />
        </div>
      );
    case 'dropdown':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {field.label} {field.required ? '*' : ''}
          </label>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            required={field.required}
          >
            <option value="">Select...</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {field.label} {field.required ? '*' : ''}
          </label>
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            rows={3}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="mr-3 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</span>
        </label>
      );
    default:
      return null;
  }
}

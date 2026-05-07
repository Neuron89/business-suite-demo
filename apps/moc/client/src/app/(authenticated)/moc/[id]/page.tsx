'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth, isAdminUser as isAdminUserCheck } from '@/lib/auth-context';
import { getMoc, updateMoc, updateMocAdminFields, transitionMoc, submitReview, createRiskAssessment, createPssr, updatePssrItem, completePssr, signoffPssr, getPssrSignoffs, exportPssrReport, updateMocDepartments, uploadAttachment, deleteAttachment, getDownloadUrl, getPreviewUrl, exportMocPdf, getReviewNotes, exportImprovementsCsv, createDsr, updateDsrItem, completeDsr, getUserNames, addDsrCustomItem, addPssrCustomItem, reassignMoc, signoffDsr, getDsrSignoffs, exportDsrReport, assignExternalAction, getExternalAssignments, revokeExternalAssignment } from '@/lib/api';
import FilePreviewModal from '@/components/shared/FilePreviewModal';
import StatusBadge from '@/components/shared/StatusBadge';
import RiskBadge from '@/components/shared/RiskBadge';
import ReviewNotePopup from '@/components/shared/ReviewNotePopup';
import RiskMatrix from '@/components/risk/RiskMatrix';
import CrfRiskMatrix from '@/components/risk/CrfRiskMatrix';
import CrfImpactAssessment from '@/components/crf/CrfImpactAssessment';
import CrfRiskQuestionnaire from '@/components/crf/CrfRiskQuestionnaire';
import CrfImplementationPlan from '@/components/crf/CrfImplementationPlan';
import CrfPostImplementation from '@/components/crf/CrfPostImplementation';
import CrfAttachmentChecklist from '@/components/crf/CrfAttachmentChecklist';
import ScopePostChangeEditor from '@/components/scope/ScopePostChangeEditor';
import ScopeComparisonView from '@/components/scope/ScopeComparisonView';
import ImprovementsRealizedEditor from '@/components/scope/ImprovementsRealizedEditor';
import {
  WORKFLOW_TRANSITIONS, REQUIRED_REVIEWERS, SEVERITY_LABELS, LIKELIHOOD_LABELS,
  getRiskLevel, PSSR_CATEGORIES, PSSR_CATEGORY_LABELS, DSR_CATEGORIES, DSR_CATEGORY_LABELS, DEPARTMENTS, MOC_STATUSES, MOC_STATUS_LABELS, EHS_QUESTIONS, EHS_QUESTION_LABELS, DEPARTMENT_LABELS,
  CRF_CHANGE_TYPE_LABELS, CRF_CHANGE_DURATION_LABELS, CRF_RISK_LEVEL_COLORS, getCrfRiskDescription,
  getCrfChangeCategory, CRF_REVIEWS_REQUIRED, getEffectiveReviewsRequired,
  COMPLIANCE_FLAG_LABELS, COMPLIANCE_FLAG_COLORS, AFFECTED_AREA_LABELS, REVIEWER_ROLE_LABELS,
  CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS,
  CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS,
  REVIEW_NOTE_SECTIONS, getTabForSection, getSectionLabel,
  ALWAYS_REQUIRED_DEPARTMENTS,
} from '@moc/shared';
import type { EhsAnswerValue } from '@moc/shared';
import type { CrfRiskAnswers, CrfRiskLevel, CrfChangeType } from '@moc/shared';

type Tab = 'overview' | 'workflow' | 'risk' | 'dsr' | 'reviews' | 'pssr' | 'action_items' | 'attachments' | 'timeline' | 'impact' | 'implementation' | 'post_implementation' | 'scope' | 'improvements_realized';

export default function MocDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [moc, setMoc] = useState<any>(null);
  const [error, setError] = useState('');
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [actionLoading, setActionLoading] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'moc_number' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<any[]>([]);
  const [notePopupSection, setNotePopupSection] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState<number | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const isAdminOrManager = isAdminUserCheck(user);
  const isSuperAdmin = user?.role === 'super_admin';
  const activeDepartments = DEPARTMENTS.filter((d) => allUsers.some((u: any) => u.role === d));

  async function handleAdminFieldSave() {
    if (!token || !moc || !editingField) return;
    setEditSaving(true);
    try {
      await updateMocAdminFields(token, moc.id, { [editingField]: editValue });
      await fetchMoc();
      setEditingField(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function openTransferModal() {
    setShowTransfer(true);
    setTransferTarget(null);
    if (allUsers.length === 0 && token) {
      const users = await getUserNames(token);
      setAllUsers(users);
    }
  }

  async function handleTransfer() {
    if (!transferTarget || !token || !moc) return;
    setTransferring(true);
    try {
      await reassignMoc(token, moc.id, transferTarget);
      await fetchMoc();
      setShowTransfer(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransferring(false);
    }
  }

  const fetchMoc = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getMoc(token, Number(id));
      setMoc(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, id]);

  const fetchReviewNotes = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getReviewNotes(token, Number(id));
      setReviewNotes(data);
    } catch {
      // Notes are optional, don't block on errors
    }
  }, [token, id]);

  useEffect(() => {
    fetchMoc(); fetchReviewNotes();
    // Fetch active users for department filtering
    if (token && allUsers.length === 0) {
      getUserNames(token).then(setAllUsers).catch(() => {});
    }
  }, [fetchMoc, fetchReviewNotes]);

  async function handleTransition(toStatus: string) {
    if (!token || !moc) return;
    const comment = prompt('Comment (optional):') || '';
    setActionLoading(toStatus);
    try {
      await transitionMoc(token, moc.id, toStatus, comment);
      await fetchMoc();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  }

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!moc) return <div className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</div>;

  const isCrf = moc.form_version === 'crf_v1';
  const transitions = WORKFLOW_TRANSITIONS[moc.status] || [];
  const allowedTransitions = transitions.filter((t: any) => t.roles.includes(user?.role));
  // During under_review, the Reviews tab handles approve/reject — don't show raw transition buttons
  // During rejected/returned, show a "Resubmit" button instead of raw transitions
  const isReviewPhase = moc.status === 'under_review';
  const isEditableRejected = ['rejected', 'returned'].includes(moc.status) && (moc.created_by === user?.id || isAdminOrManager);
  const headerTransitions = isReviewPhase ? [] : isEditableRejected ? [] : allowedTransitions;

  const hasScopeBaseline = moc.scope_baseline && moc.scope_baseline.length > 0;

  // Count action items across DSR and PSSR
  const dsrActionItems = (moc.dsr?.items || []).filter((i: any) => i.status === 'fail');
  const pssrActionItems = (moc.pssr?.items || []).filter((i: any) => i.status === 'fail');
  const totalActionItems = dsrActionItems.length + pssrActionItems.length;
  const unresolvedActionItems = dsrActionItems.filter((i: any) => !i.action_resolved).length + pssrActionItems.filter((i: any) => !i.action_resolved).length;
  const actionItemLabel = totalActionItems > 0 ? `Action Items (${unresolvedActionItems})` : 'Action Items';

  // Build tabs based on form version
  const tabs: { key: Tab; label: string }[] = isCrf
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'workflow', label: 'Workflow & Approvals' },
        { key: 'risk', label: 'Risk Assessment' },
        { key: 'dsr', label: 'DSR' },
        { key: 'impact', label: 'Impact Assessment' },
        { key: 'implementation', label: 'Implementation' },
        { key: 'post_implementation', label: 'Post-Implementation' },
        ...(hasScopeBaseline ? [{ key: 'scope' as Tab, label: 'Improvement Expected' }] : []),
        ...(hasScopeBaseline ? [{ key: 'improvements_realized' as Tab, label: 'Improvements Realized' }] : []),
        { key: 'reviews', label: `Reviews (${(moc.reviews?.length || 0) + reviewNotes.filter((n: any) => !n.resolved).length})` },
        { key: 'pssr', label: 'PSSR' },
        { key: 'action_items', label: actionItemLabel },
        { key: 'attachments', label: `Files (${moc.attachments?.length || 0})` },
        { key: 'timeline', label: 'Timeline' },
      ]
    : [
        { key: 'overview', label: 'Overview' },
        { key: 'workflow', label: 'Workflow & Approvals' },
        { key: 'risk', label: 'Risk' },
        { key: 'dsr', label: 'DSR' },
        ...(hasScopeBaseline ? [{ key: 'scope' as Tab, label: 'Improvement Expected' }] : []),
        ...(hasScopeBaseline ? [{ key: 'improvements_realized' as Tab, label: 'Improvements Realized' }] : []),
        { key: 'reviews', label: `Reviews (${(moc.reviews?.length || 0) + reviewNotes.filter((n: any) => !n.resolved).length})` },
        { key: 'pssr', label: 'PSSR' },
        { key: 'action_items', label: actionItemLabel },
        { key: 'attachments', label: `Files (${moc.attachments?.length || 0})` },
        { key: 'timeline', label: 'Timeline' },
      ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {editingField === 'moc_number' ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input-field w-32 text-lg font-bold font-mono"
                  pattern="\d{4}-\d{3}"
                  placeholder="YYYY-NNN"
                  autoFocus
                />
                <button onClick={handleAdminFieldSave} disabled={editSaving} className="text-green-600 hover:text-green-800 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </button>
                <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{moc.moc_number || `#${moc.id}`}</span>
                {isAdminOrManager && (
                  <button onClick={() => { setEditingField('moc_number'); setEditValue(moc.moc_number || ''); }} className="text-gray-400 hover:text-brand-600 p-0.5" title="Edit MOC number">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
                  </button>
                )}
              </span>
            )}
            <span className="text-2xl text-gray-400 dark:text-gray-500">&mdash;</span>
            {editingField === 'title' ? (
              <span className="inline-flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input-field text-lg font-bold flex-1"
                  maxLength={200}
                  autoFocus
                />
                <button onClick={handleAdminFieldSave} disabled={editSaving} className="text-green-600 hover:text-green-800 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </button>
                <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{moc.title}</h1>
                {isAdminOrManager && (
                  <button onClick={() => { setEditingField('title'); setEditValue(moc.title || ''); }} className="text-gray-400 hover:text-brand-600 p-0.5" title="Edit title">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
                  </button>
                )}
              </span>
            )}
            <StatusBadge status={moc.status} />
            {isCrf && moc.crf_risk_level && moc.crf_risk_level !== '---' && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[moc.crf_risk_level as CrfRiskLevel] || '#6b7280' }}
              >
                {moc.crf_risk_level} — {getCrfRiskDescription(moc.crf_risk_level as CrfRiskLevel, moc.crf_risk_answers)}
              </span>
            )}
            {!isCrf && moc.risk_level && <RiskBadge level={moc.risk_level} />}
            {moc.is_psm_relevant && <span className="badge bg-red-100 text-red-700">PSM</span>}
            {moc.emergency_change && <span className="badge bg-orange-100 text-orange-700">Emergency</span>}
            {moc.template_name && <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{moc.template_name}</span>}
            {isCrf && <span className="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">CRF</span>}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Created by {moc.creator_name} on {new Date(moc.created_at).toLocaleDateString()}
            {moc.transferred_to_name && (
              <>
                {' · '}
                <span className="text-purple-700 dark:text-purple-300 font-medium">
                  Transferred to {moc.transferred_to_name}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!token) return;
              setExporting(true);
              try { await exportMocPdf(token, moc.id); } catch (err: any) { alert(err.message); }
              finally { setExporting(false); }
            }}
            disabled={exporting}
            className="btn-secondary text-sm"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          {isReviewPhase && (
            <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">Awaiting reviews — use Reviews tab</span>
          )}
          {isEditableRejected && (
            <button
              onClick={() => router.push(`/moc/new?draft=${moc.id}`)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              Edit &amp; Resubmit
            </button>
          )}
          {isAdminOrManager && (
            <button
              onClick={openTransferModal}
              className="text-sm px-3 py-1.5 rounded-lg font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Transfer Ownership
            </button>
          )}
          {headerTransitions.map((t: any) => {
            // Show friendly labels instead of raw status names
            const label = t.to === 'closed' ? 'Close MOC'
              : t.to === 'dsr' || t.to === 'pssr_pending' || t.to === 'orc' || t.to === 'ready_for_startup' ? 'Advance'
              : t.to === 'awaiting_action_items' ? 'Awaiting Items'
              : MOC_STATUS_LABELS[t.to] || t.to.replace(/_/g, ' ');
            return (
              <button
                key={t.to}
                onClick={() => handleTransition(t.to)}
                disabled={!!actionLoading}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  t.to === 'closed' ? 'bg-green-600 hover:bg-green-700 text-white' : 'btn-primary'
                }`}
              >
                {actionLoading === t.to ? '...' : label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (isCrf
        ? <CrfOverviewTab moc={moc} token={token!} user={user} onRefresh={fetchMoc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} activeDepartments={activeDepartments} />
        : <OverviewTab moc={moc} token={token!} user={user} onRefresh={fetchMoc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} activeDepartments={activeDepartments} />
      )}
      {activeTab === 'workflow' && <WorkflowTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} onTransition={handleTransition} actionLoading={actionLoading} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />}
      {activeTab === 'risk' && (isCrf
        ? <CrfRiskTab moc={moc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />
        : <RiskTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />
      )}
      {activeTab === 'impact' && isCrf && <CrfImpactTab moc={moc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />}
      {activeTab === 'implementation' && isCrf && <CrfImplementationTab moc={moc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />}
      {activeTab === 'post_implementation' && isCrf && <CrfPostImplTab moc={moc} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />}
      {activeTab === 'dsr' && <DsrTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} />}
      {activeTab === 'reviews' && <ReviewsTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} reviewNotes={reviewNotes} setActiveTab={setActiveTab} onRefreshNotes={fetchReviewNotes} setMoc={setMoc} />}
      {activeTab === 'pssr' && <PssrTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} reviewNotes={reviewNotes} onOpenNotes={setNotePopupSection} />}
      {activeTab === 'action_items' && <ActionItemsTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} />}
      {activeTab === 'scope' && hasScopeBaseline && <ScopeValidationTab moc={moc} token={token!} onRefresh={fetchMoc} />}
      {activeTab === 'improvements_realized' && hasScopeBaseline && <ImprovementsRealizedTab moc={moc} token={token!} onRefresh={fetchMoc} />}
      {activeTab === 'attachments' && <AttachmentsTab moc={moc} token={token!} onRefresh={fetchMoc} user={user} />}
      {activeTab === 'timeline' && <TimelineTab moc={moc} />}

      {/* Review Note Popup */}
      {notePopupSection && (
        <ReviewNotePopup
          mocId={moc.id}
          sectionId={notePopupSection}
          notes={reviewNotes}
          token={token!}
          userId={user?.id ?? 0}
          userRole={user?.role ?? ''}
          onClose={() => setNotePopupSection(null)}
          onRefresh={fetchReviewNotes}
        />
      )}

      {/* Transfer Ownership Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowTransfer(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Transfer Ownership</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The new owner will receive all emails, have final approval authority, and be listed as the MOC creator.
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">New Owner</label>
            <select
              value={transferTarget || ''}
              onChange={(e) => setTransferTarget(e.target.value ? parseInt(e.target.value) : null)}
              className="input-field mb-4"
            >
              <option value="">Select a user...</option>
              {allUsers
                .filter((u: any) => u.id !== moc.created_by)
                .map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={handleTransfer}
                disabled={!transferTarget || transferring}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm"
              >
                {transferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ReviewableSection wrapper ───────────────────────────────────────────

function ReviewableSection({ sectionId, reviewNotes, onOpenNotes, children }: {
  sectionId: string;
  reviewNotes: any[];
  onOpenNotes: (sectionId: string) => void;
  children: React.ReactNode;
}) {
  const noteCount = reviewNotes.filter((n) => n.section_id === sectionId && !n.resolved).length;
  return (
    <div className="relative group" data-section-id={sectionId}>
      {children}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenNotes(sectionId); }}
        className={`absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-opacity ${
          noteCount > 0
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 opacity-100'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 opacity-0 group-hover:opacity-100'
        }`}
        title="Section notes"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        {noteCount > 0 && <span>{noteCount}</span>}
      </button>
    </div>
  );
}

// ── CRF-specific tabs ──────────────────────────────────────────────────

function CrfOverviewTab({ moc, token, user, onRefresh, reviewNotes, onOpenNotes, activeDepartments }: { moc: any; token: string; user: any; onRefresh: () => void; reviewNotes: any[]; onOpenNotes: (s: string) => void; activeDepartments: string[] }) {
  const crfChangeType = moc.crf_change_type;
  const changeDuration = moc.change_duration;
  const crfRiskLevel = (moc.crf_risk_level || '---') as CrfRiskLevel;
  const [editingDepts, setEditingDepts] = useState(false);
  const [deptList, setDeptList] = useState<string[]>(moc.departments_involved || []);
  const [savingDepts, setSavingDepts] = useState(false);
  const canEditDepts = (user?.role === 'ehs' || isAdminUserCheck(user)) && ['submitted', 'under_review', 'risk_assessment'].includes(moc.status);

  async function handleSaveDepts() {
    setSavingDepts(true);
    try {
      await updateMocDepartments(token, moc.id, deptList);
      onRefresh();
      setEditingDepts(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingDepts(false);
    }
  }

  // Reviews required — filters HAZOP based on chemical question answers
  const riskAnswers = moc.crf_risk_answers ? (typeof moc.crf_risk_answers === 'string' ? JSON.parse(moc.crf_risk_answers) : moc.crf_risk_answers) : null;
  const category = crfChangeType ? getCrfChangeCategory(crfChangeType as CrfChangeType) : null;
  const reviewsRequired = category
    ? getEffectiveReviewsRequired(crfRiskLevel, category, riskAnswers)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ReviewableSection sectionId="overview.description" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Description</h3>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{moc.description}</p>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.justification" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Justification</h3>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{moc.justification}</p>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.crf_details" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">CRF Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Change Type (CRF)</dt>
            <dd className="font-medium">{CRF_CHANGE_TYPE_LABELS[crfChangeType as keyof typeof CRF_CHANGE_TYPE_LABELS] || crfChangeType || '-'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Duration</dt>
            <dd className="font-medium capitalize">{CRF_CHANGE_DURATION_LABELS[changeDuration as keyof typeof CRF_CHANGE_DURATION_LABELS] || changeDuration || '-'}</dd>
          </div>
          {changeDuration === 'temporary' && moc.temporary_end_date && (
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Temporary End Date</dt>
              <dd className="font-medium">{new Date(moc.temporary_end_date).toLocaleDateString()}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Risk Level</dt>
            <dd>
              {crfRiskLevel ? (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: CRF_RISK_LEVEL_COLORS[crfRiskLevel] || '#6b7280' }}
                >
                  {crfRiskLevel} — {getCrfRiskDescription(crfRiskLevel, moc.crf_risk_answers)}
                </span>
              ) : (
                <span className="text-gray-400">Not assessed</span>
              )}
            </dd>
          </div>
          {reviewsRequired.length > 0 && (
            <div className="flex justify-between items-start">
              <dt className="text-gray-500 dark:text-gray-400">Reviews Required</dt>
              <dd className="flex gap-1 flex-wrap justify-end">
                {reviewsRequired.map((r) => (
                  <span key={r} className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{r}</span>
                ))}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Proposed Start</dt>
            <dd className="font-medium">{moc.proposed_start_date ? new Date(moc.proposed_start_date).toLocaleDateString() : '-'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Proposed End</dt>
            <dd className="font-medium">{moc.proposed_end_date ? new Date(moc.proposed_end_date).toLocaleDateString() : '-'}</dd>
          </div>
        </dl>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.departments" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Departments & Flags</h3>
            {canEditDepts && !editingDepts && (
              <button onClick={() => { setDeptList(moc.departments_involved || []); setEditingDepts(true); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                Edit Departments
              </button>
            )}
          </div>
          {editingDepts ? (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select departments involved in this MOC. Existing departments cannot be removed.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {DEPARTMENTS.map((d) => {
                  const isSelected = deptList.includes(d);
                  const isLocked = (moc.departments_involved || []).includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        if (isLocked && isSelected) return; // Can't remove locked departments
                        setDeptList((prev) => isSelected ? prev.filter((x) => x !== d) : [...prev, d]);
                      }}
                      disabled={isLocked && isSelected}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? isLocked
                            ? 'bg-blue-600 text-white border-blue-600 opacity-75 cursor-not-allowed'
                            : 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                      }`}
                      title={isLocked ? 'This department cannot be removed' : ''}
                    >
                      {DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS] || d}
                      {isLocked && isSelected && <span className="ml-1">&#128274;</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveDepts} disabled={savingDepts} className="btn-primary text-xs py-1.5 px-4">
                  {savingDepts ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingDepts(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Departments Involved</p>
              <div className="flex flex-wrap gap-2">
                {(moc.departments_involved || []).map((d: string) => (
                  <span key={d} className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS] || d}
                    {ALWAYS_REQUIRED_DEPARTMENTS.includes(d as any) && (
                      <span className="ml-1 text-[10px] opacity-60">&#128274;</span>
                    )}
                  </span>
                ))}
                {(moc.departments_involved || []).length === 0 && (
                  <span className="text-sm text-gray-400">No departments assigned</span>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {moc.is_psm_relevant && <span className="badge bg-red-100 text-red-700">PSM Relevant</span>}
            {moc.emergency_change && <span className="badge bg-orange-100 text-orange-700">Emergency Change</span>}
          </div>

          {/* Attachment checklist summary */}
          {moc.attachment_checklist && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Attachment Checklist</h4>
              <CrfAttachmentChecklist
                checklist={typeof moc.attachment_checklist === 'string' ? JSON.parse(moc.attachment_checklist) : moc.attachment_checklist}
                onChange={() => {}}
                readOnly
              />
            </div>
          )}
        </div>
      </ReviewableSection>
    </div>
  );
}

function CrfRiskTab({ moc, reviewNotes, onOpenNotes }: { moc: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const answers = moc.crf_risk_answers
    ? (typeof moc.crf_risk_answers === 'string' ? JSON.parse(moc.crf_risk_answers) : moc.crf_risk_answers)
    : null;

  if (!answers) {
    return <p className="text-gray-400 dark:text-gray-500 text-center py-8">No CRF risk assessment data.</p>;
  }

  return (
    <ReviewableSection sectionId="risk.questionnaire" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
      <CrfRiskQuestionnaire
        answers={answers}
        onChange={() => {}}
        changeType={moc.crf_change_type}
        readOnly
      />
    </ReviewableSection>
  );
}

function CrfImpactTab({ moc, reviewNotes, onOpenNotes }: { moc: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const items = moc.impact_assessment
    ? (typeof moc.impact_assessment === 'string' ? JSON.parse(moc.impact_assessment) : moc.impact_assessment)
    : [];

  if (!items || items.length === 0) {
    return <p className="text-gray-400 dark:text-gray-500 text-center py-8">No impact assessment data.</p>;
  }

  return (
    <ReviewableSection sectionId="impact.assessment" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
      <CrfImpactAssessment items={items} onChange={() => {}} readOnly />
    </ReviewableSection>
  );
}

function CrfImplementationTab({ moc, reviewNotes, onOpenNotes }: { moc: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const tasks = moc.implementation_tasks
    ? (typeof moc.implementation_tasks === 'string' ? JSON.parse(moc.implementation_tasks) : moc.implementation_tasks)
    : [];

  if (!tasks || tasks.length === 0) {
    return <p className="text-gray-400 dark:text-gray-500 text-center py-8">No implementation tasks defined.</p>;
  }

  return (
    <ReviewableSection sectionId="implementation.tasks" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
      <CrfImplementationPlan tasks={tasks} onChange={() => {}} readOnly />
    </ReviewableSection>
  );
}

function CrfPostImplTab({ moc, reviewNotes, onOpenNotes }: { moc: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const verifications = moc.post_impl_verifications
    ? (typeof moc.post_impl_verifications === 'string' ? JSON.parse(moc.post_impl_verifications) : moc.post_impl_verifications)
    : [];

  return (
    <ReviewableSection sectionId="post_implementation.verifications" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
      <CrfPostImplementation verifications={verifications} onChange={() => {}} readOnly />
    </ReviewableSection>
  );
}

// ── Existing legacy tabs (unchanged) ───────────────────────────────────

function WorkflowTab({ moc, token, onRefresh, user, onTransition, actionLoading, reviewNotes, onOpenNotes }: { moc: any; token: string; onRefresh: () => void; user: any; onTransition: (to: string) => void; actionLoading: string; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const transitions = WORKFLOW_TRANSITIONS[moc.status] || [];
  const allowedTransitions = transitions.filter((t: any) => t.roles.includes(user?.role));

  const ALL_WORKFLOW_STEPS = [
    'draft', 'under_review', 'dsr',
    'pssr_pending', 'orc', 'ready_for_startup', 'awaiting_action_items', 'closed',
  ];
  const workflowConfig = (() => {
    if (!moc.template_workflow_config) return null;
    return typeof moc.template_workflow_config === 'string' ? JSON.parse(moc.template_workflow_config) : moc.template_workflow_config;
  })();
  const skipSteps: string[] = workflowConfig?.skip_steps || [];
  const WORKFLOW_STEPS = ALL_WORKFLOW_STEPS.filter((step) => !skipSteps.includes(step));
  const currentIdx = WORKFLOW_STEPS.indexOf(moc.status);

  const reviews = moc.reviews || [];
  const approvalsByRole: Record<string, any> = {};
  for (const r of reviews) {
    approvalsByRole[r.reviewer_role] = r;
  }

  // Named-user approver roster (per-user, populated on submit)
  const approverList: any[] = Array.isArray(moc.approvers) ? moc.approvers : [];
  const approvedCount = approverList.filter((a: any) => a?.decision === 'approved').length;

  // Department responsibility per step
  const STEP_DEPARTMENTS: Record<string, string[]> = {
    under_review: ['EHS', 'Operations', 'QC'],
    dsr: ['EHS'],
    pssr_pending: ['EHS'],
    orc: ['EHS', 'Operations'],
    ready_for_startup: ['Operations'],
    awaiting_action_items: ['EHS', 'Operations'],
  };

  // Next step info
  const nextStepIdx = currentIdx + 1;
  const nextStep = WORKFLOW_STEPS[nextStepIdx] || null;
  const nextDepts = nextStep ? STEP_DEPARTMENTS[nextStep] || [] : [];

  return (
    <div className="space-y-6">
      {/* Compliance Flag Banner */}
      {moc.compliance_flag && (
        <div
          className="rounded-lg p-3 text-center font-bold text-white text-sm"
          style={{ backgroundColor: COMPLIANCE_FLAG_COLORS[moc.compliance_flag as keyof typeof COMPLIANCE_FLAG_COLORS] || '#6b7280' }}
        >
          {COMPLIANCE_FLAG_LABELS[moc.compliance_flag as keyof typeof COMPLIANCE_FLAG_LABELS] || moc.compliance_flag} Change
        </div>
      )}

      {/* Workflow Progress - Enhanced Visual */}
      <div className="card overflow-hidden">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-5">Workflow Progress</h3>
        <div className="relative">
          {/* Progress bar background */}
          <div className="absolute top-5 left-4 right-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
          {/* Progress bar filled */}
          {currentIdx > 0 && (
            <div
              className="absolute top-5 left-4 h-1 bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((currentIdx / (WORKFLOW_STEPS.length - 1)) * 100, 100)}%` }}
            />
          )}
          <div className="relative flex justify-between">
            {WORKFLOW_STEPS.map((step, i) => {
              const isCompleted = currentIdx > i;
              const isCurrent = moc.status === step;
              const isRejected = moc.status === 'rejected' || moc.status === 'returned';
              const depts = STEP_DEPARTMENTS[step] || [];
              return (
                <div key={step} className="flex flex-col items-center" style={{ width: `${100 / WORKFLOW_STEPS.length}%` }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                    isCurrent
                      ? (isRejected ? 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-200' : 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-200')
                      : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : isCurrent ? (
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-[10px] mt-2 text-center leading-tight ${isCurrent ? 'font-bold text-brand-700 dark:text-brand-400' : isCompleted ? 'font-medium text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
                    {MOC_STATUS_LABELS[step] || step.replace(/_/g, ' ')}
                  </span>
                  {/* Show department badges under each step */}
                  {depts.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                      {depts.map((d) => (
                        <span key={d} className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                          isCurrent ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {(moc.status === 'rejected' || moc.status === 'returned') && (
          <div className={`mt-4 p-4 rounded-lg text-sm ${moc.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
            <p className="font-semibold mb-1">
              {moc.status === 'returned' ? 'Changes Requested' : 'MOC Rejected'}
            </p>
            <p>This MOC has been <strong>{moc.status === 'returned' ? 'returned for changes' : 'rejected'}</strong>. It can be revised and resubmitted.</p>
            {/* Show the reviewer's comments for returned MOCs */}
            {moc.status === 'returned' && (() => {
              const returnReview = (moc.reviews || []).find((r: any) => r.decision === 'returned');
              return returnReview?.comments ? (
                <div className="mt-2 p-3 rounded bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
                  <p className="text-xs font-medium text-orange-800 dark:text-orange-300 mb-1">
                    {returnReview.reviewer_name} ({returnReview.reviewer_role?.toUpperCase()}):
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-200 whitespace-pre-wrap">{returnReview.comments}</p>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Next Step Card */}
      {nextStep && moc.status !== 'rejected' && moc.status !== 'returned' && moc.status !== 'closed' && (
        <div className="card bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 border-brand-200 dark:border-brand-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 dark:text-gray-100">Next Step: <span>{MOC_STATUS_LABELS[nextStep] || nextStep.replace(/_/g, ' ')}</span></h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {nextDepts.length > 0
                  ? `Requires action from: ${nextDepts.join(', ')}`
                  : 'Waiting for workflow progression'}
              </p>
            </div>
            {nextDepts.length > 0 && (
              <div className="flex gap-2">
                {nextDepts.map((d) => (
                  <span key={d} className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-600 text-white">{d}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Status Panel — named approvers (per-user, not role-based) */}
      <ReviewableSection sectionId="workflow.approvals" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Approval Status</h3>
          {approverList.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {approvedCount} of {approverList.length} approved
            </span>
          )}
        </div>
        {approverList.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No approvers assigned. Approvers are populated when the MOC enters &ldquo;Under Review&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {approverList.map((a: any) => {
              const decision = a?.decision || 'pending';
              const borderClass =
                decision === 'approved' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' :
                decision === 'rejected' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' :
                decision === 'returned' ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' :
                'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900';
              const pillClass =
                decision === 'approved' ? 'bg-green-500 text-white' :
                decision === 'rejected' ? 'bg-red-500 text-white' :
                decision === 'returned' ? 'bg-orange-500 text-white' :
                'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
              const label = a?.role_context || 'approver';
              const name = a?.user_name || a?.name || `User #${a?.user_id ?? '?'}`;
              return (
                <div key={a?.id ?? `${a?.user_id}-${a?.role_context}`} className={`rounded-xl border-2 p-4 transition-all ${borderClass}`}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize flex-shrink-0 ${pillClass}`}>
                      {decision}
                    </span>
                  </div>
                  {a?.comments && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 whitespace-pre-wrap">&quot;{a.comments}&quot;</p>
                  )}
                  {a?.decided_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(a.decided_at).toLocaleString()}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </ReviewableSection>

      {/* Available Actions — contextual, not raw status names */}
      {moc.status === 'under_review' ? (
        <div className="card bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Awaiting Department Reviews</h3>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            Use the <strong>Reviews</strong> tab to approve, reject, or request changes. When all assigned departments approve, the MOC will automatically advance to the next phase.
          </p>
        </div>
      ) : ['rejected', 'returned'].includes(moc.status) ? (
        <div className={`card ${moc.status === 'rejected' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'}`}>
          <h3 className={`font-semibold mb-2 ${moc.status === 'rejected' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {moc.status === 'rejected' ? 'MOC Rejected' : 'Changes Requested'}
          </h3>
          <p className={`text-sm mb-3 ${moc.status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {moc.status === 'rejected'
              ? 'This MOC has been rejected. The creator can edit and resubmit it.'
              : 'A reviewer has requested changes. The creator can edit and resubmit.'}
          </p>
          {(moc.created_by === user?.id || isAdminUserCheck(user)) && (
            <a href={`/moc/new?draft=${moc.id}`} className="btn-primary inline-block text-sm">
              Edit &amp; Resubmit
            </a>
          )}
        </div>
      ) : allowedTransitions.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Available Actions</h3>
          <div className="flex flex-wrap gap-3">
            {allowedTransitions.map((t: any) => {
              const label = t.to === 'closed' ? 'Close MOC'
                : t.to === 'awaiting_action_items' ? 'Move to Awaiting Items'
                : 'Advance to Next Phase';
              return (
                <button
                  key={t.to}
                  onClick={() => onTransition(t.to)}
                  disabled={!!actionLoading}
                  className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm hover:shadow-md ${
                    t.to === 'closed' ? 'bg-green-600 hover:bg-green-700 text-white' : 'btn-primary'
                  }`}
                >
                  {actionLoading === t.to ? 'Processing...' : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Your role: <span className="font-medium capitalize">{user?.role?.replace(/_/g, ' ')}</span>
          </p>
        </div>
      )}

      {/* Workflow History */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Workflow History</h3>
        {(moc.timeline || []).length > 0 ? (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-4">
              {[...moc.timeline].reverse().map((entry: any, i: number) => (
                <div key={entry.id} className="flex items-start gap-4 text-sm relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    i === 0 ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1 pb-2">
                    <p>
                      <span className="font-medium">{entry.changer_name}</span>{' '}
                      {entry.from_status ? (
                        <>moved from <StatusBadge status={entry.from_status} /> to <StatusBadge status={entry.to_status} /></>
                      ) : (
                        <>created this MOC</>
                      )}
                    </p>
                    {entry.comment && <p className="text-gray-500 dark:text-gray-400 mt-0.5">{entry.comment}</p>}
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-center py-4">No workflow history yet</p>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ moc, token, user, onRefresh, reviewNotes, onOpenNotes, activeDepartments }: { moc: any; token: string; user: any; onRefresh: () => void; reviewNotes: any[]; onOpenNotes: (s: string) => void; activeDepartments: string[] }) {
  const [editingDepts, setEditingDepts] = useState(false);
  const [deptList, setDeptList] = useState<string[]>(moc.departments_involved || []);
  const [savingDepts, setSavingDepts] = useState(false);
  const canEditDepts = (user?.role === 'ehs' || isAdminUserCheck(user)) && ['submitted', 'under_review', 'risk_assessment'].includes(moc.status);

  async function handleSaveDepts() {
    setSavingDepts(true);
    try {
      await updateMocDepartments(token, moc.id, deptList);
      onRefresh();
      setEditingDepts(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingDepts(false);
    }
  }
  const templateCustomFields = (() => {
    if (!moc.template_custom_fields) return null;
    const parsed = typeof moc.template_custom_fields === 'string' ? JSON.parse(moc.template_custom_fields) : moc.template_custom_fields;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  })();

  const customFieldValues = (() => {
    if (!moc.custom_field_values) return {};
    return typeof moc.custom_field_values === 'string' ? JSON.parse(moc.custom_field_values) : moc.custom_field_values;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compliance Flag */}
      {moc.compliance_flag && (
        <div className="lg:col-span-2">
          <div
            className="rounded-lg p-3 text-center font-bold text-white text-sm"
            style={{ backgroundColor: COMPLIANCE_FLAG_COLORS[moc.compliance_flag as keyof typeof COMPLIANCE_FLAG_COLORS] || '#6b7280' }}
          >
            {COMPLIANCE_FLAG_LABELS[moc.compliance_flag as keyof typeof COMPLIANCE_FLAG_LABELS] || moc.compliance_flag} Change
          </div>
        </div>
      )}
      <ReviewableSection sectionId="overview.description" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Description</h3>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{moc.description}</p>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.justification" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Justification</h3>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{moc.justification}</p>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.details" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Change Type</dt>
              <dd className="capitalize font-medium">{moc.change_type?.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Proposed Start</dt>
              <dd className="font-medium">{new Date(moc.proposed_start_date).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Proposed End</dt>
              <dd className="font-medium">{new Date(moc.proposed_end_date).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </ReviewableSection>
      <ReviewableSection sectionId="overview.affected_areas" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Affected Areas</h3>
          <div className="flex flex-wrap gap-2">
            {(moc.affected_areas || []).map((a: string) => (
              <span key={a} className="badge bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {AFFECTED_AREA_LABELS[a as keyof typeof AFFECTED_AREA_LABELS] || a.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          {moc.ehs_assessment && typeof moc.ehs_assessment === 'object' && !Array.isArray(moc.ehs_assessment) && (
            <>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mt-4 mb-3">EHS Assessment</h3>
              <div className="space-y-1">
                {EHS_QUESTIONS.map((q) => {
                  const answer = (moc.ehs_assessment as Record<string, string>)[q] as EhsAnswerValue | undefined;
                  if (!answer) return null;
                  const color = answer === 'yes' ? 'text-red-600' : 'text-gray-500';
                  return (
                    <div key={q} className="flex items-start gap-2 text-sm">
                      <span className={`font-medium flex-shrink-0 w-8 ${color}`}>{answer === 'yes' ? 'Yes' : 'No'}</span>
                      <span className="text-gray-700 dark:text-gray-200">{EHS_QUESTION_LABELS[q] || q.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Departments Involved</h3>
              {canEditDepts && !editingDepts && (
                <button onClick={() => { setDeptList(moc.departments_involved || []); setEditingDepts(true); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                  Edit Departments
                </button>
              )}
            </div>
            {editingDepts ? (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Existing departments cannot be removed.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DEPARTMENTS.filter((d) => activeDepartments.includes(d) || deptList.includes(d)).map((d) => {
                    const isSelected = deptList.includes(d);
                    const isLocked = (moc.departments_involved || []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (isLocked && isSelected) return;
                          setDeptList((prev) => isSelected ? prev.filter((x) => x !== d) : [...prev, d]);
                        }}
                        disabled={isLocked && isSelected}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? isLocked
                              ? 'bg-blue-600 text-white border-blue-600 opacity-75 cursor-not-allowed'
                              : 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                        title={isLocked ? 'This department cannot be removed' : ''}
                      >
                        {DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS] || d}
                        {isLocked && isSelected && <span className="ml-1">&#128274;</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveDepts} disabled={savingDepts} className="btn-primary text-xs py-1.5 px-4">
                    {savingDepts ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingDepts(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(moc.departments_involved || []).map((d: string) => (
                  <span key={d} className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS] || d}
                    {ALWAYS_REQUIRED_DEPARTMENTS.includes(d as any) && (
                      <span className="ml-1 text-[10px] opacity-60">&#128274;</span>
                    )}
                  </span>
                ))}
                {(moc.departments_involved || []).length === 0 && (
                  <span className="text-sm text-gray-400">No departments assigned</span>
                )}
              </div>
            )}
          </div>
        </div>
      </ReviewableSection>
      {templateCustomFields && (
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Custom Fields</h3>
          <dl className="space-y-2 text-sm">
            {templateCustomFields.map((field: any) => (
              <div key={field.name} className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{field.label}</dt>
                <dd className="font-medium text-gray-800 dark:text-gray-100">
                  {customFieldValues[field.name] !== undefined && customFieldValues[field.name] !== null
                    ? String(customFieldValues[field.name])
                    : <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function getDefaultCrfRiskAnswers(): CrfRiskAnswers {
  return {
    hazard_l1: { energy: false, exposure: false, volume: false, stability: false },
    hazard_l2: { safety_procedure_conflict: false },
    significance_l0: { training_needed: false },
    significance_l1: { energy_material_balance: false, tank_vessel_change: false, chemical_incompatibility: false, hazard_mitigation_reduction: false },
    significance_l2: { operating_conditions: false, equipment_limitations: false, critical_equipment_bypass: false, new_raw_material: false, processing_sequences: false },
  };
}

function RiskTab({ moc, token, onRefresh, user, reviewNotes, onOpenNotes }: { moc: any; token: string; onRefresh: () => void; user: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const [answers, setAnswers] = useState<CrfRiskAnswers>(
    moc.crf_risk_answers || getDefaultCrfRiskAnswers()
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const riskWorkflowConfig = (() => {
    if (!moc.template_workflow_config) return null;
    return typeof moc.template_workflow_config === 'string' ? JSON.parse(moc.template_workflow_config) : moc.template_workflow_config;
  })();
  const riskAssessmentRequired = riskWorkflowConfig?.risk_assessment_required !== false;

  const canEdit = ['ehs', 'admin'].includes(user?.role) && ['risk_assessment', 'submitted'].includes(moc.status);

  async function handleChange(updated: CrfRiskAnswers) {
    setAnswers(updated);
    if (!canEdit) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateMoc(token, moc.id, { crf_risk_answers: updated });
      onRefresh();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save risk answers');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!riskAssessmentRequired && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm">
          Risk assessment is not required for this template type.
        </div>
      )}

      {saving && (
        <div className="mb-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Saving...</div>
      )}
      {saveError && (
        <div className="mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{saveError}</div>
      )}

      <ReviewableSection sectionId="risk.questionnaire" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <CrfRiskQuestionnaire
          answers={answers}
          onChange={handleChange}
          changeType={moc.crf_change_type}
          readOnly={!canEdit}
        />
      </ReviewableSection>

      {/* Risk Matrix visualization driven by questionnaire answers */}
      <ReviewableSection sectionId="risk.matrix" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
        <div className="card mt-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Risk Matrix</h3>
          <CrfRiskMatrix
            hazardL1={CRF_HAZARD_L1_QUESTIONS.reduce((n, q) => n + (answers.hazard_l1[q] ? 1 : 0), 0)}
            hazardL2={CRF_HAZARD_L2_QUESTIONS.reduce((n, q) => n + (answers.hazard_l2[q] ? 1 : 0), 0)}
            sigL0={CRF_SIGNIFICANCE_L0_QUESTIONS.reduce((n, q) => n + (answers.significance_l0[q] ? 1 : 0), 0)}
            sigL1={CRF_SIGNIFICANCE_L1_QUESTIONS.reduce((n, q) => n + (answers.significance_l1[q] ? 1 : 0), 0)}
            sigL2={CRF_SIGNIFICANCE_L2_QUESTIONS.reduce((n, q) => n + (answers.significance_l2[q] ? 1 : 0), 0)}
          />
        </div>
      </ReviewableSection>

      {/* Legacy risk assessments (read-only, for MOCs created before question-based system) */}
      {(moc.risk_assessments || []).length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Legacy Risk Assessments</h3>
          <div className="space-y-4">
            {(moc.risk_assessments || []).map((risk: any) => (
              <div key={risk.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">{risk.hazard_description}</h4>
                  <div className="flex gap-2">
                    <RiskBadge level={risk.risk_level_before} />
                    <span className="text-gray-400 dark:text-gray-500">&#8594;</span>
                    <RiskBadge level={risk.risk_level_after} />
                  </div>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-gray-500 dark:text-gray-400">Consequences</dt><dd>{risk.consequences}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Existing Controls</dt><dd>{risk.existing_controls || 'None'}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Proposed Controls</dt><dd>{risk.proposed_controls}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Assessed By</dt><dd>{risk.assessor_name}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ moc, token, onRefresh, user, reviewNotes, setActiveTab, onRefreshNotes, setMoc }: {
  moc: any; token: string; onRefresh: () => void; user: any;
  reviewNotes: any[]; setActiveTab: (tab: Tab) => void; onRefreshNotes: () => void; setMoc: (moc: any) => void;
}) {
  const [decision, setDecision] = useState('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = isAdminUserCheck(user);
  const approvers: any[] = moc.approvers || [];

  // Does the current user have at least one pending approver row?
  const myRows = approvers.filter((a: any) => a.user_id === user?.id);
  const hasPendingRow = myRows.some((a: any) => a.decision === 'pending');
  const hasAnyApproverRow = myRows.length > 0;
  // user.is_approver gate — admins bypass
  const canActAsApprover = isAdmin || (user?.is_approver === true && hasAnyApproverRow);
  const canReview = moc.status === 'under_review' && canActAsApprover && (hasPendingRow || isAdmin);

  async function handleSubmitReview() {
    if (!decision) return;
    setLoading(true);
    try {
      const result = await submitReview(token, { moc_id: moc.id, decision, comments });
      setDecision('');
      setComments('');
      if (result.new_status) {
        setMoc((prev: any) => ({ ...prev, status: result.new_status }));
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoToSection(sectionId: string) {
    const tab = getTabForSection(sectionId);
    if (!tab) return;
    setActiveTab(tab as Tab);
    // Wait for tab render, then scroll and highlight
    setTimeout(() => {
      const el = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2', 'rounded-xl');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2', 'rounded-xl');
        }, 2000);
      }
    }, 100);
  }

  const unresolvedNotes = reviewNotes.filter((n) => !n.resolved);
  const resolvedNotes = reviewNotes.filter((n) => n.resolved);

  return (
    <div>
      {/* Section Notes */}
      {reviewNotes.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Section Notes ({unresolvedNotes.length} open{resolvedNotes.length > 0 ? `, ${resolvedNotes.length} resolved` : ''})
          </h3>
          <div className="space-y-3">
            {unresolvedNotes.map((note: any) => (
              <div key={note.id} className="card flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                      {getSectionLabel(note.section_id)}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{note.author_name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{note.author_role}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{note.note}</p>
                </div>
                <button
                  onClick={() => handleGoToSection(note.section_id)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap flex-shrink-0"
                >
                  Go to section &rarr;
                </button>
              </div>
            ))}
            {resolvedNotes.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                  {resolvedNotes.length} resolved note{resolvedNotes.length !== 1 ? 's' : ''}
                </summary>
                <div className="space-y-3 mt-3">
                  {resolvedNotes.map((note: any) => (
                    <div key={note.id} className="card opacity-60 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
                            {getSectionLabel(note.section_id)}
                          </span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{note.author_name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                          <span className="text-xs text-green-600 dark:text-green-400">Resolved</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap line-through">{note.note}</p>
                      </div>
                      <button
                        onClick={() => handleGoToSection(note.section_id)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap flex-shrink-0"
                      >
                        Go to section &rarr;
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Submit Review Form */}
      {canReview && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Submit Your Decision</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acting as <span className="font-medium text-brand-600">{user?.name}</span>
            {myRows.length > 0 && (
              <> &middot; Assigned role(s): {myRows.map((r: any) => r.role_context).filter(Boolean).join(', ') || 'Admin override'}</>
            )}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Decision *</label>
            <div className="flex gap-3">
              {[
                { value: 'approved', label: 'Approve', style: 'border-green-300 bg-green-50 text-green-700' },
                { value: 'rejected', label: 'Reject (resets flow)', style: 'border-red-300 bg-red-50 text-red-700' },
                { value: 'returned', label: 'Request Changes', style: 'border-orange-300 bg-orange-50 text-orange-700' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDecision(opt.value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    decision === opt.value ? opt.style + ' ring-2 ring-offset-1' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="input-field" rows={3} placeholder="Review comments..." />
          </div>
          {decision === 'returned' && !comments.trim() && (
            <p className="text-sm text-orange-600">Comments are required when requesting changes.</p>
          )}
          {decision === 'rejected' && (
            <p className="text-sm text-red-600">Rejecting will reset all approver decisions on this MOC.</p>
          )}
          <button onClick={handleSubmitReview} disabled={loading || !decision || (decision === 'returned' && !comments.trim())} className="btn-primary">
            {loading ? 'Submitting...' : 'Submit Decision'}
          </button>
        </div>
      )}

      {/* Named-user approver roster */}
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Required Approvers</h3>
      {approvers.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-center py-8">
          No approvers assigned yet. Approvers are populated when the MOC enters &ldquo;Under Review&rdquo;.
        </p>
      ) : (
        <div className="space-y-3 mb-8">
          {approvers.map((a: any) => {
            const decisionBadge = a.decision === 'approved'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : a.decision === 'rejected'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : a.decision === 'returned'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
            return (
              <div key={a.id} className="card flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{a.user_name}</span>
                    {a.role_context && (
                      <span className="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs">
                        {a.role_context}
                      </span>
                    )}
                    <span className={`badge text-xs capitalize ${decisionBadge}`}>{a.decision}</span>
                  </div>
                  {a.comments && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{a.comments}</p>
                  )}
                  {a.decided_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Decided {new Date(a.decided_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${a.user_name} as an approver?`)) return;
                      try {
                        const { removeApprover } = await import('@/lib/api');
                        await removeApprover(token, moc.id, a.id);
                        onRefresh();
                      } catch (err: any) { alert(err.message); }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && moc.status === 'under_review' && (
        <div className="mb-8">
          <AdminAddApprover mocId={moc.id} token={token} onRefresh={onRefresh} currentApproverIds={approvers.map((a: any) => a.user_id)} />
        </div>
      )}

      {/* Legacy role-based reviews (kept for historical MOCs that used the old flow) */}
      {(moc.reviews || []).length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
            Legacy role-based reviews ({(moc.reviews || []).length})
          </summary>
          <div className="space-y-4 mt-3">
            {(moc.reviews || []).map((review: any, idx: number) => (
              <div key={review.id ?? `review-${idx}`} className="card opacity-80">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{review.reviewer_name}</span>
                    <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ml-2 capitalize">{review.reviewer_role}</span>
                  </div>
                  <span className={`badge capitalize ${
                    review.decision === 'approved' ? 'bg-green-100 text-green-700' :
                    review.decision === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {review.decision}
                  </span>
                </div>
                {review.comments && <p className="text-sm text-gray-600 dark:text-gray-300">{review.comments}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{new Date(review.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AdminAddApprover({ mocId, token, onRefresh, currentApproverIds }: {
  mocId: number; token: string; onRefresh: () => void; currentApproverIds: number[];
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [roleContext, setRoleContext] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { getUsers } = await import('@/lib/api');
        const list = await getUsers(token);
        setUsers(list.filter((u: any) => u.is_active && u.is_approver && !currentApproverIds.includes(u.id)));
      } catch { /* ignore */ }
    })();
  }, [token, currentApproverIds.join(',')]);

  async function handleAdd() {
    if (!userId || !roleContext) return;
    setBusy(true);
    try {
      const { addApprover } = await import('@/lib/api');
      await addApprover(token, mocId, { user_id: Number(userId), role_context: roleContext });
      setUserId('');
      setRoleContext('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card border-dashed">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Admin: Add Approver</h4>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">User</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
            className="input-field text-sm"
          >
            <option value="">Select a user…</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Role context (free-form)</label>
          <input
            value={roleContext}
            onChange={(e) => setRoleContext(e.target.value)}
            className="input-field text-sm"
            placeholder="e.g. operations:batch"
          />
        </div>
        <button onClick={handleAdd} disabled={busy || !userId || !roleContext} className="btn-secondary text-sm">
          {busy ? 'Adding…' : 'Add approver'}
        </button>
      </div>
    </div>
  );
}

function PssrTab({ moc, token, onRefresh, user, reviewNotes, onOpenNotes }: { moc: any; token: string; onRefresh: () => void; user: any; reviewNotes: any[]; onOpenNotes: (s: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  const pssrWorkflowConfig = (() => {
    if (!moc.template_workflow_config) return null;
    return typeof moc.template_workflow_config === 'string' ? JSON.parse(moc.template_workflow_config) : moc.template_workflow_config;
  })();
  const pssrRequired = pssrWorkflowConfig?.pssr_required !== false;

  const [pssrCustomItemDesc, setPssrCustomItemDesc] = useState('');
  const [addingPssrCustom, setAddingPssrCustom] = useState(false);

  const canCreate = moc.status === 'pssr_pending' && ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'].includes(user?.role);
  const canComplete = moc.pssr && !moc.pssr.completed_at && ['ehs', 'admin', 'super_admin', 'moc_manager'].includes(user?.role);

  useEffect(() => {
    if (moc.pssr?.items) {
      const notesMap: Record<number, string> = {};
      for (const item of moc.pssr.items) {
        notesMap[item.id] = item.notes || '';
      }
      setItemNotes(notesMap);
    }
  }, [moc.pssr?.items]);

  useEffect(() => {
    if (token) getUserNames(token).then(setAssignableUsers).catch(() => {});
  }, [token]);

  async function handleAssignPssr(itemId: number, userId: number | null) {
    const item = (moc.pssr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    setAssigning((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updatePssrItem(token, itemId, { status: item.status, notes: item.notes || '', assigned_to: userId });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleCreate() {
    setLoading(true);
    try {
      await createPssr(token, moc.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleItemUpdate(itemId: number, status: string) {
    try {
      await updatePssrItem(token, itemId, { status, notes: itemNotes[itemId] ?? '' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleNoteSave(itemId: number, status: string) {
    setSavingNotes((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updatePssrItem(token, itemId, { status, notes: itemNotes[itemId] ?? '' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingNotes((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleComplete() {
    if (!confirm('Mark PSSR as complete? All items must pass or be N/A.')) return;
    setLoading(true);
    try {
      await completePssr(token, moc.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportPssrReport(token, moc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleResolveAction(itemId: number, resolved: boolean) {
    const item = (moc.pssr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    try {
      await updatePssrItem(token, itemId, { status: item.status, notes: item.notes || '', action_resolved: resolved });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleActionTypeToggle(itemId: number, actionType: string) {
    const item = (moc.pssr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    try {
      await updatePssrItem(token, itemId, { status: item.status, notes: item.notes || '', action_resolved: item.action_resolved, action_type: actionType } as any);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleFillAll(status: 'pass' | 'na') {
    const pending = (moc.pssr?.items || []).filter((i: any) => i.status === 'pending');
    if (pending.length === 0) return;
    setLoading(true);
    try {
      for (const item of pending) {
        await updatePssrItem(token, item.id, { status, notes: '' });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!moc.pssr) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No PSSR checklist exists for this MOC.
        </p>
      </div>
    );
  }

  const items = moc.pssr.items || [];
  const grouped = PSSR_CATEGORIES.reduce((acc: Record<string, any[]>, cat) => {
    acc[cat] = items.filter((item: any) => item.category === cat);
    return acc;
  }, {} as Record<string, any[]>);

  const totalItems = items.length;
  const completedItems = items.filter((i: any) => i.status !== 'pending').length;
  const actionItems = items.filter((i: any) => i.status === 'fail');

  return (
    <ReviewableSection sectionId="pssr.checklist" reviewNotes={reviewNotes} onOpenNotes={onOpenNotes}>
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Pre-Startup Safety Review</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Progress: {completedItems}/{totalItems} items reviewed
            {moc.pssr.completed_at && <span className="text-green-600 ml-2 font-medium">Completed</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {!moc.pssr.completed_at && (
            <>
              <button onClick={() => handleFillAll('pass')} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {loading ? '...' : 'Fill All Yes'}
              </button>
              <button onClick={() => handleFillAll('na')} disabled={loading} className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {loading ? '...' : 'Fill All N/A'}
              </button>
            </>
          )}
          <button onClick={handleExport} disabled={exporting} className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {exporting ? 'Exporting...' : 'Export PSSR'}
          </button>
          {canComplete && (
            <button onClick={handleComplete} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm">
              {loading ? '...' : 'Mark Complete'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
        />
      </div>

      {/* PSSR Checklist Items */}
      {PSSR_CATEGORIES.map((cat) => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        const catLabel = (PSSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ');
        // Check if entire section is N/A
        const allNa = catItems.every((item: any) => item.status === 'na');
        return (
          <div key={cat} className={`card mb-4 ${allNa ? 'opacity-50' : ''}`}>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{catLabel}</h4>
            <div className="space-y-2">
              {catItems.map((item: any) => {
                const isNa = item.status === 'na';
                return (
                  <div key={item.id} className={`p-3 rounded-lg border transition-all ${
                    isNa
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : item.status === 'fail'
                        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-100 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleItemUpdate(item.id, e.target.value)}
                        disabled={!!moc.pssr.completed_at}
                        className={`text-xs rounded border px-2 py-1 font-medium flex-shrink-0 ${
                          item.status === 'pass' ? 'bg-green-50 border-green-300 text-green-700' :
                          item.status === 'fail' ? 'bg-red-50 border-red-300 text-red-700' :
                          item.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-400' :
                          'bg-yellow-50 border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Yes</option>
                        <option value="fail">No</option>
                        <option value="na">N/A</option>
                      </select>
                      <span className={`text-sm flex-1 ${isNa ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</span>
                    </div>
                    {!isNa && !moc.pssr.completed_at ? (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea
                          value={itemNotes[item.id] ?? item.notes ?? ''}
                          onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={item.status === 'fail' ? 'Required: describe corrective action needed...' : 'Add notes...'}
                          rows={1}
                          className={`input-field text-xs flex-1 resize-none ${item.status === 'fail' ? 'border-red-300 dark:border-red-700' : ''}`}
                        />
                        <button
                          onClick={() => handleNoteSave(item.id, item.status)}
                          disabled={savingNotes[item.id]}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap px-2 py-1"
                        >
                          {savingNotes[item.id] ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    ) : !isNa && item.notes ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{item.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Action Items Section — separated by pre/post-startup */}
      {actionItems.length > 0 && (() => {
        const preStartup = actionItems.filter((i: any) => !i.action_type || i.action_type === 'pre_startup');
        const postStartup = actionItems.filter((i: any) => i.action_type === 'post_startup');

        function renderActionItem(item: any, idx: number) {
          const catLabel = (PSSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category;
          const isResolved = !!item.action_resolved;
          const isPost = item.action_type === 'post_startup';
          return (
            <div key={item.id} className={`p-3 rounded-lg border ${isResolved ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-start gap-3">
                <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ${isResolved ? 'text-green-600 bg-green-100 dark:bg-green-900/40' : 'text-red-600 bg-red-100 dark:bg-red-900/40'}`}>{isResolved ? '\u2713' : idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-red-500 dark:text-red-400">{catLabel}</span>
                    {!moc.pssr.completed_at && (
                      <select
                        value={item.action_type || 'pre_startup'}
                        onChange={(e) => handleActionTypeToggle(item.id, e.target.value)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      >
                        <option value="pre_startup">Pre-Startup</option>
                        <option value="post_startup">Post-Startup</option>
                      </select>
                    )}
                    {moc.pssr.completed_at && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isPost ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {isPost ? 'Post-Startup' : 'Pre-Startup'}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${isResolved ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</p>
                  {item.notes && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
                      <strong>Notes:</strong> {item.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleResolveAction(item.id, !isResolved)}
                  className={`text-xs font-medium px-3 py-1 rounded-lg border flex-shrink-0 transition-colors ${
                    isResolved
                      ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400 hover:bg-green-100'
                      : 'bg-gray-50 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {isResolved ? 'Resolved' : 'Mark Resolved'}
                </button>
              </div>
              <div className="mt-2 ml-9 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to:</span>
                <select
                  value={item.assigned_to || ''}
                  onChange={(e) => handleAssignPssr(item.id, e.target.value ? parseInt(e.target.value) : null)}
                  disabled={assigning[item.id]}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        }

        return (
          <>
            {preStartup.length > 0 && (
              <div className="card mb-4 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10">
                <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                  Pre-Startup Action Items ({preStartup.length})
                  {preStartup.filter((i: any) => i.action_resolved).length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                      {preStartup.filter((i: any) => i.action_resolved).length}/{preStartup.length} resolved
                    </span>
                  )}
                </h4>
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">These items must be resolved before PSSR can be completed.</p>
                <div className="space-y-2">
                  {preStartup.map((item: any, idx: number) => renderActionItem(item, idx))}
                </div>
              </div>
            )}
            {postStartup.length > 0 && (
              <div className="card mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                  Post-Startup Action Items ({postStartup.length})
                  {postStartup.filter((i: any) => i.action_resolved).length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                      {postStartup.filter((i: any) => i.action_resolved).length}/{postStartup.length} resolved
                    </span>
                  )}
                </h4>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">These items can be tracked after startup and do not block PSSR completion.</p>
                <div className="space-y-2">
                  {postStartup.map((item: any, idx: number) => renderActionItem(item, idx))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Custom Actions for PSSR */}
      {moc.pssr && !moc.pssr.completed_at && (
        <div className="card mb-4 border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10">
          <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-3">Custom Actions</h4>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">Add additional action items not covered by the standard checklist.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={pssrCustomItemDesc}
              onChange={(e) => setPssrCustomItemDesc(e.target.value)}
              placeholder="Describe the custom action item..."
              className="input-field text-sm flex-1"
            />
            <button
              onClick={async () => {
                if (!pssrCustomItemDesc.trim()) return;
                setAddingPssrCustom(true);
                try {
                  await addPssrCustomItem(token, moc.id, { description: pssrCustomItemDesc.trim() });
                  setPssrCustomItemDesc('');
                  onRefresh();
                } catch (err: any) {
                  alert(err.message);
                } finally {
                  setAddingPssrCustom(false);
                }
              }}
              disabled={addingPssrCustom || !pssrCustomItemDesc.trim()}
              className="btn-primary text-sm whitespace-nowrap"
            >
              {addingPssrCustom ? 'Adding...' : 'Add Item'}
            </button>
          </div>
          {(moc.pssr?.items || []).filter((i: any) => i.is_custom).length > 0 && (
            <div className="mt-3 space-y-2">
              {(moc.pssr.items || []).filter((i: any) => i.is_custom).map((item: any) => {
                const isNa = item.status === 'na';
                return (
                  <div key={item.id} className={`p-3 rounded-lg border transition-all ${
                    isNa
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : item.status === 'fail'
                        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleItemUpdate(item.id, e.target.value)}
                        disabled={!!moc.pssr.completed_at}
                        className={`text-xs rounded border px-2 py-1 font-medium flex-shrink-0 ${
                          item.status === 'pass' ? 'bg-green-50 border-green-300 text-green-700' :
                          item.status === 'fail' ? 'bg-red-50 border-red-300 text-red-700' :
                          item.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-400' :
                          'bg-yellow-50 border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Yes</option>
                        <option value="fail">No</option>
                        <option value="na">N/A</option>
                      </select>
                      <span className="text-xs font-medium text-indigo-500 flex-shrink-0 mt-0.5">Custom</span>
                      <span className={`text-sm flex-1 ${isNa ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</span>
                    </div>
                    {!isNa && !moc.pssr.completed_at ? (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea
                          value={itemNotes[item.id] ?? item.notes ?? ''}
                          onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={item.status === 'fail' ? 'Required: describe corrective action needed...' : 'Add notes...'}
                          rows={1}
                          className={`input-field text-xs flex-1 resize-none ${item.status === 'fail' ? 'border-red-300 dark:border-red-700' : ''}`}
                        />
                        <button
                          onClick={() => handleNoteSave(item.id, item.status)}
                          disabled={savingNotes[item.id]}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap px-2 py-1"
                        >
                          {savingNotes[item.id] ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    ) : !isNa && item.notes ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{item.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
    </ReviewableSection>
  );
}

function AttachmentsTab({ moc, token, onRefresh, user }: { moc: any; token: string; onRefresh: () => void; user: any }) {
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const attachments: any[] = moc.attachments || [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAttachment(token, moc.id, file);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteAttachment(token, id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function fileIcon(mime: string) {
    if (['image/jpeg', 'image/png'].includes(mime)) {
      return (
        <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mime === 'application/pdf') {
      return (
        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <label className="btn-primary cursor-pointer inline-block">
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">PDF, Word, Excel, CSV, images (max 10MB)</span>
      </div>

      <div className="space-y-2">
        {attachments.map((att: any, idx: number) => (
          <div key={att.id} className="card flex justify-between items-center py-3">
            <div className="flex items-center gap-3 min-w-0">
              {fileIcon(att.mime_type)}
              <div className="min-w-0">
                <button
                  onClick={() => setPreviewIdx(idx)}
                  className="font-medium text-brand-600 hover:underline text-left truncate block max-w-full"
                >
                  {att.original_name}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(att.size / 1024).toFixed(1)} KB — Uploaded by {att.uploader_name} on {new Date(att.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={getDownloadUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              {(att.uploaded_by === user?.id || user?.role === 'admin') && (
                <button onClick={() => handleDelete(att.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
              )}
            </div>
          </div>
        ))}
        {attachments.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-center py-8">No attachments</p>
        )}
      </div>

      {previewIdx !== null && attachments[previewIdx] && (
        <FilePreviewModal
          attachment={attachments[previewIdx]}
          token={token}
          onClose={() => setPreviewIdx(null)}
          onPrev={previewIdx > 0 ? () => setPreviewIdx(previewIdx - 1) : undefined}
          onNext={previewIdx < attachments.length - 1 ? () => setPreviewIdx(previewIdx + 1) : undefined}
        />
      )}
    </div>
  );
}

function ScopeValidationTab({ moc, token, onRefresh }: { moc: any; token: string; onRefresh: () => void }) {
  const [postChange, setPostChange] = useState<any[]>(moc.scope_post_change || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canEditPostChange = ['implementing', 'pssr', 'approved', 'closed'].includes(moc.status);
  const baseline = moc.scope_baseline || [];

  // Ensure postChange mirrors baseline structure
  useEffect(() => {
    if (baseline.length > 0 && postChange.length !== baseline.length) {
      const synced = baseline.map((bp: any, i: number) => ({
        name: bp.name,
        value: postChange[i]?.value ?? null,
        unit: bp.unit,
      }));
      setPostChange(synced);
    }
  }, [baseline]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateMoc(token, moc.id, { scope_post_change: postChange });
      setSaved(true);
      onRefresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save post-change values');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ScopeComparisonView baseline={baseline} postChange={postChange} />

      {canEditPostChange && (
        <>
          <ScopePostChangeEditor
            baseline={baseline}
            postChange={postChange}
            onChange={setPostChange}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Expected Values'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ImprovementsRealizedTab({ moc, token, onRefresh }: { moc: any; token: string; onRefresh: () => void }) {
  const [realized, setRealized] = useState<any[]>(moc.scope_realized || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const baseline = moc.scope_baseline || [];
  const postChange = moc.scope_post_change || [];
  const canEdit = ['improvements_realized', 'pssr_complete', 'closed'].includes(moc.status);

  // Ensure realized mirrors baseline structure
  useEffect(() => {
    if (baseline.length > 0 && realized.length !== baseline.length) {
      const synced = baseline.map((bp: any, i: number) => ({
        name: bp.name,
        value: realized[i]?.value ?? null,
        unit: bp.unit,
      }));
      setRealized(synced);
    }
  }, [baseline]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateMoc(token, moc.id, { scope_realized: realized });
      setSaved(true);
      onRefresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save realized values');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportCsv() {
    try {
      await exportImprovementsCsv(token);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  }

  return (
    <div className="space-y-6">
      {canEdit ? (
        <>
          <ImprovementsRealizedEditor
            baseline={baseline}
            postChange={postChange}
            realized={realized}
            onChange={setRealized}
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={handleExportCsv}
              className="btn-secondary"
            >
              Export All Improvements (CSV)
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Realized Values'}
            </button>
          </div>
        </>
      ) : (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Improvements Realized</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Realized improvement values can be entered once the MOC reaches the <strong>Improvements Realized</strong> step.
          </p>
          <div className="mt-4">
            <button
              onClick={handleExportCsv}
              className="btn-secondary text-sm"
            >
              Export All Improvements (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DsrTab({ moc, token, onRefresh, user }: { moc: any; token: string; onRefresh: () => void; user: any }) {
  const [loading, setLoading] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  const canCreate = moc.status === 'dsr' && ['ehs', 'operations', 'admin', 'super_admin', 'moc_manager'].includes(user?.role);
  // DSR completion restricted to MOC owner + admins (created_by or transferred_to)
  const isOwnerOrAdmin =
    moc.created_by === user?.id ||
    moc.transferred_to === user?.id ||
    isAdminUserCheck(user);
  const canComplete = moc.dsr && !moc.dsr.completed_at && isOwnerOrAdmin;

  useEffect(() => {
    if (moc.dsr?.items) {
      const notesMap: Record<number, string> = {};
      for (const item of moc.dsr.items) {
        notesMap[item.id] = item.notes || '';
      }
      setItemNotes(notesMap);
    }
  }, [moc.dsr?.items]);

  useEffect(() => {
    if (token) getUserNames(token).then(setAssignableUsers).catch(() => {});
  }, [token]);

  async function handleAssignDsr(itemId: number, userId: number | null) {
    const item = (moc.dsr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    setAssigning((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateDsrItem(token, itemId, { status: item.status, notes: item.notes || '', assigned_to: userId });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleCreate() {
    setLoading(true);
    try {
      await createDsr(token, moc.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleItemUpdate(itemId: number, status: string) {
    try {
      await updateDsrItem(token, itemId, { status, notes: itemNotes[itemId] ?? '' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleNoteSave(itemId: number, status: string) {
    setSavingNotes((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateDsrItem(token, itemId, { status, notes: itemNotes[itemId] ?? '' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingNotes((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleComplete() {
    if (!confirm('Mark DSR as complete? All deficiencies must be resolved.')) return;
    setLoading(true);
    try {
      await completeDsr(token, moc.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveAction(itemId: number, resolved: boolean) {
    const item = (moc.dsr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    try {
      await updateDsrItem(token, itemId, { status: item.status, notes: item.notes || '', action_resolved: resolved });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleFillAll(status: 'pass' | 'na') {
    const pending = (moc.dsr?.items || []).filter((i: any) => i.status === 'pending');
    if (pending.length === 0) return;
    setLoading(true);
    try {
      for (const item of pending) {
        await updateDsrItem(token, item.id, { status, notes: '' });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportDsrReport(token, moc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (!moc.dsr) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {moc.status === 'dsr' ? 'DSR checklist is being created...' : 'No DSR is required for this MOC, or the MOC has not reached the DSR phase yet.'}
        </p>
      </div>
    );
  }

  const items = moc.dsr.items || [];
  const grouped = DSR_CATEGORIES.reduce((acc: Record<string, any[]>, cat) => {
    acc[cat] = items.filter((item: any) => item.category === cat);
    return acc;
  }, {} as Record<string, any[]>);

  const totalItems = items.length;
  const completedItems = items.filter((i: any) => i.status !== 'pending').length;
  const actionItems = items.filter((i: any) => i.status === 'fail');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">DSR (Design Safety Review)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Progress: {completedItems}/{totalItems} items reviewed
            {moc.dsr.completed_at && <span className="text-green-600 ml-2 font-medium">Completed</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {!moc.dsr.completed_at && (
            <>
              <button onClick={() => handleFillAll('pass')} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {loading ? '...' : 'Fill All Yes'}
              </button>
              <button onClick={() => handleFillAll('na')} disabled={loading} className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {loading ? '...' : 'Fill All N/A'}
              </button>
            </>
          )}
          {canComplete && (
            <button onClick={handleComplete} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm">
              {loading ? '...' : 'Mark Complete'}
            </button>
          )}
          <button onClick={handleExport} disabled={exporting} className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {exporting ? 'Exporting...' : 'Export DSR'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
        />
      </div>

      {/* DSR Checklist Items */}
      {DSR_CATEGORIES.map((cat) => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        const catLabel = (DSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ');
        const allNa = catItems.every((item: any) => item.status === 'na');
        return (
          <div key={cat} className={`card mb-4 ${allNa ? 'opacity-50' : ''}`}>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{catLabel}</h4>
            <div className="space-y-2">
              {catItems.map((item: any) => {
                const isNa = item.status === 'na';
                return (
                  <div key={item.id} className={`p-3 rounded-lg border transition-all ${
                    isNa
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : item.status === 'fail'
                        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-100 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleItemUpdate(item.id, e.target.value)}
                        disabled={!!moc.dsr.completed_at}
                        className={`text-xs rounded border px-2 py-1 font-medium flex-shrink-0 ${
                          item.status === 'pass' ? 'bg-green-50 border-green-300 text-green-700' :
                          item.status === 'fail' ? 'bg-red-50 border-red-300 text-red-700' :
                          item.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-400' :
                          'bg-yellow-50 border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Yes</option>
                        <option value="fail">No</option>
                        <option value="na">N/A</option>
                      </select>
                      <span className={`text-sm flex-1 ${isNa ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</span>
                    </div>
                    {!isNa && !moc.dsr.completed_at ? (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea
                          value={itemNotes[item.id] ?? item.notes ?? ''}
                          onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={item.status === 'fail' ? 'Required: describe the deficiency...' : 'Add notes...'}
                          rows={1}
                          className={`input-field text-xs flex-1 resize-none ${item.status === 'fail' ? 'border-red-300 dark:border-red-700' : ''}`}
                        />
                        <button
                          onClick={() => handleNoteSave(item.id, item.status)}
                          disabled={savingNotes[item.id]}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap px-2 py-1"
                        >
                          {savingNotes[item.id] ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    ) : !isNa && item.notes ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{item.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Custom Actions */}
      {!moc.dsr.completed_at && (
        <div className="card mb-4 border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10">
          <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-3">Custom Actions</h4>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">Add additional action items not covered by the standard checklist.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customItemDesc}
              onChange={(e) => setCustomItemDesc(e.target.value)}
              placeholder="Describe the custom action item..."
              className="input-field text-sm flex-1"
            />
            <button
              onClick={async () => {
                if (!customItemDesc.trim()) return;
                setAddingCustom(true);
                try {
                  await addDsrCustomItem(token, moc.id, { description: customItemDesc.trim() });
                  setCustomItemDesc('');
                  onRefresh();
                } catch (err: any) {
                  alert(err.message);
                } finally {
                  setAddingCustom(false);
                }
              }}
              disabled={addingCustom || !customItemDesc.trim()}
              className="btn-primary text-sm whitespace-nowrap"
            >
              {addingCustom ? 'Adding...' : 'Add Item'}
            </button>
          </div>
          {/* Show existing custom items with full yes/no + notes controls */}
          {items.filter((i: any) => i.is_custom).length > 0 && (
            <div className="mt-3 space-y-2">
              {items.filter((i: any) => i.is_custom).map((item: any) => {
                const isNa = item.status === 'na';
                return (
                  <div key={item.id} className={`p-3 rounded-lg border transition-all ${
                    isNa
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : item.status === 'fail'
                        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleItemUpdate(item.id, e.target.value)}
                        disabled={!!moc.dsr.completed_at}
                        className={`text-xs rounded border px-2 py-1 font-medium flex-shrink-0 ${
                          item.status === 'pass' ? 'bg-green-50 border-green-300 text-green-700' :
                          item.status === 'fail' ? 'bg-red-50 border-red-300 text-red-700' :
                          item.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-400' :
                          'bg-yellow-50 border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Yes</option>
                        <option value="fail">No</option>
                        <option value="na">N/A</option>
                      </select>
                      <span className="text-xs font-medium text-indigo-500 flex-shrink-0 mt-0.5">Custom</span>
                      <span className={`text-sm flex-1 ${isNa ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</span>
                    </div>
                    {!isNa && !moc.dsr.completed_at ? (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea
                          value={itemNotes[item.id] ?? item.notes ?? ''}
                          onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={item.status === 'fail' ? 'Required: describe the deficiency...' : 'Add notes...'}
                          rows={1}
                          className={`input-field text-xs flex-1 resize-none ${item.status === 'fail' ? 'border-red-300 dark:border-red-700' : ''}`}
                        />
                        <button
                          onClick={() => handleNoteSave(item.id, item.status)}
                          disabled={savingNotes[item.id]}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap px-2 py-1"
                        >
                          {savingNotes[item.id] ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    ) : !isNa && item.notes ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{item.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Items Section */}
      {actionItems.length > 0 && (
        <div className="card mb-4 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10">
          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
            Deficiencies ({actionItems.length})
            {actionItems.filter((i: any) => i.action_resolved).length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                {actionItems.filter((i: any) => i.action_resolved).length}/{actionItems.length} resolved
              </span>
            )}
          </h4>
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">Items marked &quot;No&quot; must be reported in writing and resolved before the MOC can proceed.</p>
          <div className="space-y-2">
            {actionItems.map((item: any, idx: number) => {
              const catLabel = (DSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category;
              const isResolved = !!item.action_resolved;
              return (
                <div key={item.id} className={`p-3 rounded-lg border ${isResolved ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ${isResolved ? 'text-green-600 bg-green-100 dark:bg-green-900/40' : 'text-red-600 bg-red-100 dark:bg-red-900/40'}`}>{isResolved ? '\u2713' : idx + 1}</span>
                    <div className="flex-1">
                      <span className="text-xs font-medium text-red-500 dark:text-red-400">{catLabel}</span>
                      <p className={`text-sm ${isResolved ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</p>
                      {item.notes && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
                          <strong>Notes:</strong> {item.notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleResolveAction(item.id, !isResolved)}
                      className={`text-xs font-medium px-3 py-1 rounded-lg border flex-shrink-0 transition-colors ${
                        isResolved
                          ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400 hover:bg-green-100'
                          : 'bg-gray-50 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                      }`}
                    >
                      {isResolved ? 'Resolved' : 'Mark Resolved'}
                    </button>
                  </div>
                  <div className="mt-2 ml-9 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to:</span>
                    <select
                      value={item.assigned_to || ''}
                      onChange={(e) => handleAssignDsr(item.id, e.target.value ? parseInt(e.target.value) : null)}
                      disabled={assigning[item.id]}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function TimelineTab({ moc }: { moc: any }) {
  return (
    <div className="card">
      <div className="space-y-0">
        {(moc.timeline || []).map((entry: any, i: number) => (
          <div key={entry.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-brand-500 flex-shrink-0" />
              {i < moc.timeline.length - 1 && <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-1" />}
            </div>
            <div className="flex-1 -mt-0.5">
              <p className="text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-100">{entry.changer_name}</span>
                {' '}
                {entry.from_status ? (
                  <>
                    changed status from <StatusBadge status={entry.from_status} /> to <StatusBadge status={entry.to_status} />
                  </>
                ) : (
                  <>created this MOC</>
                )}
              </p>
              {entry.comment && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{entry.comment}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(entry.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {(moc.timeline || []).length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-center py-8">No timeline entries</p>
        )}
      </div>
    </div>
  );
}

function ActionItemsTab({ moc, token, onRefresh, user }: { moc: any; token: string; onRefresh: () => void; user: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [externalAssignments, setExternalAssignments] = useState<any[]>([]);
  const [externalForm, setExternalForm] = useState<{ key: string; email: string; name: string } | null>(null);
  const [sendingExternal, setSendingExternal] = useState(false);

  useEffect(() => {
    if (token) {
      getUserNames(token).then(setUsers).catch(() => {});
      if (moc.id) {
        getExternalAssignments(token, moc.id).then(setExternalAssignments).catch(() => {});
      }
    }
  }, [token, moc.id]);

  const dsrItems = (moc.dsr?.items || []).filter((i: any) => i.status === 'fail');
  const pssrItems = (moc.pssr?.items || []).filter((i: any) => i.status === 'fail');
  const pssrPreStartup = pssrItems.filter((i: any) => !i.action_type || i.action_type === 'pre_startup');
  const pssrPostStartup = pssrItems.filter((i: any) => i.action_type === 'post_startup');

  const allItems = [
    ...dsrItems.map((i: any) => ({ ...i, source: 'dsr' })),
    ...pssrItems.map((i: any) => ({ ...i, source: 'pssr' })),
  ];
  const unresolvedCount = allItems.filter((i) => !i.action_resolved).length;
  const resolvedCount = allItems.filter((i) => i.action_resolved).length;

  async function handleAssign(itemId: number, source: 'dsr' | 'pssr', userId: number | null) {
    const key = `${source}-${itemId}`;
    setAssigning((prev) => ({ ...prev, [key]: true }));
    try {
      const item = source === 'dsr'
        ? (moc.dsr?.items || []).find((i: any) => i.id === itemId)
        : (moc.pssr?.items || []).find((i: any) => i.id === itemId);
      if (!item) return;
      if (source === 'dsr') {
        await updateDsrItem(token, itemId, { status: item.status, notes: item.notes || '', assigned_to: userId });
      } else {
        await updatePssrItem(token, itemId, { status: item.status, notes: item.notes || '', assigned_to: userId });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning((prev) => ({ ...prev, [`${source}-${itemId}`]: false }));
    }
  }

  async function handleResolve(itemId: number, source: 'dsr' | 'pssr', resolved: boolean) {
    const item = source === 'dsr'
      ? (moc.dsr?.items || []).find((i: any) => i.id === itemId)
      : (moc.pssr?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    try {
      if (source === 'dsr') {
        await updateDsrItem(token, itemId, { status: item.status, notes: item.notes || '', action_resolved: resolved });
      } else {
        await updatePssrItem(token, itemId, { status: item.status, notes: item.notes || '', action_resolved: resolved });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAssignExternal() {
    if (!externalForm || !externalForm.email.trim()) return;
    const [itemType, itemIdStr] = externalForm.key.split('-');
    setSendingExternal(true);
    try {
      await assignExternalAction(token, {
        item_type: itemType,
        item_id: parseInt(itemIdStr),
        email: externalForm.email.trim(),
        name: externalForm.name.trim() || undefined,
      });
      // Refresh external assignments
      const updated = await getExternalAssignments(token, moc.id);
      setExternalAssignments(updated);
      setExternalForm(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingExternal(false);
    }
  }

  async function handleRevokeExternal(assignmentId: number) {
    try {
      await revokeExternalAssignment(token, assignmentId);
      setExternalAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (allItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No action items. Items appear here when a DSR or PSSR checklist item is marked &quot;No&quot;.</p>
      </div>
    );
  }

  const renderItem = (item: any, source: 'dsr' | 'pssr') => {
    const isResolved = item.action_resolved;
    const key = `${source}-${item.id}`;
    const categoryLabel = source === 'dsr'
      ? (DSR_CATEGORY_LABELS as any)[item.category] || item.category
      : (PSSR_CATEGORY_LABELS as any)[item.category] || item.category;

    return (
      <div key={key} className={`p-4 rounded-lg border-2 ${isResolved ? 'border-green-200 dark:border-green-800/40 bg-green-50/30 dark:bg-green-900/10' : 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${source === 'dsr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                {source.toUpperCase()}
              </span>
              {source === 'pssr' && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.action_type === 'post_startup' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                  {item.action_type === 'post_startup' ? 'Post-Startup' : 'Pre-Startup'}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">{categoryLabel}</span>
              {isResolved && <span className="text-xs font-bold text-green-600 dark:text-green-400">RESOLVED</span>}
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200">{item.description}</p>
            {item.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">{item.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={() => handleResolve(item.id, source, !isResolved)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${isResolved ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isResolved ? 'Reopen' : 'Mark Resolved'}
            </button>
          </div>
        </div>
        {/* Assignment — internal user */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to:</span>
          <select
            value={item.assigned_to || ''}
            onChange={(e) => handleAssign(item.id, source, e.target.value ? parseInt(e.target.value) : null)}
            disabled={assigning[key]}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          >
            <option value="">Unassigned</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {item.assigned_to_name && !assigning[key] && (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.assigned_to_name}</span>
          )}
          <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
          <button
            onClick={() => setExternalForm(externalForm?.key === key ? null : { key, email: '', name: '' })}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {externalForm?.key === key ? 'Cancel' : 'Assign External'}
          </button>
        </div>

        {/* External assignment form */}
        {externalForm?.key === key && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">Assign to someone outside the MOC system — they will receive an email to respond.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={externalForm.email}
                onChange={(e) => setExternalForm({ ...externalForm, email: e.target.value })}
                placeholder="Email address"
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              />
              <input
                type="text"
                value={externalForm.name}
                onChange={(e) => setExternalForm({ ...externalForm, name: e.target.value })}
                placeholder="Name (optional)"
                className="w-32 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handleAssignExternal}
                disabled={sendingExternal || !externalForm.email.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {sendingExternal ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* External assignments for this item */}
        {externalAssignments.filter((a) => a.item_type === source && a.item_id === item.id).length > 0 && (
          <div className="mt-2 space-y-1">
            {externalAssignments
              .filter((a) => a.item_type === source && a.item_id === item.id)
              .map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-50 dark:bg-gray-800/50">
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    {a.name || a.email}
                  </span>
                  {a.name && <span className="text-gray-400">({a.email})</span>}
                  {a.responded_at ? (
                    <span className={`font-bold px-1.5 py-0.5 rounded ${a.marked_done ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                      {a.marked_done ? 'Done' : 'Responded'}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                  )}
                  {a.response_note && (
                    <span className="text-gray-500 dark:text-gray-400 italic truncate max-w-[200px]" title={a.response_note}>
                      &quot;{a.response_note}&quot;
                    </span>
                  )}
                  <button
                    onClick={() => handleRevokeExternal(a.id)}
                    className="ml-auto text-red-500 hover:text-red-700 dark:text-red-400"
                    title="Revoke assignment"
                  >
                    &times;
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Action Items Summary</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              {unresolvedCount} open
            </span>
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              {resolvedCount} resolved
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="bg-green-600 h-2.5 rounded-full transition-all" style={{ width: `${allItems.length ? (resolvedCount / allItems.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* DSR Action Items */}
      {dsrItems.length > 0 && (
        <div className="card">
          <h3 className="text-md font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">DSR</span>
            DSR Action Items ({dsrItems.length})
          </h3>
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">All DSR action items must be resolved before the MOC can advance past the DSR phase.</p>
          <div className="space-y-3">
            {dsrItems.map((item: any) => renderItem(item, 'dsr'))}
          </div>
        </div>
      )}

      {/* PSSR Pre-Startup Action Items */}
      {pssrPreStartup.length > 0 && (
        <div className="card">
          <h3 className="text-md font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">PSSR</span>
            Pre-Startup Action Items ({pssrPreStartup.length})
          </h3>
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">Pre-startup items must be resolved before the MOC can advance past PSSR.</p>
          <div className="space-y-3">
            {pssrPreStartup.map((item: any) => renderItem(item, 'pssr'))}
          </div>
        </div>
      )}

      {/* PSSR Post-Startup Action Items */}
      {pssrPostStartup.length > 0 && (
        <div className="card">
          <h3 className="text-md font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">PSSR</span>
            Post-Startup Action Items ({pssrPostStartup.length})
          </h3>
          <p className="text-xs text-sky-600 dark:text-sky-400 mb-4">Post-startup items can be completed after the MOC advances and do not block workflow progression.</p>
          <div className="space-y-3">
            {pssrPostStartup.map((item: any) => renderItem(item, 'pssr'))}
          </div>
        </div>
      )}
    </div>
  );
}

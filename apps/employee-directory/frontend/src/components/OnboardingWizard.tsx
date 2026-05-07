import { useState, useCallback } from "react";
import type { EmployeeRecord, OnboardingEvent, OnboardingTask } from "../api/types";
import {
  startOnboarding,
  getOnboardingStatus,
  getOnboardingEmails,
  signOnboarding,
  type StartOnboardingResponse,
} from "../api/automation";
import { apiFetch } from "../api/client";
import Modal from "./Modal";
import OnboardingTaskList from "./OnboardingTaskList";

type OnboardingWizardProps = {
  employee: EmployeeRecord;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  companyId: number | null;
};

type WizardStep = "initiation" | "dashboard" | "signoff" | "summary";

function OnboardingWizard({
  employee,
  isOpen,
  onClose,
  onRefresh,
  companyId,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("initiation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initiation form state
  const [notes, setNotes] = useState("");

  // Event state
  const [event, setEvent] = useState<OnboardingEvent | null>(null);
  const [categories, setCategories] = useState<Record<string, OnboardingTask[]>>({});
  const [autoResults, setAutoResults] = useState<StartOnboardingResponse["automation"] | null>(null);

  // Sign-off state
  const [itSignoffName, setItSignoffName] = useState("");
  const [managerSignoffName, setManagerSignoffName] = useState("");

  // Email templates state
  const [managerEmail, setManagerEmail] = useState("");
  const [announcementEmail, setAnnouncementEmail] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!event) return;
    try {
      const status = await getOnboardingStatus(event.id);
      setEvent(status.event);
      setCategories(status.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh status");
    }
  }, [event]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await startOnboarding(employee.id, {
        notes: notes || undefined,
      });
      setEvent(response.event);
      setAutoResults(response.automation);

      const cats: Record<string, OnboardingTask[]> = {};
      for (const task of response.event.tasks) {
        const cat = task.category || task.task_type || "other";
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push(task);
      }
      setCategories(cats);
      setStep("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
    } finally {
      setLoading(false);
    }
  };

  const handleManualComplete = async (taskId: number) => {
    await apiFetch(`/automation/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    await refreshStatus();
  };

  const handleSignoff = async (role: "it" | "manager", name: string) => {
    if (!event || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await signOnboarding(event.id, role, name.trim());
      setEvent(response.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sign-off");
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = useCallback(async () => {
    try {
      const data = await getOnboardingEmails(employee.id, companyId);
      setManagerEmail(data.manager_email);
      setAnnouncementEmail(data.announcement_email);
    } catch {
      // Non-critical — emails section will just be empty
    }
  }, [employee.id, companyId]);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleOpenWelcomePacket = () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
    const qs = companyId ? `?company_id=${companyId}` : "";
    window.open(
      `${baseUrl}/automation/onboarding/${employee.id}/welcome-packet${qs}`,
      "_blank"
    );
  };

  const handleGoToSummary = async () => {
    setStep("summary");
    await loadEmails();
  };

  const handleClose = () => {
    if (loading) return;
    onRefresh();
    onClose();
    setStep("initiation");
    setEvent(null);
    setCategories({});
    setAutoResults(null);
    setError(null);
    setNotes("");
    setItSignoffName("");
    setManagerSignoffName("");
    setManagerEmail("");
    setAnnouncementEmail("");
    setCopiedField(null);
  };

  const allTasks = event?.tasks ?? [];
  const completedTasks = allTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped"
  ).length;
  const totalTasks = allTasks.length;

  return (
    <Modal
      isOpen={isOpen}
      title={`Onboard ${employee.full_name}`}
      onClose={handleClose}
    >
      <div className="offboarding-wizard">
        {/* Step indicators */}
        <div className="offboarding-wizard__steps">
          {(["initiation", "dashboard", "signoff", "summary"] as WizardStep[]).map(
            (s, i) => (
              <span
                key={s}
                className={`offboarding-wizard__step ${step === s ? "offboarding-wizard__step--active" : ""} ${
                  (["initiation", "dashboard", "signoff", "summary"] as WizardStep[]).indexOf(step) > i
                    ? "offboarding-wizard__step--done"
                    : ""
                }`}
              >
                {i + 1}. {s === "initiation" ? "Initiation" : s === "dashboard" ? "Tasks" : s === "signoff" ? "Sign-Off" : "Summary"}
              </span>
            )
          )}
        </div>

        {error && (
          <div className="inline-error">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Initiation */}
        {step === "initiation" && (
          <div className="offboarding-wizard__form">
            <p>
              Begin onboarding for <strong>{employee.full_name}</strong> ({employee.email}).
              This will create AD groups, distribution lists, home drive, M365 licenses,
              and generate setup tasks.
            </p>

            <label>
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special setup requirements..."
                rows={3}
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? "Starting..." : "Start Onboarding"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Dashboard */}
        {step === "dashboard" && (
          <div className="offboarding-wizard__dashboard">
            {autoResults && (
              <div className="offboarding-wizard__auto-summary">
                {autoResults.auto_completed > 0 && (
                  <span className="inline-success">
                    {autoResults.auto_completed} tasks auto-completed
                  </span>
                )}
                {autoResults.auto_failed > 0 && (
                  <span className="inline-error">
                    {autoResults.auto_failed} tasks failed (review below)
                  </span>
                )}
              </div>
            )}

            <OnboardingTaskList
              categories={categories}
              onTaskUpdated={refreshStatus}
              onManualComplete={handleManualComplete}
            />

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={refreshStatus}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep("signoff")}
              >
                Proceed to Sign-Off
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Sign-off */}
        {step === "signoff" && (
          <div className="offboarding-wizard__signoff">
            <p>
              {completedTasks} of {totalTasks} tasks completed.
            </p>

            <div className="offboarding-wizard__signoff-section">
              <h4>IT Technician Sign-Off</h4>
              {event?.it_signoff_name ? (
                <p className="inline-success">
                  Signed by {event.it_signoff_name} on{" "}
                  {event.it_signoff_date
                    ? new Date(event.it_signoff_date).toLocaleString()
                    : "\u2014"}
                </p>
              ) : (
                <div className="offboarding-wizard__signoff-form">
                  <input
                    type="text"
                    value={itSignoffName}
                    onChange={(e) => setItSignoffName(e.target.value)}
                    placeholder="IT technician name"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading || !itSignoffName.trim()}
                    onClick={() => handleSignoff("it", itSignoffName)}
                  >
                    {loading ? "Saving..." : "Sign Off"}
                  </button>
                </div>
              )}
            </div>

            <div className="offboarding-wizard__signoff-section">
              <h4>Manager Sign-Off</h4>
              {event?.manager_signoff_name ? (
                <p className="inline-success">
                  Signed by {event.manager_signoff_name} on{" "}
                  {event.manager_signoff_date
                    ? new Date(event.manager_signoff_date).toLocaleString()
                    : "\u2014"}
                </p>
              ) : (
                <div className="offboarding-wizard__signoff-form">
                  <input
                    type="text"
                    value={managerSignoffName}
                    onChange={(e) => setManagerSignoffName(e.target.value)}
                    placeholder="Manager name"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading || !managerSignoffName.trim()}
                    onClick={() => handleSignoff("manager", managerSignoffName)}
                  >
                    {loading ? "Saving..." : "Sign Off"}
                  </button>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => setStep("dashboard")}
              >
                Back to Tasks
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGoToSummary}
              >
                View Summary
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === "summary" && (
          <div className="offboarding-wizard__summary">
            <h3>Onboarding Complete</h3>
            <dl className="profile-card__grid">
              <div>
                <dt>Employee</dt>
                <dd>{employee.full_name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{employee.email}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{employee.department ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>{employee.title ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>
                  {completedTasks}/{totalTasks} completed
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{event?.status ?? "\u2014"}</dd>
              </div>
              <div>
                <dt>IT Sign-Off</dt>
                <dd>{event?.it_signoff_name ?? "Pending"}</dd>
              </div>
              <div>
                <dt>Manager Sign-Off</dt>
                <dd>{event?.manager_signoff_name ?? "Pending"}</dd>
              </div>
            </dl>

            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenWelcomePacket}
              >
                Print Welcome Packet
              </button>
            </div>

            {managerEmail && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ marginBottom: 4 }}>
                  Manager Email
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    style={{ marginLeft: 8, fontSize: 12 }}
                    onClick={() => handleCopy(managerEmail, "manager")}
                  >
                    {copiedField === "manager" ? "Copied!" : "Copy to Clipboard"}
                  </button>
                </h4>
                <pre style={{ background: "#f8fafc", padding: 12, borderRadius: 6, fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", border: "1px solid #e2e8f0" }}>
                  {managerEmail}
                </pre>
              </div>
            )}

            {announcementEmail && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 4 }}>
                  All-Staff Announcement
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    style={{ marginLeft: 8, fontSize: 12 }}
                    onClick={() => handleCopy(announcementEmail, "announcement")}
                  >
                    {copiedField === "announcement" ? "Copied!" : "Copy to Clipboard"}
                  </button>
                </h4>
                <pre style={{ background: "#f8fafc", padding: 12, borderRadius: 6, fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", border: "1px solid #e2e8f0" }}>
                  {announcementEmail}
                </pre>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClose}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default OnboardingWizard;

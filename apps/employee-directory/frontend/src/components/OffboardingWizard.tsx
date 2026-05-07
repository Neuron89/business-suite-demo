import { useState, useCallback } from "react";
import type { EmployeeRecord, OffboardingEvent, OffboardingTask } from "../api/types";
import {
  startOffboarding,
  getOffboardingStatus,
  signOffboarding,
  exportOffboardingChecklist,
  type StartOffboardingResponse,
} from "../api/automation";
import { apiFetch } from "../api/client";
import Modal from "./Modal";
import OffboardingTaskList from "./OffboardingTaskList";

type OffboardingWizardProps = {
  employee: EmployeeRecord;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

type WizardStep = "initiation" | "dashboard" | "signoff" | "summary";

function OffboardingWizard({
  employee,
  isOpen,
  onClose,
  onRefresh,
}: OffboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("initiation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initiation form state
  const [urgency, setUrgency] = useState<"standard" | "immediate">("standard");
  const [delegateEmail, setDelegateEmail] = useState("");
  const [litigationHold, setLitigationHold] = useState(false);
  const [convertSharedMailbox, setConvertSharedMailbox] = useState(false);

  // Event state
  const [event, setEvent] = useState<OffboardingEvent | null>(null);
  const [categories, setCategories] = useState<Record<string, OffboardingTask[]>>({});
  const [autoResults, setAutoResults] = useState<StartOffboardingResponse["automation"] | null>(null);

  // Sign-off state
  const [itSignoffName, setItSignoffName] = useState("");
  const [managerSignoffName, setManagerSignoffName] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!event) return;
    try {
      const status = await getOffboardingStatus(event.id);
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
      const response = await startOffboarding(employee.id, {
        urgency,
        delegate_email: delegateEmail || undefined,
        litigation_hold: litigationHold,
        convert_shared_mailbox: convertSharedMailbox,
      });
      setEvent(response.event);
      setAutoResults(response.automation);

      // Build categories from tasks
      const cats: Record<string, OffboardingTask[]> = {};
      for (const task of response.event.tasks) {
        const cat = task.category || task.task_type || "other";
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push(task);
      }
      setCategories(cats);
      setStep("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start offboarding");
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
      const response = await signOffboarding(event.id, role, name.trim());
      setEvent(response.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sign-off");
    } finally {
      setLoading(false);
    }
  };

  const handleExportChecklist = async () => {
    try {
      const checklistText = await exportOffboardingChecklist(employee.id);
      const blob = new Blob([checklistText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        employee.full_name.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "") ||
        `employee_${employee.id}`;
      link.href = url;
      link.download = `${safeName}_offboarding_complete.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export checklist");
    }
  };

  const handleClose = () => {
    if (loading) return;
    onRefresh();
    onClose();
    // Reset state
    setStep("initiation");
    setEvent(null);
    setCategories({});
    setAutoResults(null);
    setError(null);
    setUrgency("standard");
    setDelegateEmail("");
    setLitigationHold(false);
    setConvertSharedMailbox(false);
    setItSignoffName("");
    setManagerSignoffName("");
  };

  const allTasks = event?.tasks ?? [];
  const completedTasks = allTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped"
  ).length;
  const totalTasks = allTasks.length;

  return (
    <Modal
      isOpen={isOpen}
      title={`Offboard ${employee.full_name}`}
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
            <label>
              Urgency
              <select
                value={urgency}
                onChange={(e) =>
                  setUrgency(e.target.value as "standard" | "immediate")
                }
              >
                <option value="standard">Standard</option>
                <option value="immediate">Immediate</option>
              </select>
            </label>

            <label>
              Delegate Email (receives mailbox/OneDrive access)
              <input
                type="email"
                value={delegateEmail}
                onChange={(e) => setDelegateEmail(e.target.value)}
                placeholder="manager@company.com"
              />
            </label>

            <label className="offboarding-wizard__checkbox">
              <input
                type="checkbox"
                checked={convertSharedMailbox}
                onChange={(e) => setConvertSharedMailbox(e.target.checked)}
              />
              Convert mailbox to shared &amp; grant delegate access
            </label>

            <label className="offboarding-wizard__checkbox">
              <input
                type="checkbox"
                checked={litigationHold}
                onChange={(e) => setLitigationHold(e.target.checked)}
              />
              Enable litigation hold
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
                {loading ? "Starting..." : "Start Offboarding"}
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

            <OffboardingTaskList
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
                    : "—"}
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
                    : "—"}
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
                onClick={() => setStep("summary")}
              >
                View Summary
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === "summary" && (
          <div className="offboarding-wizard__summary">
            <h3>Offboarding Complete</h3>
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
                <dt>Urgency</dt>
                <dd>{event?.urgency ?? "standard"}</dd>
              </div>
              <div>
                <dt>Delegate</dt>
                <dd>{event?.delegate_email ?? "None"}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>
                  {completedTasks}/{totalTasks} completed
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{event?.status ?? "—"}</dd>
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

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportChecklist}
              >
                Export Checklist
              </button>
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

export default OffboardingWizard;

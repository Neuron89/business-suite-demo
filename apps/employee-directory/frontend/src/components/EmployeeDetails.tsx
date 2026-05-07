import { useEffect, useState } from "react";

import type {
  EmployeeRecord,
  HardwareAsset,
  SoftwareSubscription,
} from "../api/types";
import { exportOffboardingChecklist, triggerLocalAdSync } from "../api/automation";
import {
  createHardwareAsset,
  updateHardwareAsset,
  deleteHardwareAsset,
} from "../api/hardware";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from "../api/subscriptions";
import { createDirectoryGroup } from "../api/directoryGroups";
import {
  deleteEmployeeAccount,
  disableEmployeeAccount,
  resetEmployeePassword,
  syncEmployee,
  updateEmployeeProfile,
  type ResetPasswordPayload,
  type UpdateEmployeeProfilePayload,
} from "../api/employees";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatStatusLabel,
} from "../utils/format";
import HardwareForm, { type HardwareFormSubmission } from "./HardwareForm";
import SubscriptionForm, {
  type SubscriptionFormSubmission,
} from "./SubscriptionForm";
import DirectoryGroupForm, {
  type DirectoryGroupFormSubmission,
} from "./DirectoryGroupForm";
import Modal from "./Modal";
import EmployeeProfileForm from "./EmployeeProfileForm";
import PasswordResetForm from "./PasswordResetForm";
import OffboardingWizard from "./OffboardingWizard";
import OnboardingWizard from "./OnboardingWizard";
import EmployeeAvatar from "./EmployeeAvatar";
import { DoorList, ScheduleView } from "./PolicyAccessInfo";

type EmployeeDetailsProps = {
  employee: EmployeeRecord | null;
  onRefresh: () => Promise<void>;
  companyId: number | null;
};

type Tab = "overview" | "hardware" | "software" | "devices" | "access";

const LICENSE_SHORT_LABELS: { match: RegExp; label: string; tone: "primary" | "secondary" }[] = [
  { match: /^SPE_E5$|^ENTERPRISEPREMIUM/i, label: "M365 E5", tone: "primary" },
  { match: /^SPE_E3$|^ENTERPRISEPACK/i, label: "M365 E3", tone: "primary" },
  { match: /^SPE_E1$|^STANDARDPACK/i, label: "M365 E1", tone: "primary" },
  { match: /^SPB$|^O365_BUSINESS_PREMIUM|^BUSINESSPREMIUM/i, label: "Business Prem", tone: "primary" },
  { match: /^O365_BUSINESS_ESSENTIALS|^BUSINESSESSENTIALS/i, label: "Business Basic", tone: "primary" },
  { match: /^DESKLESSPACK|^SPE_F1|^M365_F1/i, label: "F1", tone: "primary" },
  { match: /^SPE_F3|^M365_F3|^DESKLESS/i, label: "F3", tone: "primary" },
  { match: /EXCHANGE.*STANDARD/i, label: "Exchange", tone: "secondary" },
  { match: /POWER_BI/i, label: "Power BI", tone: "secondary" },
  { match: /VISIO/i, label: "Visio", tone: "secondary" },
  { match: /PROJECT/i, label: "Project", tone: "secondary" },
];

function formatLicenseLabel(sku: string | null): { label: string; tone: "primary" | "secondary" } | null {
  if (!sku) return null;
  for (const { match, label, tone } of LICENSE_SHORT_LABELS) {
    if (match.test(sku)) return { label, tone };
  }
  return { label: sku.replace(/_/g, " "), tone: "secondary" };
}

function renderAccessChips(employee: EmployeeRecord) {
  const primaryLicense = employee.license_assignments
    .map((a) => formatLicenseLabel(a.sku_part_number ?? a.sku_name))
    .find((x) => x && x.tone === "primary");
  return (
    <div className="access-chips">
      {primaryLicense && (
        <span className="access-chip access-chip--m365" title="Microsoft 365 license">
          {primaryLicense.label}
        </span>
      )}
      {employee.has_scada_account && (
        <span className="access-chip access-chip--scada" title="Has SCADA account">
          SCADA
        </span>
      )}
    </div>
  );
}

function EmployeeDetails({ employee, onRefresh, companyId }: EmployeeDetailsProps) {
  const [tab, setTab] = useState<Tab>("overview");

  // ── Hardware modals ──
  const [isHardwareModalOpen, setHardwareModalOpen] = useState(false);
  const [hardwareSubmitting, setHardwareSubmitting] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [editingHardware, setEditingHardware] = useState<HardwareAsset | null>(null);

  // ── Subscription modals ──
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] =
    useState<SoftwareSubscription | null>(null);

  // ── Group modal ──
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // ── Automation / actions ──
  const [exportingChecklist, setExportingChecklist] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [syncingLocalAd, setSyncingLocalAd] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // ── Delete ──
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteExportPath, setDeleteExportPath] = useState<string | null>(null);

  // ── Profile / password ──
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Wizards ──
  const [isOffboardingWizardOpen, setOffboardingWizardOpen] = useState(false);
  const [isOnboardingWizardOpen, setOnboardingWizardOpen] = useState(false);

  // ── Per-user live sync ──
  const [autoSyncing, setAutoSyncing] = useState(false);

  const employeeId = employee?.id ?? null;
  useEffect(() => {
    if (employeeId == null) return;
    let cancelled = false;
    (async () => {
      setAutoSyncing(true);
      try {
        const resp = await syncEmployee(employeeId, false);
        if (!cancelled && !resp.cached) {
          await onRefresh();
        }
      } catch {
        // Silent failure — stale data is better than a blocking error.
      } finally {
        if (!cancelled) setAutoSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, onRefresh]);

  if (!employee) {
    return (
      <div className="empty-state">
        Select an employee to view their assigned hardware and software.
      </div>
    );
  }

  // ─────────── Handlers ───────────
  const handlePasswordReset = async (values: ResetPasswordPayload) => {
    setPasswordSubmitting(true);
    setPasswordError(null);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const response = await resetEmployeePassword(employee.id, values);
      await onRefresh();
      setPasswordModalOpen(false);
      const parts: string[] = [
        "Password reset complete.",
        response.generated
          ? `Generated password: ${response.password}`
          : `Password set to: ${response.password}`,
        "Copy this password now—it will not be shown again.",
      ];
      if (response.local_ad?.force_reset_requested) {
        parts.push("Local AD will require a password change at next sign-in.");
      }
      if (response.m365?.updated) parts.push("Microsoft 365 updated.");
      else if (response.m365?.skipped) {
        parts.push(`Microsoft 365 skipped: ${response.m365.reason ?? "missing credentials"}.`);
      }
      setSyncMessage(parts.join(" "));
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleProfileSubmit = async (values: UpdateEmployeeProfilePayload) => {
    setProfileSubmitting(true);
    setProfileError(null);
    setSyncError(null);
    try {
      const result = await updateEmployeeProfile(employee.id, values);
      await onRefresh();
      setProfileModalOpen(false);
      const messages: string[] = ["Profile saved."];
      if (result.local_ad?.updated_attributes?.length) messages.push("Active Directory updated.");
      if (result.m365?.updated) messages.push("Microsoft 365 updated.");
      else if (result.m365?.skipped && result.m365?.reason)
        messages.push(`Microsoft 365 update skipped: ${result.m365.reason}`);
      setSyncMessage(messages.join(" "));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleHardwareSubmit = async (values: HardwareFormSubmission) => {
    setHardwareSubmitting(true);
    setHardwareError(null);
    try {
      if (editingHardware) {
        await updateHardwareAsset(editingHardware.id, values);
      } else {
        await createHardwareAsset({ ...values, employee_id: employee.id });
      }
      await onRefresh();
      setHardwareModalOpen(false);
      setEditingHardware(null);
    } catch (err) {
      setHardwareError(err instanceof Error ? err.message : "Failed to save hardware asset.");
    } finally {
      setHardwareSubmitting(false);
    }
  };

  const handleHardwareDelete = async (asset: HardwareAsset) => {
    if (!confirm(`Delete ${asset.asset_type} ${asset.manufacturer ?? ""}? This cannot be undone.`)) return;
    try {
      await deleteHardwareAsset(asset.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete hardware asset.");
    }
  };

  const handleSubscriptionSubmit = async (values: SubscriptionFormSubmission) => {
    setSubscriptionSubmitting(true);
    setSubscriptionError(null);
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, values);
      } else {
        await createSubscription({ ...values, employee_id: employee.id });
      }
      await onRefresh();
      setSubscriptionModalOpen(false);
      setEditingSubscription(null);
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : "Failed to save subscription.");
    } finally {
      setSubscriptionSubmitting(false);
    }
  };

  const handleSubscriptionDelete = async (sub: SoftwareSubscription) => {
    if (!confirm(`Delete subscription "${sub.name}"? This cannot be undone.`)) return;
    try {
      await deleteSubscription(sub.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete subscription.");
    }
  };

  const handleGroupSubmit = async (values: DirectoryGroupFormSubmission) => {
    setGroupSubmitting(true);
    setGroupError(null);
    try {
      await createDirectoryGroup({ ...values, employee_id: employee.id });
      await onRefresh();
      setGroupModalOpen(false);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Failed to save directory group.");
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleExportChecklist = async () => {
    setExportingChecklist(true);
    setChecklistError(null);
    try {
      const checklistText = await exportOffboardingChecklist(employee.id);
      const blob = new Blob([checklistText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        employee.full_name.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "") ||
        `employee_${employee.id}`;
      link.href = url;
      link.download = `${safeName}_offboarding_checklist.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setChecklistError(
        err instanceof Error ? err.message : "Failed to generate offboarding checklist."
      );
    } finally {
      setExportingChecklist(false);
    }
  };

  const handleSyncLocalAd = async () => {
    setSyncingLocalAd(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const response = await triggerLocalAdSync();
      const parts = [
        `${response.stats.groups} groups`,
        `${response.stats.employees} employees`,
      ];
      if (response.stats.created) parts.push(`${response.stats.created} created`);
      if (response.stats.updated) parts.push(`${response.stats.updated} updated`);
      if (response.stats.skipped) parts.push(`${response.stats.skipped} skipped`);
      if (response.stats.cleared) parts.push(`${response.stats.cleared} cleared`);
      setSyncMessage(`Local AD sync completed: ${parts.join(", ")}.`);
      await onRefresh();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Failed to sync local Active Directory groups."
      );
    } finally {
      setSyncingLocalAd(false);
    }
  };

  const handleDisableAccount = async () => {
    if (disableLoading) return;
    if (!confirm(`Disable ${employee.full_name}'s access in Local AD and Microsoft 365?`)) return;
    setDisableLoading(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const resp = await disableEmployeeAccount(employee.id, true);
      const parts: string[] = [];
      for (const r of resp.ad_results ?? []) {
        if (r.error) {
          parts.push(`${r.label} AD error`);
        } else if (r.found) {
          parts.push(`${r.label} AD disabled`);
        } else {
          parts.push(`${r.label} AD not found`);
        }
      }
      parts.push(
        resp.m365_updated ? "Microsoft 365 disabled" : "Microsoft 365 skipped"
      );
      const warnSuffix =
        resp.warnings && resp.warnings.length > 0
          ? ` — ${resp.warnings.join(" ")}`
          : "";
      setSyncMessage(
        `${employee.full_name}: ${parts.join(", ")}.${warnSuffix}`
      );
      await onRefresh();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to disable directory access.");
    } finally {
      setDisableLoading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    const expected = employee.full_name;
    if (deleteConfirm.trim() !== expected) {
      setDeleteError(`Please enter '${expected}' to confirm deletion.`);
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError(null);
    setDeleteWarning(null);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const response = await deleteEmployeeAccount(
        employee.id,
        expected,
        Boolean(deleteWarning)
      );
      if (response.status === "pending") {
        setDeleteWarning(
          response.message ?? "Checklist exported. Confirm deletion again to proceed."
        );
        setDeleteExportPath(response.export_path ?? null);
        return;
      }
      const exportNote = response.export_path ? ` Export generated at ${response.export_path}.` : "";
      setSyncMessage(`Deleted ${expected}.${exportNote}`);
      setDeleteModalOpen(false);
      setDeleteConfirm("");
      setDeleteExportPath(null);
      await onRefresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete employee.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openAddHardware = () => {
    setEditingHardware(null);
    setHardwareError(null);
    setHardwareModalOpen(true);
  };
  const openEditHardware = (asset: HardwareAsset) => {
    setEditingHardware(asset);
    setHardwareError(null);
    setHardwareModalOpen(true);
  };
  const openAddSubscription = () => {
    setEditingSubscription(null);
    setSubscriptionError(null);
    setSubscriptionModalOpen(true);
  };
  const openEditSubscription = (sub: SoftwareSubscription) => {
    setEditingSubscription(sub);
    setSubscriptionError(null);
    setSubscriptionModalOpen(true);
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "hardware", label: "Hardware", count: employee.hardware_assets.length },
    { key: "software", label: "Software", count: employee.software_subscriptions.length },
    { key: "devices", label: "Devices", count: employee.m365_devices.length },
    {
      key: "access",
      label: "Access",
      count:
        employee.directory_groups.length +
        employee.license_assignments.length +
        (employee.unifi_access?.access_policies.length ?? 0),
    },
  ];

  return (
    <div className="layout-tabbed">
      <section className="layout-tabbed__hero">
        <EmployeeAvatar employeeId={employee.id} name={employee.full_name} size={72} />
        <div className="layout-tabbed__hero-info">
          <div className="layout-tabbed__hero-title">
            <h2>{employee.full_name}</h2>
            {renderAccessChips(employee)}
            {autoSyncing && (
              <span className="sync-indicator" title="Refreshing from Microsoft 365 and SCADA">
                <span className="sync-indicator__dot" />
                Refreshing…
              </span>
            )}
          </div>
          <p>
            {employee.title ?? "No title"}
            {employee.department ? ` · ${employee.department}` : ""}
          </p>
          <div className="layout-tabbed__hero-contact">
            <a href={`mailto:${employee.email}`}>{employee.email}</a>
            {(() => {
              const primary =
                employee.mobile_phone ?? employee.phone ?? employee.unifi_access?.phone;
              return primary ? <span> · {primary}</span> : null;
            })()}
            {employee.extension && <span> · x{employee.extension}</span>}
          </div>
        </div>
        <div className="layout-tabbed__hero-actions">
          <span className={`status-badge status-${employee.status}`}>
            {formatStatusLabel(employee.status)}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setProfileError(null);
              setProfileModalOpen(true);
            }}
          >
            Edit Profile
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPasswordError(null);
              setPasswordModalOpen(true);
            }}
            disabled={passwordSubmitting}
          >
            Reset Password
          </button>
          <details className="btn-menu">
            <summary className="btn btn-secondary">More ▾</summary>
            <div className="btn-menu__items">
              <button type="button" onClick={() => setOnboardingWizardOpen(true)}>
                Start Onboarding
              </button>
              <button type="button" onClick={() => setOffboardingWizardOpen(true)}>
                Start Offboarding
              </button>
              <button type="button" onClick={handleSyncLocalAd} disabled={syncingLocalAd}>
                {syncingLocalAd ? "Syncing…" : "Sync Directory Groups"}
              </button>
              <button type="button" onClick={handleExportChecklist} disabled={exportingChecklist}>
                {exportingChecklist ? "Exporting…" : "Export Offboarding Checklist"}
              </button>
              <hr />
              <button
                type="button"
                className="danger"
                onClick={handleDisableAccount}
                disabled={disableLoading}
              >
                {disableLoading ? "Disabling…" : "Disable Account"}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteWarning(null);
                  setDeleteConfirm("");
                  setDeleteExportPath(null);
                  setDeleteModalOpen(true);
                }}
              >
                Delete Employee
              </button>
            </div>
          </details>
        </div>
      </section>

      {checklistError && <InlineMessage tone="error" text={checklistError} onDismiss={() => setChecklistError(null)} />}
      {syncError && <InlineMessage tone="error" text={syncError} onDismiss={() => setSyncError(null)} />}
      {syncMessage && <InlineMessage tone="success" text={syncMessage} onDismiss={() => setSyncMessage(null)} />}

      <nav className="layout-tabbed__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`layout-tabbed__tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count != null && <span className="layout-tabbed__tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      <section className="layout-tabbed__content">
        {tab === "overview" && <OverviewTab employee={employee} />}
        {tab === "hardware" && (
          <HardwareTab
            employee={employee}
            onAdd={openAddHardware}
            onEdit={openEditHardware}
            onDelete={handleHardwareDelete}
          />
        )}
        {tab === "software" && (
          <SoftwareTab
            employee={employee}
            onAdd={openAddSubscription}
            onEdit={openEditSubscription}
            onDelete={handleSubscriptionDelete}
          />
        )}
        {tab === "devices" && <DevicesTab employee={employee} />}
        {tab === "access" && (
          <AccessTab
            employee={employee}
            onAddGroup={() => {
              setGroupError(null);
              setGroupModalOpen(true);
            }}
            onSyncGroups={handleSyncLocalAd}
            syncing={syncingLocalAd}
          />
        )}
      </section>

      {/* ──────── Modals ──────── */}

      <Modal
        isOpen={isProfileModalOpen}
        title={`Edit ${employee.full_name}`}
        onClose={() => !profileSubmitting && setProfileModalOpen(false)}
      >
        <EmployeeProfileForm
          employee={employee}
          submitting={profileSubmitting}
          errorMessage={profileError}
          onSubmit={handleProfileSubmit}
          onCancel={() => setProfileModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isPasswordModalOpen}
        title={`Reset password for ${employee.full_name}`}
        onClose={() => !passwordSubmitting && setPasswordModalOpen(false)}
      >
        <PasswordResetForm
          submitting={passwordSubmitting}
          errorMessage={passwordError}
          onSubmit={handlePasswordReset}
          onCancel={() => setPasswordModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isHardwareModalOpen}
        title={editingHardware ? `Edit ${editingHardware.asset_type}` : `Add Hardware for ${employee.full_name}`}
        onClose={() => !hardwareSubmitting && (setHardwareModalOpen(false), setEditingHardware(null))}
      >
        <HardwareForm
          initialAsset={editingHardware}
          submitLabel={editingHardware ? "Save Changes" : "Save Asset"}
          onSubmit={handleHardwareSubmit}
          onCancel={() => {
            setHardwareModalOpen(false);
            setEditingHardware(null);
          }}
          submitting={hardwareSubmitting}
          errorMessage={hardwareError}
        />
      </Modal>

      <Modal
        isOpen={isSubscriptionModalOpen}
        title={editingSubscription ? `Edit ${editingSubscription.name}` : `Add Subscription for ${employee.full_name}`}
        onClose={() => !subscriptionSubmitting && (setSubscriptionModalOpen(false), setEditingSubscription(null))}
      >
        <SubscriptionForm
          initialSubscription={editingSubscription}
          submitLabel={editingSubscription ? "Save Changes" : "Save Subscription"}
          onSubmit={handleSubscriptionSubmit}
          onCancel={() => {
            setSubscriptionModalOpen(false);
            setEditingSubscription(null);
          }}
          submitting={subscriptionSubmitting}
          errorMessage={subscriptionError}
        />
      </Modal>

      <Modal
        isOpen={isGroupModalOpen}
        title={`Add Directory Group for ${employee.full_name}`}
        onClose={() => !groupSubmitting && setGroupModalOpen(false)}
      >
        <DirectoryGroupForm
          onSubmit={handleGroupSubmit}
          onCancel={() => setGroupModalOpen(false)}
          submitting={groupSubmitting}
          errorMessage={groupError}
        />
      </Modal>

      <OnboardingWizard
        employee={employee}
        isOpen={isOnboardingWizardOpen}
        onClose={() => setOnboardingWizardOpen(false)}
        onRefresh={onRefresh}
        companyId={companyId}
      />

      <OffboardingWizard
        employee={employee}
        isOpen={isOffboardingWizardOpen}
        onClose={() => setOffboardingWizardOpen(false)}
        onRefresh={onRefresh}
      />

      <Modal
        isOpen={deleteModalOpen}
        title={`Delete ${employee.full_name}`}
        onClose={() => !deleteSubmitting && setDeleteModalOpen(false)}
      >
        <div className="delete-panel">
          <p>
            This will remove {employee.full_name} from Local AD, Microsoft 365, and the asset
            database. Type "{employee.full_name}" to confirm.
          </p>
          {deleteError ? (
            <InlineMessage tone="error" text={deleteError} onDismiss={() => setDeleteError(null)} />
          ) : null}
          {deleteWarning ? (
            <div className="inline-warning">
              <span>
                {deleteWarning}
                {deleteExportPath && (
                  <>
                    {" "}Export path: <code>{deleteExportPath}</code>
                  </>
                )}
              </span>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => {
                  setDeleteWarning(null);
                  setDeleteExportPath(null);
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <label>
            Confirmation
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={employee.full_name}
              required
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteEmployee}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab content components
// ─────────────────────────────────────────────

function OverviewTab({ employee }: { employee: EmployeeRecord }) {
  return (
    <div className="overview-panel">
      <div className="overview-panel__stats">
        <Stat label="Hardware" value={employee.hardware_assets.length} accent />
        <Stat label="Software" value={employee.software_subscriptions.length} />
        <Stat label="Devices" value={employee.m365_devices.length} />
        <Stat label="Licenses" value={employee.license_assignments.length} />
        <Stat label="Groups" value={employee.directory_groups.length} />
        <Stat label="Policies" value={employee.unifi_access?.access_policies.length ?? 0} />
      </div>
      <div className="overview-panel__grid">
        <div>
          <h3>Profile</h3>
          <dl className="dash-kv">
            <KV label="Department" value={employee.department} />
            <KV label="Manager" value={employee.manager_email} />
            <KV label="Employee #" value={employee.employee_number} />
            <KV label="Start Date" value={formatDate(employee.start_date)} />
            <KV label="Termination" value={formatDate(employee.termination_date)} />
            <KV label="Office phone" value={employee.phone ?? employee.unifi_access?.phone} />
            <KV label="Cell phone" value={employee.mobile_phone} />
            <KV label="Extension" value={employee.extension} />
            <KV
              label="Alt. emails"
              value={
                employee.alternate_emails.length > 0
                  ? employee.alternate_emails.join(", ")
                  : null
              }
            />
          </dl>
          {employee.linked_accounts.length > 0 ? (
            <div className="overview-panel__linked">
              <h4>Linked accounts</h4>
              <ul className="overview-panel__linked-list">
                {employee.linked_accounts.map((la) => (
                  <li key={la.id}>
                    <span className="overview-panel__linked-email">{la.email}</span>
                    <span className="overview-panel__linked-meta">
                      {la.account_type}
                      {la.status ? ` · ${la.status}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div>
          <h3>Notes</h3>
          <p className="overview-panel__notes">{employee.notes || "No notes on file."}</p>
        </div>
      </div>
    </div>
  );
}

function HardwareTab({
  employee,
  onAdd,
  onEdit,
  onDelete,
}: {
  employee: EmployeeRecord;
  onAdd: () => void;
  onEdit: (a: HardwareAsset) => void;
  onDelete: (a: HardwareAsset) => void;
}) {
  return (
    <div>
      <div className="tab-toolbar">
        <button type="button" className="btn" onClick={onAdd}>
          Add Hardware
        </button>
      </div>
      {employee.hardware_assets.length === 0 ? (
        <p className="dash-empty">No hardware assigned.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Manufacturer / Model</th>
              <th>Serial</th>
              <th>Assigned</th>
              <th>Status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {employee.hardware_assets.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.asset_type}</strong></td>
                <td>{[a.manufacturer, a.model].filter(Boolean).join(" · ") || "—"}</td>
                <td className="monospace">{a.serial_number ?? "—"}</td>
                <td>{formatDate(a.assigned_date)}</td>
                <td>
                  <span className={`status-badge status-${a.status}`}>
                    {formatStatusLabel(a.status)}
                  </span>
                </td>
                <td className="mini-table__actions">
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onEdit(a)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onDelete(a)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SoftwareTab({
  employee,
  onAdd,
  onEdit,
  onDelete,
}: {
  employee: EmployeeRecord;
  onAdd: () => void;
  onEdit: (s: SoftwareSubscription) => void;
  onDelete: (s: SoftwareSubscription) => void;
}) {
  return (
    <div>
      <div className="tab-toolbar">
        <button type="button" className="btn" onClick={onAdd}>
          Add Subscription
        </button>
      </div>
      {employee.software_subscriptions.length === 0 ? (
        <p className="dash-empty">No subscriptions.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Vendor</th>
              <th>Billing</th>
              <th>Cost</th>
              <th>Status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {employee.software_subscriptions.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.vendor ?? "—"}</td>
                <td>{s.billing_cycle ?? "—"}</td>
                <td>{s.cost != null ? formatCurrency(s.cost) : "—"}</td>
                <td>
                  <span className={`status-badge status-${s.status}`}>
                    {formatStatusLabel(s.status)}
                  </span>
                </td>
                <td className="mini-table__actions">
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onEdit(s)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onDelete(s)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DevicesTab({ employee }: { employee: EmployeeRecord }) {
  return (
    <div>
      <p className="tab-note">
        M365 devices are synced from Microsoft Intune / Entra. Manage enrollment in the M365 admin
        center.
      </p>
      {employee.m365_devices.length === 0 ? (
        <p className="dash-empty">No M365 devices.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>OS</th>
              <th>Compliance</th>
              <th>Managed By</th>
              <th>Last Sync</th>
            </tr>
          </thead>
          <tbody>
            {employee.m365_devices.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.display_name ?? "Unknown"}</strong></td>
                <td>{d.operating_system ?? "—"}</td>
                <td>{d.compliance_state ?? "—"}</td>
                <td>{d.managed_by ?? "—"}</td>
                <td>{formatDateTime(d.last_sync_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AccessTab({
  employee,
  onAddGroup,
  onSyncGroups,
  syncing,
}: {
  employee: EmployeeRecord;
  onAddGroup: () => void;
  onSyncGroups: () => void;
  syncing: boolean;
}) {
  const policies = employee.unifi_access?.access_policies ?? [];
  return (
    <div className="access-tab">
      <section>
        <div className="tab-section-header">
          <h3>Directory Groups ({employee.directory_groups.length})</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-tertiary btn-sm" onClick={onSyncGroups} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <button type="button" className="btn btn-sm" onClick={onAddGroup}>
              Add Group
            </button>
          </div>
        </div>
        {employee.directory_groups.length === 0 ? (
          <p className="dash-empty">No group memberships.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Scope</th>
                <th>Type</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {employee.directory_groups.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.group_name}</strong></td>
                  <td>{g.group_scope ?? "—"}</td>
                  <td>{g.group_type ?? "—"}</td>
                  <td>{g.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="tab-section-header">
          <h3>M365 Licenses ({employee.license_assignments.length})</h3>
        </div>
        {employee.license_assignments.length === 0 ? (
          <p className="dash-empty">No licenses assigned.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Part Number</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {employee.license_assignments.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.sku_name ?? l.sku_part_number ?? l.sku_id}</strong></td>
                  <td className="monospace">{l.sku_part_number ?? "—"}</td>
                  <td>{formatDate(l.assigned_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="tab-section-header">
          <h3>Unifi Access Policies ({policies.length})</h3>
        </div>
        {policies.length === 0 ? (
          <p className="dash-empty">No access policies.</p>
        ) : (
          <div className="policy-card-stack">
            {policies.map((p) => (
              <details key={p.policy_id} className="policy-card">
                <summary className="policy-card__summary">
                  <span className="policy-card__name">{p.policy_name}</span>
                  <span className="policy-card__meta">
                    {p.doors.length} door{p.doors.length === 1 ? "" : "s"}
                    {" · "}
                    {p.schedule?.name ?? "24/7"}
                  </span>
                </summary>
                <div className="policy-card__body">
                  <h4>Doors</h4>
                  <DoorList doors={p.doors} />
                  <h4>Schedule</h4>
                  <ScheduleView schedule={p.schedule} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card${accent ? " stat-card--accent" : ""}`}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function InlineMessage({
  tone,
  text,
  onDismiss,
}: {
  tone: "error" | "success";
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div className={tone === "error" ? "inline-error" : "inline-success"}>
      <span>{text}</span>
      <button type="button" className="btn btn-tertiary" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

export default EmployeeDetails;

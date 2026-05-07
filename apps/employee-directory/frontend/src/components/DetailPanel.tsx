import { useMemo, useState } from "react";

import type { EmployeeRecord, HardwareAsset, NavView, SoftwareSubscription } from "../api/types";
import { formatDate, formatCurrency, formatStatusLabel } from "../utils/format";
import {
  aggregateGroups,
  aggregateLicenses,
  aggregatePolicies,
  type GroupAggregate,
  type LicenseAggregate,
  type Member,
  type PolicyAggregate,
} from "../utils/aggregates";
import EmployeeAvatar from "./EmployeeAvatar";
import HardwareForm, { type HardwareFormSubmission } from "./HardwareForm";
import SubscriptionForm, { type SubscriptionFormSubmission } from "./SubscriptionForm";
import Modal from "./Modal";
import { DoorList, ScheduleView } from "./PolicyAccessInfo";
import {
  updateHardwareAsset,
  deleteHardwareAsset,
} from "../api/hardware";
import {
  updateSubscription,
  deleteSubscription,
} from "../api/subscriptions";

interface Props {
  activeView: NavView;
  selectedItemId: string | null;
  employees: EmployeeRecord[];
  onRefresh: () => Promise<void>;
  companyId: number | null;
  onClearSelection?: () => void;
}

export default function DetailPanel({
  activeView,
  selectedItemId,
  employees,
  onRefresh,
  onClearSelection,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { hwMap, subMap, deviceMap, groupAggs, licenseAggs, policyAggs } = useMemo(() => {
    const hw = new Map<string, { asset: HardwareAsset; employee: EmployeeRecord }>();
    const sub = new Map<string, { sub: SoftwareSubscription; employee: EmployeeRecord }>();
    const dev = new Map<string, { device: EmployeeRecord["m365_devices"][0]; employee: EmployeeRecord }>();

    for (const e of employees) {
      for (const a of e.hardware_assets) hw.set(`hw:${a.id}`, { asset: a, employee: e });
      for (const s of e.software_subscriptions) sub.set(`sub:${s.id}`, { sub: s, employee: e });
      for (const d of e.m365_devices) {
        dev.set(`device:${e.id}:${d.id}`, { device: d, employee: e });
      }
    }

    return {
      hwMap: hw,
      subMap: sub,
      deviceMap: dev,
      groupAggs: aggregateGroups(employees),
      licenseAggs: aggregateLicenses(employees),
      policyAggs: aggregatePolicies(employees),
    };
  }, [employees]);

  if (selectedItemId == null) {
    return (
      <div className="detail-panel__empty">
        <p>Select an item from the list to view details.</p>
      </div>
    );
  }

  // ── Hardware ───────────────────────────────────────────
  if (activeView === "hardware") {
    const entry = hwMap.get(selectedItemId);
    if (!entry) return <NotFound />;
    const { asset: a, employee: e } = entry;

    const handleEdit = async (values: HardwareFormSubmission) => {
      setEditSubmitting(true);
      setEditError(null);
      try {
        await updateHardwareAsset(a.id, values);
        await onRefresh();
        setEditOpen(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to update asset.");
      } finally {
        setEditSubmitting(false);
      }
    };

    const handleDelete = async () => {
      if (!confirm(`Delete ${a.asset_type} ${a.manufacturer ?? ""} ${a.model ?? ""}? This cannot be undone.`)) {
        return;
      }
      setDeleteSubmitting(true);
      setDeleteError(null);
      try {
        await deleteHardwareAsset(a.id);
        await onRefresh();
        onClearSelection?.();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Failed to delete asset.");
      } finally {
        setDeleteSubmitting(false);
      }
    };

    return (
      <div className="detail-panel">
        <div className="detail-panel__header">
          <h2>{a.asset_type} {a.manufacturer ? `- ${a.manufacturer}` : ""} {a.model ?? ""}</h2>
          <div className="detail-panel__header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setEditError(null); setEditOpen(true); }}>
              Edit
            </button>
            <button type="button" className="btn btn-danger-outline" onClick={handleDelete} disabled={deleteSubmitting}>
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </button>
            <span className={`status-badge status-${a.status}`}>{formatStatusLabel(a.status)}</span>
          </div>
        </div>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        <OwnerCard employee={e} />
        <dl className="detail-panel__grid">
          <dt>Type</dt><dd>{a.asset_type}</dd>
          <dt>Manufacturer</dt><dd>{a.manufacturer ?? "—"}</dd>
          <dt>Model</dt><dd>{a.model ?? "—"}</dd>
          <dt>Serial Number</dt><dd>{a.serial_number ?? "—"}</dd>
          <dt>Asset Tag</dt><dd>{a.asset_tag ?? "—"}</dd>
          <dt>Purchase Date</dt><dd>{formatDate(a.purchase_date)}</dd>
          <dt>Purchase Price</dt><dd>{formatCurrency(a.purchase_price)}</dd>
          <dt>Assigned Date</dt><dd>{formatDate(a.assigned_date)}</dd>
          <dt>Return Due</dt><dd>{formatDate(a.return_due_date)}</dd>
          {a.notes && <><dt>Notes</dt><dd>{a.notes}</dd></>}
        </dl>

        <Modal isOpen={editOpen} title={`Edit ${a.asset_type}`} onClose={() => !editSubmitting && setEditOpen(false)}>
          <HardwareForm
            initialAsset={a}
            submitLabel="Save Changes"
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            submitting={editSubmitting}
            errorMessage={editError}
          />
        </Modal>
      </div>
    );
  }

  // ── Software Subscription ──────────────────────────────
  if (activeView === "subscriptions") {
    const entry = subMap.get(selectedItemId);
    if (!entry) return <NotFound />;
    const { sub: s, employee: e } = entry;

    const handleEdit = async (values: SubscriptionFormSubmission) => {
      setEditSubmitting(true);
      setEditError(null);
      try {
        await updateSubscription(s.id, values);
        await onRefresh();
        setEditOpen(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to update subscription.");
      } finally {
        setEditSubmitting(false);
      }
    };

    const handleDelete = async () => {
      if (!confirm(`Delete subscription "${s.name}"? This cannot be undone.`)) return;
      setDeleteSubmitting(true);
      setDeleteError(null);
      try {
        await deleteSubscription(s.id);
        await onRefresh();
        onClearSelection?.();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Failed to delete subscription.");
      } finally {
        setDeleteSubmitting(false);
      }
    };

    return (
      <div className="detail-panel">
        <div className="detail-panel__header">
          <h2>{s.name}</h2>
          <div className="detail-panel__header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setEditError(null); setEditOpen(true); }}>
              Edit
            </button>
            <button type="button" className="btn btn-danger-outline" onClick={handleDelete} disabled={deleteSubmitting}>
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </button>
            <span className={`status-badge status-${s.status}`}>{formatStatusLabel(s.status)}</span>
          </div>
        </div>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        <OwnerCard employee={e} />
        <dl className="detail-panel__grid">
          <dt>Vendor</dt><dd>{s.vendor ?? "—"}</dd>
          <dt>License Key</dt><dd>{s.license_identifier ?? "—"}</dd>
          <dt>Billing</dt><dd>{s.billing_cycle ?? "—"}</dd>
          <dt>Cost</dt><dd>{formatCurrency(s.cost)}</dd>
          <dt>Cost Center</dt><dd>{s.cost_center ?? "—"}</dd>
          <dt>Renewal</dt><dd>{formatDate(s.renewal_date)}</dd>
          <dt>Assigned</dt><dd>{formatDate(s.assigned_date)}</dd>
          {s.notes && <><dt>Notes</dt><dd>{s.notes}</dd></>}
        </dl>

        <Modal isOpen={editOpen} title={`Edit ${s.name}`} onClose={() => !editSubmitting && setEditOpen(false)}>
          <SubscriptionForm
            initialSubscription={s}
            submitLabel="Save Changes"
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            submitting={editSubmitting}
            errorMessage={editError}
          />
        </Modal>
      </div>
    );
  }

  // ── M365 Device (read-only, synced from Graph) ─────────
  if (activeView === "devices") {
    const entry = deviceMap.get(selectedItemId);
    if (!entry) return <NotFound />;
    const { device: d, employee: e } = entry;
    return (
      <div className="detail-panel">
        <div className="detail-panel__header">
          <h2>{d.display_name ?? "Unknown Device"}</h2>
          <div className="detail-panel__header-actions">
            {d.compliance_state ? (
              <span className={`status-badge status-${d.compliance_state}`}>
                {formatStatusLabel(d.compliance_state)}
              </span>
            ) : null}
          </div>
        </div>
        <p className="detail-panel__readonly-note">Managed by Microsoft Intune / Entra — edit in the M365 admin center.</p>
        <OwnerCard employee={e} />
        <dl className="detail-panel__grid">
          <dt>Device ID</dt><dd className="monospace">{d.device_id}</dd>
          <dt>Operating System</dt><dd>{d.operating_system ?? "—"}</dd>
          <dt>Compliance</dt><dd>{d.compliance_state ?? "—"}</dd>
          <dt>Managed By</dt><dd>{d.managed_by ?? "—"}</dd>
          <dt>Last Sync</dt><dd>{formatDate(d.last_sync_time)}</dd>
        </dl>
      </div>
    );
  }

  // ── License (aggregated by SKU) ────────────────────────
  if (activeView === "licenses") {
    const agg = licenseAggs.find((l) => l.key === selectedItemId);
    if (!agg) return <NotFound />;
    return <LicenseDetail agg={agg} />;
  }

  // ── Directory Group (aggregated) ───────────────────────
  if (activeView === "directory-groups") {
    const agg = groupAggs.find((g) => g.key === selectedItemId);
    if (!agg) return <NotFound />;
    return <GroupDetail agg={agg} />;
  }

  // ── Access Policy (aggregated) ─────────────────────────
  if (activeView === "access-policies") {
    const agg = policyAggs.find((p) => p.key === selectedItemId);
    if (!agg) return <NotFound />;
    return <PolicyDetail agg={agg} />;
  }

  return null;
}

function NotFound() {
  return (
    <div className="detail-panel__empty">
      <p>Item not found. It may have been removed or the list has changed.</p>
    </div>
  );
}

function OwnerCard({ employee }: { employee: EmployeeRecord }) {
  return (
    <div className="detail-panel__owner">
      <EmployeeAvatar employeeId={employee.id} name={employee.full_name} size={48} />
      <div>
        <strong>{employee.full_name}</strong>
        <span>{employee.email}</span>
        {employee.department && <span>{employee.department}</span>}
      </div>
    </div>
  );
}

function MemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <p className="detail-panel__empty-note">No members assigned.</p>;
  }
  return (
    <div className="member-list">
      {members.map((m) => (
        <div key={m.employee_id} className="member-list__row">
          <EmployeeAvatar employeeId={m.employee_id} name={m.employee_name} size={32} />
          <div className="member-list__info">
            <span className="member-list__name">{m.employee_name}</span>
            <span className="member-list__email">{m.employee_email}</span>
          </div>
          <span className="member-list__dept">{m.employee_department ?? "—"}</span>
          <span className={`status-badge status-${m.employee_status}`}>
            {formatStatusLabel(m.employee_status)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LicenseDetail({ agg }: { agg: LicenseAggregate }) {
  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{agg.sku_name ?? agg.sku_part_number ?? agg.sku_id}</h2>
      </div>
      <dl className="detail-panel__grid">
        <dt>SKU ID</dt><dd className="monospace">{agg.sku_id}</dd>
        <dt>Part Number</dt><dd>{agg.sku_part_number ?? "—"}</dd>
        <dt>SKU Name</dt><dd>{agg.sku_name ?? "—"}</dd>
        <dt>Assigned Seats</dt><dd>{agg.members.length}</dd>
      </dl>
      <h3 className="detail-panel__section-title">Assigned To ({agg.members.length})</h3>
      <MemberList members={agg.members} />
    </div>
  );
}

function GroupDetail({ agg }: { agg: GroupAggregate }) {
  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{agg.group_name}</h2>
        <span className="status-badge">{agg.source}</span>
      </div>
      <dl className="detail-panel__grid">
        <dt>Scope / OU</dt><dd>{agg.group_scope ?? "—"}</dd>
        <dt>Type</dt><dd>{agg.group_type ?? "—"}</dd>
        <dt>Source</dt><dd>{agg.source}</dd>
        <dt>Members</dt><dd>{agg.members.length}</dd>
        {agg.description && (
          <>
            <dt>Description / DN</dt>
            <dd className="monospace" style={{ fontSize: "0.8em", wordBreak: "break-all" }}>
              {agg.description}
            </dd>
          </>
        )}
      </dl>
      <h3 className="detail-panel__section-title">Members ({agg.members.length})</h3>
      <MemberList members={agg.members} />
    </div>
  );
}

function PolicyDetail({ agg }: { agg: PolicyAggregate }) {
  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{agg.policy_name}</h2>
      </div>
      <dl className="detail-panel__grid">
        <dt>Policy ID</dt><dd className="monospace">{agg.policy_id}</dd>
        <dt>Doors</dt><dd>{agg.doors.length}</dd>
        <dt>Schedule</dt><dd>{agg.schedule?.name ?? "24/7 (no schedule)"}</dd>
        <dt>Assigned Members</dt><dd>{agg.members.length}</dd>
      </dl>
      <h3 className="detail-panel__section-title">Doors ({agg.doors.length})</h3>
      <DoorList doors={agg.doors} />
      <h3 className="detail-panel__section-title">Schedule</h3>
      <ScheduleView schedule={agg.schedule} />
      <h3 className="detail-panel__section-title">Members ({agg.members.length})</h3>
      <MemberList members={agg.members} />
    </div>
  );
}

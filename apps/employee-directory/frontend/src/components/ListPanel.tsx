import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { fetchHardwareAssets } from "../api/hardware";
import { fetchSubscriptions } from "../api/subscriptions";
import { formatCurrency, formatDate, formatStatusLabel } from "../utils/format";
import {
  aggregateGroups,
  aggregateLicenses,
  aggregatePolicies,
  type GroupAggregate,
  type LicenseAggregate,
  type PolicyAggregate,
} from "../utils/aggregates";
import type {
  EmployeeRecord,
  HardwareAsset,
  M365Device,
  NavView,
  SoftwareSubscription,
} from "../api/types";

type SortKey = "last_name" | "first_name" | "created_at_desc";

interface Props {
  activeView: NavView;
  employees: EmployeeRecord[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  refreshKey: number;
  selectedEmployeeId?: number | null;
  onSelectEmployee?: (id: number) => void;
  sortKey?: SortKey;
  onSortChange?: (v: SortKey) => void;
  onAddEmployee?: () => void;
  addDisabled?: boolean;
}

interface DeviceRow extends M365Device {
  key: string;
  employee_id: number;
  employee_name: string;
}
interface HardwareRow extends HardwareAsset {
  key: string;
  employee_name: string;
}
interface SubRow extends SoftwareSubscription {
  key: string;
  employee_name: string;
}

const VIEW_LABELS: Record<NavView, string> = {
  users: "Users",
  hardware: "Hardware",
  subscriptions: "Software",
  devices: "M365 Devices",
  licenses: "M365 Licenses",
  "directory-groups": "Directory Groups",
  "distribution-groups": "Distribution Groups",
  "access-policies": "Access Policies",
  jobs: "Jobs",
};

type Column<T> = {
  key: string;
  label: string;
  width: string;
  render: (row: T) => ReactNode;
  match?: (row: T, term: string) => boolean;
};

function muted(value: string | number | null | undefined): ReactNode {
  if (value == null || value === "") return <span className="data-list__muted">—</span>;
  return value;
}

const HARDWARE_COLUMNS: Column<HardwareRow>[] = [
  {
    key: "type",
    label: "Type",
    width: "minmax(140px, 1fr)",
    render: (r) => <span className="data-list__strong">{r.asset_type}</span>,
    match: (r, t) => r.asset_type.toLowerCase().includes(t),
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    width: "minmax(120px, 1fr)",
    render: (r) => muted(r.manufacturer),
    match: (r, t) => (r.manufacturer ?? "").toLowerCase().includes(t),
  },
  {
    key: "model",
    label: "Model",
    width: "minmax(140px, 1.2fr)",
    render: (r) => muted(r.model),
    match: (r, t) => (r.model ?? "").toLowerCase().includes(t),
  },
  {
    key: "serial",
    label: "Serial",
    width: "minmax(140px, 1fr)",
    render: (r) => <span className="data-list__mono">{r.serial_number ?? "—"}</span>,
    match: (r, t) => (r.serial_number ?? "").toLowerCase().includes(t),
  },
  {
    key: "owner",
    label: "Assigned To",
    width: "minmax(160px, 1.2fr)",
    render: (r) => r.employee_name,
    match: (r, t) => r.employee_name.toLowerCase().includes(t),
  },
  {
    key: "status",
    label: "Status",
    width: "minmax(100px, 0.7fr)",
    render: (r) => (
      <span className={`status-badge status-${r.status}`}>{formatStatusLabel(r.status)}</span>
    ),
  },
];

const SOFTWARE_COLUMNS: Column<SubRow>[] = [
  {
    key: "name",
    label: "Name",
    width: "minmax(180px, 1.4fr)",
    render: (r) => <span className="data-list__strong">{r.name}</span>,
    match: (r, t) => r.name.toLowerCase().includes(t),
  },
  {
    key: "vendor",
    label: "Vendor",
    width: "minmax(140px, 1fr)",
    render: (r) => muted(r.vendor),
    match: (r, t) => (r.vendor ?? "").toLowerCase().includes(t),
  },
  {
    key: "cost-center",
    label: "Cost Center",
    width: "minmax(120px, 0.8fr)",
    render: (r) => muted(r.cost_center),
  },
  {
    key: "cost",
    label: "Cost",
    width: "minmax(90px, 0.6fr)",
    render: (r) => (r.cost != null ? formatCurrency(r.cost) : muted(null)),
  },
  {
    key: "owner",
    label: "Assigned To",
    width: "minmax(160px, 1.2fr)",
    render: (r) => r.employee_name,
    match: (r, t) => r.employee_name.toLowerCase().includes(t),
  },
  {
    key: "status",
    label: "Status",
    width: "minmax(100px, 0.7fr)",
    render: (r) => (
      <span className={`status-badge status-${r.status}`}>{formatStatusLabel(r.status)}</span>
    ),
  },
];

const DEVICE_COLUMNS: Column<DeviceRow>[] = [
  {
    key: "name",
    label: "Device",
    width: "minmax(200px, 1.4fr)",
    render: (r) => <span className="data-list__strong">{r.display_name ?? "Unknown device"}</span>,
    match: (r, t) => (r.display_name ?? "").toLowerCase().includes(t),
  },
  {
    key: "os",
    label: "OS",
    width: "minmax(140px, 1fr)",
    render: (r) => muted(r.operating_system),
    match: (r, t) => (r.operating_system ?? "").toLowerCase().includes(t),
  },
  {
    key: "compliance",
    label: "Compliance",
    width: "minmax(120px, 0.8fr)",
    render: (r) => muted(r.compliance_state),
  },
  {
    key: "managed",
    label: "Managed By",
    width: "minmax(120px, 0.9fr)",
    render: (r) => muted(r.managed_by),
  },
  {
    key: "last-sync",
    label: "Last Sync",
    width: "minmax(140px, 0.9fr)",
    render: (r) => (r.last_sync_time ? formatDate(r.last_sync_time) : muted(null)),
  },
  {
    key: "owner",
    label: "Assigned To",
    width: "minmax(160px, 1.1fr)",
    render: (r) => r.employee_name,
    match: (r, t) => r.employee_name.toLowerCase().includes(t),
  },
];

const LICENSE_COLUMNS: Column<LicenseAggregate>[] = [
  {
    key: "sku",
    label: "License",
    width: "minmax(220px, 1.6fr)",
    render: (r) => (
      <span className="data-list__strong">{r.sku_name ?? r.sku_part_number ?? r.sku_id}</span>
    ),
    match: (r, t) =>
      (r.sku_name ?? "").toLowerCase().includes(t) ||
      (r.sku_part_number ?? "").toLowerCase().includes(t),
  },
  {
    key: "part",
    label: "Part Number",
    width: "minmax(160px, 1fr)",
    render: (r) => <span className="data-list__mono">{r.sku_part_number ?? "—"}</span>,
  },
  {
    key: "members",
    label: "Assigned",
    width: "minmax(110px, 0.6fr)",
    render: (r) => `${r.members.length} ${r.members.length === 1 ? "user" : "users"}`,
  },
];

const GROUP_COLUMNS: Column<GroupAggregate>[] = [
  {
    key: "name",
    label: "Group",
    width: "minmax(260px, 1.8fr)",
    render: (r) => <span className="data-list__strong">{r.group_name}</span>,
    match: (r, t) => r.group_name.toLowerCase().includes(t),
  },
  {
    key: "scope",
    label: "Scope",
    width: "minmax(120px, 0.7fr)",
    render: (r) => muted(r.group_scope),
  },
  {
    key: "type",
    label: "Type",
    width: "minmax(120px, 0.7fr)",
    render: (r) => muted(r.group_type),
  },
  {
    key: "source",
    label: "Source",
    width: "minmax(110px, 0.7fr)",
    render: (r) => r.source,
    match: (r, t) => (r.source ?? "").toLowerCase().includes(t),
  },
  {
    key: "members",
    label: "Members",
    width: "minmax(110px, 0.6fr)",
    render: (r) => `${r.members.length} ${r.members.length === 1 ? "member" : "members"}`,
  },
];

const POLICY_COLUMNS: Column<PolicyAggregate>[] = [
  {
    key: "policy",
    label: "Policy",
    width: "minmax(280px, 1.8fr)",
    render: (r) => <span className="data-list__strong">{r.policy_name}</span>,
    match: (r, t) => r.policy_name.toLowerCase().includes(t),
  },
  {
    key: "policy-id",
    label: "Policy ID",
    width: "minmax(220px, 1fr)",
    render: (r) => <span className="data-list__mono">{r.policy_id}</span>,
  },
  {
    key: "members",
    label: "Members",
    width: "minmax(120px, 0.6fr)",
    render: (r) => `${r.members.length} ${r.members.length === 1 ? "member" : "members"}`,
  },
];

function DataTable<T extends { key: string }>({
  rows,
  columns,
  selectedKey,
  onSelect,
  searchTerm,
  emptyMessage,
}: {
  rows: T[];
  columns: Column<T>[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  searchTerm: string;
  emptyMessage: string;
}) {
  const term = searchTerm.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) => columns.some((col) => col.match?.(row, term)))
    : rows;

  const templateColumns = columns.map((c) => c.width).join(" ");

  if (filtered.length === 0) {
    return <div className="data-list__empty">{emptyMessage}</div>;
  }

  return (
    <div className="data-list">
      <div className="data-list__header" style={{ gridTemplateColumns: templateColumns }}>
        {columns.map((col) => (
          <span key={col.key} className="data-list__col">
            {col.label}
          </span>
        ))}
      </div>
      {filtered.map((row) => (
        <button
          key={row.key}
          type="button"
          className={`data-list__row${selectedKey === row.key ? " is-selected" : ""}`}
          style={{ gridTemplateColumns: templateColumns }}
          onClick={() => onSelect(row.key)}
        >
          {columns.map((col) => (
            <span key={col.key} className="data-list__col">
              {col.render(row)}
            </span>
          ))}
        </button>
      ))}
    </div>
  );
}

export default function ListPanel({
  activeView,
  employees,
  selectedItemId,
  onSelectItem,
  searchTerm,
  onSearchTermChange,
  loading,
  refreshing,
  onRefresh,
  refreshKey,
}: Props) {
  const [hwAssets, setHwAssets] = useState<HardwareAsset[]>([]);
  const [subs, setSubs] = useState<SoftwareSubscription[]>([]);

  const empMap = useMemo(() => {
    const m = new Map<number, EmployeeRecord>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const empName = useCallback(
    (id: number | null | undefined) => empMap.get(id ?? -1)?.full_name ?? "Unassigned",
    [empMap]
  );

  useEffect(() => {
    if (activeView === "hardware") fetchHardwareAssets().then(setHwAssets).catch(() => {});
    if (activeView === "subscriptions") fetchSubscriptions().then(setSubs).catch(() => {});
  }, [activeView, refreshKey]);

  const devices = useMemo<DeviceRow[]>(
    () =>
      employees.flatMap((e) =>
        e.m365_devices.map((d, i) => ({
          ...d,
          key: `device:${e.id}:${d.id ?? i}`,
          employee_id: e.id,
          employee_name: e.full_name,
        }))
      ),
    [employees]
  );

  const groupAggs = useMemo(() => aggregateGroups(employees), [employees]);
  const licenseAggs = useMemo(() => aggregateLicenses(employees), [employees]);
  const policyAggs = useMemo(() => aggregatePolicies(employees), [employees]);

  const hwRows = useMemo<HardwareRow[]>(
    () =>
      hwAssets.map((a) => ({
        ...a,
        key: `hw:${a.id}`,
        employee_name: empName(a.employee_id),
      })),
    [hwAssets, empName]
  );

  const subRows = useMemo<SubRow[]>(
    () =>
      subs.map((s) => ({
        ...s,
        key: `sub:${s.id}`,
        employee_name: empName(s.employee_id),
      })),
    [subs, empName]
  );

  const summary = (() => {
    switch (activeView) {
      case "hardware":
        return `${hwRows.length} assets`;
      case "subscriptions":
        return `${subRows.length} subscriptions`;
      case "devices":
        return `${devices.length} devices`;
      case "licenses":
        return `${licenseAggs.length} licenses`;
      case "directory-groups":
        return `${groupAggs.length} groups`;
      case "access-policies":
        return `${policyAggs.length} policies`;
      default:
        return "";
    }
  })();

  return (
    <div className="user-grid-view">
      <div className="user-grid-view__toolbar">
        <div className="user-grid-view__left">
          <input
            type="search"
            placeholder={`Search ${VIEW_LABELS[activeView].toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="user-grid-view__search"
          />
        </div>
        <div className="user-grid-view__right">
          <span className="user-grid-view__summary">{summary}</span>
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </div>

      {activeView === "hardware" && (
        <DataTable
          rows={hwRows}
          columns={HARDWARE_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading hardware..." : "No hardware assets found."}
        />
      )}
      {activeView === "subscriptions" && (
        <DataTable
          rows={subRows}
          columns={SOFTWARE_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading subscriptions..." : "No subscriptions found."}
        />
      )}
      {activeView === "devices" && (
        <DataTable
          rows={devices}
          columns={DEVICE_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading devices..." : "No devices found."}
        />
      )}
      {activeView === "licenses" && (
        <DataTable
          rows={licenseAggs}
          columns={LICENSE_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading licenses..." : "No licenses found."}
        />
      )}
      {activeView === "directory-groups" && (
        <DataTable
          rows={groupAggs}
          columns={GROUP_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading groups..." : "No groups found."}
        />
      )}
      {activeView === "access-policies" && (
        <DataTable
          rows={policyAggs}
          columns={POLICY_COLUMNS}
          selectedKey={selectedItemId}
          onSelect={onSelectItem}
          searchTerm={searchTerm}
          emptyMessage={loading ? "Loading policies..." : "No policies found."}
        />
      )}
    </div>
  );
}

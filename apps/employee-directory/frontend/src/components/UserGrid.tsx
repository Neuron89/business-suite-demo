import { useMemo, useState } from "react";

import {
  downloadPhoneDirectoryPdf,
  downloadUserListXlsx,
} from "../api/employees";
import type { AccountType, EmployeeRecord } from "../api/types";
import { formatStatusLabel } from "../utils/format";
import EmployeeAvatar from "./EmployeeAvatar";

type SortKey = "last_name" | "first_name" | "created_at_desc";
type AccountFilter = "all" | AccountType;

const ACCOUNT_FILTER_OPTIONS: { value: AccountFilter; label: string }[] = [
  { value: "domain", label: "Employees" },
  { value: "admin", label: "Admin" },
  { value: "service", label: "Service" },
  { value: "shared_mailbox", label: "Shared mailboxes" },
  { value: "third_party", label: "Third-party" },
  { value: "all", label: "All account types" },
];

interface Props {
  employees: EmployeeRecord[];
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAddEmployee: () => void;
  onImportEmployee: () => void;
  addDisabled: boolean;
  onSelectEmployee: (id: number) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (v: "all" | "active" | "inactive") => void;
  accountFilter: AccountFilter;
  onAccountFilterChange: (v: AccountFilter) => void;
}

export default function UserGrid({
  employees,
  searchTerm,
  onSearchTermChange,
  sortKey,
  onSortChange,
  loading,
  refreshing,
  onRefresh,
  onAddEmployee,
  onImportEmployee,
  addDisabled,
  onSelectEmployee,
  statusFilter,
  onStatusFilterChange,
  accountFilter,
  onAccountFilterChange,
}: Props) {
  const [exporting, setExporting] = useState<"users" | "directory" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (kind: "users" | "directory") => {
    setExportError(null);
    setExporting(kind);
    try {
      if (kind === "users") {
        await downloadUserListXlsx();
      } else {
        await downloadPhoneDirectoryPdf();
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };


  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return employees.filter((e) => {
      if (accountFilter !== "all" && (e.account_type ?? "domain") !== accountFilter) {
        return false;
      }
      if (statusFilter === "active" && e.status !== "active") return false;
      if (statusFilter === "inactive" && e.status === "active") return false;
      if (!term) return true;
      return (
        e.full_name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        (e.department ?? "").toLowerCase().includes(term)
      );
    });
  }, [employees, searchTerm, statusFilter, accountFilter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    switch (sortKey) {
      case "first_name":
        items.sort((a, b) => a.first_name.localeCompare(b.first_name));
        break;
      case "created_at_desc":
        items.sort((a, b) => {
          const aDate = a.created_at ? Date.parse(a.created_at) : 0;
          const bDate = b.created_at ? Date.parse(b.created_at) : 0;
          return bDate - aDate;
        });
        break;
      default:
        items.sort((a, b) => a.last_name.localeCompare(b.last_name));
    }
    return items;
  }, [filtered, sortKey]);

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    return { total, active };
  }, [employees]);

  return (
    <div className="user-grid-view">
      <div className="user-grid-view__toolbar">
        <div className="user-grid-view__left">
          <input
            type="search"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="user-grid-view__search"
          />
          <select
            value={accountFilter}
            onChange={(e) => onAccountFilterChange(e.target.value as AccountFilter)}
            className="user-grid-view__filter"
          >
            {ACCOUNT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as "all" | "active" | "inactive")}
            className="user-grid-view__filter"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive / Disabled</option>
          </select>
          <label className="user-grid-view__sort">
            Sort:
            <select
              value={sortKey}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
            >
              <option value="last_name">Last name</option>
              <option value="first_name">First name</option>
              <option value="created_at_desc">Newest first</option>
            </select>
          </label>
        </div>
        <div className="user-grid-view__right">
          <span className="user-grid-view__summary">
            <strong>{summary.active}</strong> active / <strong>{summary.total}</strong> total
          </span>
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? "Syncing..." : "Refresh"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport("users")}
            disabled={exporting !== null || loading}
            title="Download all users as .xlsx"
          >
            {exporting === "users" ? "Exporting..." : "Export Users"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport("directory")}
            disabled={exporting !== null || loading}
            title="Download phone directory PDF (active users with phone/extension)"
          >
            {exporting === "directory" ? "Exporting..." : "Export Directory (PDF)"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onImportEmployee}
            disabled={addDisabled || refreshing}
          >
            Import from M365
          </button>
          <button
            className="btn"
            onClick={onAddEmployee}
            disabled={addDisabled || refreshing}
          >
            Add Employee
          </button>
        </div>
      </div>

      {exportError ? (
        <div className="inline-error">{exportError}</div>
      ) : null}

      {loading && employees.length === 0 ? (
        <div className="user-grid-view__empty">Loading employees...</div>
      ) : sorted.length === 0 ? (
        <div className="user-grid-view__empty">No employees match your search.</div>
      ) : (
        <div className="user-list">
          <div className="user-list__header">
            <span className="user-list__col user-list__col--name">Name</span>
            <span className="user-list__col user-list__col--title">Title</span>
            <span className="user-list__col user-list__col--email">Email</span>
            <span className="user-list__col user-list__col--phone">Phone</span>
            <span className="user-list__col user-list__col--ext">Ext</span>
            <span className="user-list__col user-list__col--status">Status</span>
          </div>

          {sorted.map((emp) => (
            <button
              key={emp.id}
              className="user-list__row"
              onClick={() => onSelectEmployee(emp.id)}
              type="button"
            >
              <span className="user-list__col user-list__col--name">
                <EmployeeAvatar employeeId={emp.id} name={emp.full_name} size={32} />
                <span className="user-list__name-text">{emp.full_name}</span>
              </span>
              <span className="user-list__col user-list__col--title">
                {emp.title ?? <span className="user-list__muted">—</span>}
              </span>
              <span className="user-list__col user-list__col--email">
                {emp.email}
              </span>
              <span className="user-list__col user-list__col--phone">
                {emp.mobile_phone ?? emp.phone ?? emp.unifi_access?.phone ?? (
                  <span className="user-list__muted">—</span>
                )}
              </span>
              <span className="user-list__col user-list__col--ext">
                {emp.extension ?? <span className="user-list__muted">—</span>}
              </span>
              <span className="user-list__col user-list__col--status">
                <span className={`status-badge status-${emp.status}`}>
                  {formatStatusLabel(emp.status)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

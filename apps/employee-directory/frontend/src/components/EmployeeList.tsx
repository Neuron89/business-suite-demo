import { useMemo, useState, useEffect } from "react";

import type { EmployeeRecord } from "../api/types";
import { formatStatusLabel } from "../utils/format";

type SortKey = "last_name" | "first_name" | "created_at_desc";

type EmployeeListProps = {
  employees: EmployeeRecord[];
  selectedEmployeeId: number | null;
  onSelect: (employeeId: number) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAddEmployee: () => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  addDisabled?: boolean;
};

type GroupKey = "active" | "disabled" | "guest";

const GROUP_LABELS: Record<GroupKey, string> = {
  active: "Active",
  disabled: "Disabled",
  guest: "Guest / Third-party",
};

const GROUP_ORDER: GroupKey[] = ["active", "disabled", "guest"];

function categorizeEmployee(emp: EmployeeRecord): GroupKey {
  const accountType = emp.account_type || "domain";
  if (accountType === "third_party") {
    return "guest";
  }
  if (emp.status === "inactive" || emp.status === "terminated") {
    return "disabled";
  }
  return "active";
}

function EmployeeList({
  employees,
  selectedEmployeeId,
  onSelect,
  searchTerm,
  onSearchTermChange,
  loading,
  refreshing,
  onRefresh,
  onAddEmployee,
  sortKey,
  onSortChange,
  addDisabled = false,
}: EmployeeListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(["disabled", "guest"])
  );

  const grouped = useMemo(() => {
    const groups: Record<GroupKey, EmployeeRecord[]> = {
      active: [],
      disabled: [],
      guest: [],
    };
    for (const emp of employees) {
      groups[categorizeEmployee(emp)].push(emp);
    }
    return groups;
  }, [employees]);

  // Auto-expand all groups when searching
  const isSearching = searchTerm.trim().length > 0;

  // Auto-expand group containing selected employee
  const selectedGroup = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return null;
    return categorizeEmployee(emp);
  }, [employees, selectedEmployeeId]);

  // Reset collapsed defaults when search clears
  useEffect(() => {
    if (!isSearching) {
      setCollapsedGroups(new Set(["disabled", "guest"]));
    }
  }, [isSearching]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const isGroupExpanded = (group: GroupKey) => {
    if (isSearching) return true;
    if (selectedGroup === group) return true;
    return !collapsedGroups.has(group);
  };

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((employee) => employee.status === "active").length;
    return { total, active };
  }, [employees]);

  return (
    <div className="employee-list">
      <div className="employee-list__header">
        <div className="employee-list__search">
          <input
            type="search"
            placeholder="Search employees"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
          <button
            className="btn"
            onClick={onRefresh}
            disabled={loading || refreshing}
          >
            {refreshing
              ? "Syncing..."
              : loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
        <div className="employee-list__actions">
          <label className="employee-list__sort">
            Sort by
            <select
              value={sortKey}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
            >
              <option value="last_name">Last name (A-Z)</option>
              <option value="first_name">First name (A-Z)</option>
              <option value="created_at_desc">Newest first</option>
            </select>
          </label>
          <button
            className="btn btn-secondary"
            onClick={onAddEmployee}
            disabled={addDisabled || refreshing}
          >
            Add Employee
          </button>
        </div>
      </div>
      <div className="employee-list__summary">
        <span>
          <strong>{summary.total}</strong> total
        </span>
        <span>
          <strong>{summary.active}</strong> active
        </span>
      </div>
      <div className="employee-list__items">
        {employees.length === 0 ? (
          <div className="empty-state">
            {loading ? "Loading employees..." : "No employees found."}
          </div>
        ) : (
          GROUP_ORDER.map((groupKey) => {
            const groupEmployees = grouped[groupKey];
            if (groupEmployees.length === 0) return null;
            const expanded = isGroupExpanded(groupKey);
            return (
              <div key={groupKey} className="employee-group">
                <button
                  type="button"
                  className="employee-group__header"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <span
                    className={`employee-group__chevron${expanded ? " employee-group__chevron--open" : ""}`}
                  />
                  <span>{GROUP_LABELS[groupKey]}</span>
                  <span className="employee-group__count">
                    {groupEmployees.length}
                  </span>
                </button>
                {expanded &&
                  groupEmployees.map((employee) => {
                    const isSelected = employee.id === selectedEmployeeId;
                    return (
                      <button
                        key={employee.id}
                        className={`employee-list__item${isSelected ? " is-selected" : ""}`}
                        onClick={() => onSelect(employee.id)}
                      >
                        <span className="employee-list__name">
                          {employee.full_name}
                        </span>
                        <span className="employee-list__meta">
                          {employee.department ?? "No department"}
                        </span>
                        <span
                          className={`status-badge status-${employee.status}`}
                        >
                          {formatStatusLabel(employee.status)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EmployeeList;

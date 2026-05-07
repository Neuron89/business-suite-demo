import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchEmployees } from "./api/employees";
import { fetchCurrentUser, login as loginApi, logout as logoutApi } from "./api/auth";
import {
  provisionEmployee,
  syncAll,
  type ProvisionEmployeePayload,
} from "./api/automation";
import { fetchCompanies } from "./api/settings";
import type { AccountType, Company, EmployeeRecord, NavView } from "./api/types";
import DetailPanel from "./components/DetailPanel";
import DistributionGroupsView from "./components/DistributionGroupsView";
import EmployeeDetails from "./components/EmployeeDetails";
import EmployeeImportForm from "./components/EmployeeImportForm";
import EmployeeProvisionForm from "./components/EmployeeProvisionForm";
import ListPanel from "./components/ListPanel";
import LoginForm from "./components/LoginForm";
import Modal from "./components/Modal";
import NavSidebar from "./components/NavSidebar";
import ProvisioningJobsView from "./components/ProvisioningJobsView";
import SettingsPanel from "./components/SettingsPanel";
import UserGrid from "./components/UserGrid";

const DEFAULT_COMPANY_NAME = "Acme";

function pickDefaultCompanyId(companies: Company[]): number | null {
  if (companies.length === 0) return null;
  const preferred = companies.find(
    (c) => c.name.toLowerCase() === DEFAULT_COMPANY_NAME.toLowerCase()
  );
  return (preferred ?? companies[0]).id;
}

function App() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavView>("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortKey, setSortKey] =
    useState<"last_name" | "first_name" | "created_at_desc">("first_name");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("active");
  const [accountFilter, setAccountFilter] =
    useState<"all" | AccountType>("domain");
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isProvisionModalOpen, setProvisionModalOpen] = useState(false);
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  }, []);

  const loadEmployees = useCallback(async () => {
    if (authState !== "authenticated") {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployees(selectedCompanyId);
      setEmployees(data);
      setSelectedEmployeeId((current) => {
        if (current && data.some((e) => e.id === current)) {
          return current;
        }
        return null;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load employees";
      if (message.toLowerCase().includes("authentication")) {
        setAuthState("unauthenticated");
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authState, selectedCompanyId]);

  useEffect(() => {
    (async () => {
      try {
        const user = await fetchCurrentUser();
        const companyList = await fetchCompanies();
        setCurrentUser(user.user);
        setCompanies(companyList);
        setSelectedCompanyId(pickDefaultCompanyId(companyList));
        setAuthState("authenticated");
      } catch {
        setAuthState("unauthenticated");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authState === "authenticated") {
      void loadEmployees();
    } else {
      setEmployees([]);
      setSelectedEmployeeId(null);
    }
  }, [authState, loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return employees;
    }
    return employees.filter((employee) => {
      return (
        employee.full_name.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term) ||
        (employee.department ?? "").toLowerCase().includes(term)
      );
    });
  }, [employees, searchTerm]);

  const sortedEmployees = useMemo(() => {
    const items = [...filteredEmployees];
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
      case "last_name":
      default:
        items.sort((a, b) => a.last_name.localeCompare(b.last_name));
        break;
    }
    return items;
  }, [filteredEmployees, sortKey]);

  const selectedEmployee = useMemo(() => {
    if (selectedEmployeeId == null) {
      return null;
    }
    return employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  }, [employees, selectedEmployeeId]);

  const handleLogin = async (credentials: { username: string; password: string }) => {
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const response = await loginApi(credentials.username, credentials.password);
      const companyList = await fetchCompanies();
      setCurrentUser(response.user);
      setCompanies(companyList);
      setSelectedCompanyId(pickDefaultCompanyId(companyList));
      setAuthState("authenticated");
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Failed to sign in. Please try again."
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      setAuthState("unauthenticated");
      setCurrentUser(null);
      setEmployees([]);
      setSelectedEmployeeId(null);
      setSearchTerm("");
      setError(null);
      setProvisionSuccess(null);
      setLoading(false);
      setCompanies([]);
      setSelectedCompanyId(null);
    }
  };

  const openProvisionModal = () => {
    setProvisionError(null);
    setProvisionModalOpen(true);
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const response = await syncAll();
      if (response.status !== "ok") {
        const source = response.source ? ` (${response.source})` : "";
        throw new Error(response.error ?? `Directory sync failed${source}.`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to synchronize directories."
      );
    } finally {
      await loadEmployees();
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
    }
  };

  const closeProvisionModal = () => {
    if (provisionSubmitting) {
      return;
    }
    setProvisionModalOpen(false);
    setProvisionError(null);
  };

  const openImportModal = () => setImportModalOpen(true);
  const closeImportModal = () => setImportModalOpen(false);

  const handleProvisionSubmit = async (values: ProvisionEmployeePayload) => {
    setProvisionSubmitting(true);
    setProvisionError(null);
    try {
      const response = await provisionEmployee(values);
      setProvisionModalOpen(false);
      const initialPasswordSet =
        response.details?.initial_password_set ?? false;
      const m365PasswordGenerated =
        response.details?.m365_password_generated ?? false;
      const passwordNote = initialPasswordSet
        ? ""
        : " Initial password was not set (LDAPS required); account remains disabled until a password is applied in AD.";
      const m365Note = m365PasswordGenerated
        ? " A temporary Microsoft 365 password was generated and the account remains blocked until you set a new one."
        : "";
      setProvisionSuccess(
        `Provisioned ${response.employee.full_name} across Local AD and Microsoft 365.${passwordNote}${m365Note}`
      );
      await loadEmployees();
      setSelectedEmployeeId(response.employee.id);
      setActiveView("users");
    } catch (err) {
      setProvisionError(
        err instanceof Error ? err.message : "Failed to provision employee."
      );
    } finally {
      setProvisionSubmitting(false);
    }
  };

  const handleViewChange = (view: NavView) => {
    setActiveView(view);
    setSelectedItemId(null);
    if (view === "users") {
      setSelectedEmployeeId(null);
    }
  };

  if (authState === "checking") {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p>Checking session...</p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <div className="login-screen">
        <LoginForm
          onSubmit={handleLogin}
          submitting={loginSubmitting}
          errorMessage={loginError}
        />
      </div>
    );
  }

  const isUsersView = activeView === "users";
  const viewLabel =
    activeView === "users"
      ? "Users"
      : activeView === "hardware"
        ? "Hardware"
        : activeView === "subscriptions"
          ? "Software"
          : activeView === "devices"
            ? "M365 Devices"
            : activeView === "licenses"
              ? "M365 Licenses"
              : activeView === "directory-groups"
                ? "Directory Groups"
                : activeView === "distribution-groups"
                  ? "Distribution Groups"
                  : activeView === "jobs"
                    ? "Jobs"
                    : "Access Policies";

  return (
    <div className="app-shell app-shell--wide">
      <NavSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={setSelectedCompanyId}
        currentUser={currentUser}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        onSettings={() => setSettingsOpen(true)}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <main className="content">
        {provisionSuccess ? (
          <div className="inline-success">
            <span>{provisionSuccess}</span>
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={() => setProvisionSuccess(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="error-banner">
            <p>{error}</p>
            <button className="btn" onClick={loadEmployees}>
              Retry
            </button>
          </div>
        ) : activeView === "distribution-groups" ? (
          <DistributionGroupsView
            companyId={selectedCompanyId}
            onSelectEmployee={(id) => {
              setActiveView("users");
              setSelectedEmployeeId(id);
            }}
          />
        ) : activeView === "jobs" ? (
          <ProvisioningJobsView />
        ) : isUsersView ? (
          selectedEmployee ? (
            <div className="user-detail-view">
              <button
                type="button"
                className="btn btn-secondary user-detail-view__back"
                onClick={() => setSelectedEmployeeId(null)}
              >
                &larr; Back to Users
              </button>
              <EmployeeDetails
                employee={selectedEmployee}
                onRefresh={loadEmployees}
                companyId={selectedCompanyId}
              />
            </div>
          ) : (
            <UserGrid
              employees={sortedEmployees}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              sortKey={sortKey}
              onSortChange={setSortKey}
              loading={loading}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onAddEmployee={openProvisionModal}
              onImportEmployee={openImportModal}
              addDisabled={loading || provisionSubmitting || refreshing}
              onSelectEmployee={setSelectedEmployeeId}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              accountFilter={accountFilter}
              onAccountFilterChange={setAccountFilter}
            />
          )
        ) : selectedItemId != null ? (
          <div className="user-detail-view">
            <button
              type="button"
              className="btn btn-secondary user-detail-view__back"
              onClick={() => setSelectedItemId(null)}
            >
              &larr; Back to {viewLabel}
            </button>
            <DetailPanel
              activeView={activeView}
              selectedItemId={selectedItemId}
              employees={employees}
              onRefresh={loadEmployees}
              companyId={selectedCompanyId}
              onClearSelection={() => setSelectedItemId(null)}
            />
          </div>
        ) : (
          <ListPanel
            activeView={activeView}
            employees={employees}
            selectedItemId={selectedItemId}
            selectedEmployeeId={selectedEmployeeId}
            onSelectItem={setSelectedItemId}
            onSelectEmployee={setSelectedEmployeeId}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            sortKey={sortKey}
            onSortChange={setSortKey}
            loading={loading}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onAddEmployee={openProvisionModal}
            addDisabled={loading || provisionSubmitting || refreshing}
            refreshKey={refreshKey}
          />
        )}
      </main>

      <Modal
        isOpen={isProvisionModalOpen}
        title="Provision Employee"
        onClose={closeProvisionModal}
      >
        <EmployeeProvisionForm
          onSubmit={handleProvisionSubmit}
          onCancel={closeProvisionModal}
          submitting={provisionSubmitting}
          errorMessage={provisionError}
        />
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        title="Import Employee from Microsoft 365"
        onClose={closeImportModal}
      >
        <EmployeeImportForm
          onClose={closeImportModal}
          onCreated={loadEmployees}
        />
      </Modal>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        companyId={selectedCompanyId}
      />
    </div>
  );
}

export default App;

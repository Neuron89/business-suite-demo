import { apiFetch } from "./client";
import type {
  AccountType,
  EmployeeRecord,
  OffboardingEvent,
  OffboardingStartOptions,
  OffboardingStatusResponse,
  OffboardingTask,
  OnboardingEvent,
  OnboardingStartOptions,
  OnboardingStatusResponse,
  OnboardingTask,
} from "./types";

export async function exportOffboardingChecklist(
  employeeId: number
): Promise<string> {
  return apiFetch<string>(
    `/automation/offboarding/${employeeId}/checklist`,
    {
      headers: {
        Accept: "text/plain",
      },
    },
    false
  );
}

export interface SyncStats {
  employees: number;
  groups: number;
  created?: number;
  updated?: number;
  skipped?: number;
  cleared?: number;
  emails?: string[];
}

export interface SyncResponse {
  status: string;
  stats: SyncStats;
}

export async function triggerLocalAdSync(): Promise<SyncResponse> {
  return apiFetch<SyncResponse>("/automation/sync/local-ad", {
    method: "POST",
  });
}

export interface ProvisionEmployeePayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string | null;
  department?: string | null;
  title?: string | null;
  employee_number?: string | null;
  sam_account_name?: string | null;
  force_password_reset?: boolean;
  account_type?: AccountType | null;
}

export interface ProvisionEmployeeResponse {
  status: string;
  employee: EmployeeRecord;
  details: {
    ad_user_dn?: string | null;
    m365_user?: {
      id?: string;
      userPrincipalName?: string;
    } | null;
    initial_password_set?: boolean;
    m365_password_generated?: boolean;
  };
}

export async function provisionEmployee(
  payload: ProvisionEmployeePayload
): Promise<ProvisionEmployeeResponse> {
  return apiFetch<ProvisionEmployeeResponse>("/automation/provision/employee", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SyncAllResponse {
  status: string;
  stats?: {
    local_ad?: SyncStats;
    m365?: { employees: number; devices: number; licenses: number; emails?: string[] };
    pruned?: { removed: number };
  };
  error?: string;
  source?: string;
}

export async function syncAll(): Promise<SyncAllResponse> {
  return apiFetch<SyncAllResponse>("/automation/sync/all", {
    method: "POST",
  });
}

// ── Offboarding automation API ──────────────────────────────────────

export interface StartOffboardingResponse {
  event: OffboardingEvent;
  automation: {
    auto_completed: number;
    auto_failed: number;
    errors: Array<{ task_id: number; description: string; error: string }>;
  };
}

export async function startOffboarding(
  employeeId: number,
  options: OffboardingStartOptions
): Promise<StartOffboardingResponse> {
  return apiFetch<StartOffboardingResponse>(
    `/automation/offboarding/${employeeId}/start`,
    {
      method: "POST",
      body: JSON.stringify(options),
    }
  );
}

export interface ExecuteTaskResponse {
  task: OffboardingTask;
  result: { status: string; error?: string };
}

export async function executeOffboardingTask(
  taskId: number
): Promise<ExecuteTaskResponse> {
  return apiFetch<ExecuteTaskResponse>(
    `/automation/offboarding/tasks/${taskId}/execute`,
    { method: "POST" }
  );
}

export async function signOffboarding(
  eventId: number,
  role: "it" | "manager",
  name: string
): Promise<{ event: OffboardingEvent }> {
  return apiFetch<{ event: OffboardingEvent }>(
    `/automation/offboarding/${eventId}/signoff`,
    {
      method: "POST",
      body: JSON.stringify({ role, name }),
    }
  );
}

export async function getOffboardingStatus(
  eventId: number
): Promise<OffboardingStatusResponse> {
  return apiFetch<OffboardingStatusResponse>(
    `/automation/offboarding/${eventId}/status`
  );
}

// ── Onboarding automation API ───────────────────────────────────────

export interface StartOnboardingResponse {
  event: OnboardingEvent;
  automation: {
    auto_completed: number;
    auto_failed: number;
    errors: Array<{ task_id: number; description: string; error: string }>;
  };
}

export async function startOnboarding(
  employeeId: number,
  options: OnboardingStartOptions
): Promise<StartOnboardingResponse> {
  return apiFetch<StartOnboardingResponse>(
    `/automation/onboarding/${employeeId}/start`,
    {
      method: "POST",
      body: JSON.stringify(options),
    }
  );
}

export interface ExecuteOnboardingTaskResponse {
  task: OnboardingTask;
  result: { status: string; error?: string };
}

export async function executeOnboardingTask(
  taskId: number
): Promise<ExecuteOnboardingTaskResponse> {
  return apiFetch<ExecuteOnboardingTaskResponse>(
    `/automation/onboarding/tasks/${taskId}/execute`,
    { method: "POST" }
  );
}

export async function signOnboarding(
  eventId: number,
  role: "it" | "manager",
  name: string
): Promise<{ event: OnboardingEvent }> {
  return apiFetch<{ event: OnboardingEvent }>(
    `/automation/onboarding/${eventId}/signoff`,
    {
      method: "POST",
      body: JSON.stringify({ role, name }),
    }
  );
}

export async function getOnboardingStatus(
  eventId: number
): Promise<OnboardingStatusResponse> {
  return apiFetch<OnboardingStatusResponse>(
    `/automation/onboarding/${eventId}/status`
  );
}

export interface OnboardingEmailsResponse {
  manager_email: string;
  announcement_email: string;
}

export async function getOnboardingEmails(
  employeeId: number,
  companyId?: number | null
): Promise<OnboardingEmailsResponse> {
  const qs = companyId ? `?company_id=${companyId}` : "";
  return apiFetch<OnboardingEmailsResponse>(
    `/automation/onboarding/${employeeId}/emails${qs}`
  );
}


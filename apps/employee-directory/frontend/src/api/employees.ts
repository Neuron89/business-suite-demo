import { apiFetch, downloadApiFile } from "./client";
import type { AccountType, EmployeeRecord, EmployeesResponse } from "./types";

export interface UpdateEmployeeProfilePayload {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  department: string | null;
  title: string | null;
  employee_number: string | null;
  manager_email: string | null;
  start_date: string | null;
  termination_date: string | null;
  phone: string | null;
  mobile_phone: string | null;
  extension: string | null;
  office_location: string | null;
  notes: string | null;
  account_type: AccountType;
}

export interface DirectoryPushTargetResult {
  target: string;
  applied: Record<string, unknown>;
  skipped: Record<string, string>;
  error: string | null;
}

export interface UpdateEmployeeProfileResponse {
  employee: EmployeeRecord;
  local_ad?: {
    user_dn: string | null;
    updated_attributes: string[];
  };
  m365?: {
    updated: boolean;
    skipped?: boolean;
    reason?: string;
    payload?: Record<string, unknown>;
  };
  directory_push?: Record<string, DirectoryPushTargetResult> | { error: string };
}

export interface DirectoryPushResponse {
  employee: EmployeeRecord;
  result: Record<string, DirectoryPushTargetResult>;
}

export async function pushEmployeeDirectory(
  employeeId: number
): Promise<DirectoryPushResponse> {
  return apiFetch<DirectoryPushResponse>(
    `/employees/${employeeId}/directory-push`,
    { method: "POST" }
  );
}

export interface EmployeeLookupPrefill {
  email: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  department: string | null;
  title: string | null;
  employee_number: string | null;
  start_date: string | null;
  manager_email: string | null;
  mobile_phone: string | null;
  phone: string | null;
  office_location: string | null;
  account_type: AccountType;
}

export interface EmployeeLookupResponse {
  exists: boolean;
  found_in_graph?: boolean;
  prefilled?: EmployeeLookupPrefill;
  employee?: EmployeeRecord;
  email?: string;
  error?: string;
  raw?: {
    id: string;
    userType: string | null;
    accountEnabled: boolean | null;
  };
}

export async function lookupEmployeeFromGraph(
  email: string
): Promise<EmployeeLookupResponse> {
  return apiFetch<EmployeeLookupResponse>("/employees/lookup", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export interface CreateEmployeePayload {
  email: string;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  department?: string | null;
  title?: string | null;
  employee_number?: string | null;
  start_date?: string | null;
  manager_email?: string | null;
  mobile_phone?: string | null;
  phone?: string | null;
  office_location?: string | null;
  account_type?: AccountType | null;
}

export async function createEmployee(
  payload: CreateEmployeePayload
): Promise<{ employee: EmployeeRecord }> {
  return apiFetch<{ employee: EmployeeRecord }>("/employees/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEmployees(companyId?: number | null): Promise<EmployeeRecord[]> {
  const params = companyId != null ? `?company_id=${companyId}` : "";
  const data = await apiFetch<EmployeesResponse>(`/employees/${params}`);
  return data.employees;
}

export interface AdResult {
  label: string;
  found: boolean;
  error: string | null;
}

export interface DisableEmployeeResponse {
  status: string;
  disabled: boolean;
  ad_results?: AdResult[];
  m365_updated?: boolean;
  warnings?: string[];
}

export async function disableEmployeeAccount(
  employeeId: number,
  disable: boolean = true
): Promise<DisableEmployeeResponse> {
  return apiFetch<DisableEmployeeResponse>(`/automation/users/${employeeId}/disable`, {
    method: "POST",
    body: JSON.stringify({ disable }),
  });
}

export interface DeleteEmployeeResponse {
  status: string;
  export_path?: string;
  message?: string;
  ad_results?: AdResult[];
  m365_deleted?: boolean;
  warnings?: string[];
}

export async function deleteEmployeeAccount(
  employeeId: number,
  confirm: string,
  force: boolean = false
): Promise<DeleteEmployeeResponse> {
  return apiFetch<DeleteEmployeeResponse>(`/automation/users/${employeeId}/delete`, {
    method: "POST",
    body: JSON.stringify({ confirm, force }),
  });
}

export interface ResetPasswordPayload {
  password?: string | null;
  generate?: boolean;
  force_password_reset?: boolean;
  enable_local_ad?: boolean;
  enable_m365?: boolean;
}

export interface ResetPasswordResponse {
  status: string;
  password: string;
  generated: boolean;
  local_ad?: {
    updated?: boolean;
    force_reset_requested?: boolean;
    force_reset_applied?: boolean | null;
    enabled?: boolean;
  };
  m365?: {
    updated?: boolean;
    skipped?: boolean;
    reason?: string;
    force_reset_requested?: boolean;
    enabled?: boolean;
  };
}

export async function resetEmployeePassword(
  employeeId: number,
  payload: ResetPasswordPayload
): Promise<ResetPasswordResponse> {
  return apiFetch<ResetPasswordResponse>(
    `/automation/users/${employeeId}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export interface SyncEmployeeResponse {
  employee: EmployeeRecord;
  cached: boolean;
  results: Record<string, unknown> | null;
  warnings?: string[];
}

export async function syncEmployee(
  employeeId: number,
  force: boolean = false
): Promise<SyncEmployeeResponse> {
  const qs = force ? "?force=1" : "";
  return apiFetch<SyncEmployeeResponse>(
    `/employees/${employeeId}/sync${qs}`,
    { method: "POST" }
  );
}

export async function downloadUserListXlsx(): Promise<void> {
  const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").slice(0, 13);
  await downloadApiFile("/employees/export/users", `users_${ts}.xlsx`);
}

export async function downloadPhoneDirectoryXlsx(): Promise<void> {
  const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").slice(0, 13);
  await downloadApiFile(
    "/employees/export/directory",
    `phone_directory_${ts}.xlsx`
  );
}

export async function downloadPhoneDirectoryPdf(): Promise<void> {
  const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").slice(0, 13);
  await downloadApiFile(
    "/employees/export/directory.pdf",
    `phone_directory_${ts}.pdf`
  );
}

export async function updateEmployeeProfile(
  employeeId: number,
  payload: UpdateEmployeeProfilePayload
): Promise<UpdateEmployeeProfileResponse> {
  return apiFetch<UpdateEmployeeProfileResponse>(`/employees/${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


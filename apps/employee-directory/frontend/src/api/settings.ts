import { apiFetch } from "./client";
import type { Company } from "./types";

export interface SettingItem {
  setting_key: string;
  setting_value: string;
  setting_label: string;
  setting_category: string;
}

export interface SettingsResponse {
  settings: Record<string, SettingItem[]>;
}

export async function fetchCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>("/settings/companies");
}

export async function fetchSettings(companyId: number): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>(`/settings/?company_id=${companyId}`);
}

export async function updateSettings(
  companyId: number,
  settings: Array<{ setting_key: string; setting_value: string }>
): Promise<{ status: string; updated: number }> {
  return apiFetch(`/settings/?company_id=${companyId}`, {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
}

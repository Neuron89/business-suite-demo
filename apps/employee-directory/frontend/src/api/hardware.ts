import { apiFetch } from "./client";
import type { HardwareAsset } from "./types";

export interface CreateHardwarePayload {
  asset_type: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
  status?: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  assigned_date?: string | null;
  return_due_date?: string | null;
  employee_id?: number | null;
  notes?: string | null;
}

interface CreateHardwareResponse {
  hardware_asset: HardwareAsset;
}

export async function fetchHardwareAssets(): Promise<HardwareAsset[]> {
  const data = await apiFetch<{ hardware_assets: HardwareAsset[] }>("/hardware/");
  return data.hardware_assets;
}

export async function createHardwareAsset(
  payload: CreateHardwarePayload
): Promise<HardwareAsset> {
  const response = await apiFetch<CreateHardwareResponse>("/hardware/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.hardware_asset;
}

export async function updateHardwareAsset(
  id: number,
  payload: Partial<CreateHardwarePayload>
): Promise<HardwareAsset> {
  const response = await apiFetch<CreateHardwareResponse>(`/hardware/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.hardware_asset;
}

export async function deleteHardwareAsset(id: number): Promise<void> {
  await apiFetch<{ status: string }>(`/hardware/${id}`, { method: "DELETE" });
}


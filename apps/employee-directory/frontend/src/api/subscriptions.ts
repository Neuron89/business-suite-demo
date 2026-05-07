import { apiFetch } from "./client";
import type { SoftwareSubscription } from "./types";

export interface CreateSubscriptionPayload {
  name: string;
  vendor?: string | null;
  license_identifier?: string | null;
  cost_center?: string | null;
  billing_cycle?: string | null;
  cost?: number | null;
  renewal_date?: string | null;
  assigned_date?: string | null;
  notes?: string | null;
  employee_id?: number | null;
}

interface CreateSubscriptionResponse {
  software_subscription: SoftwareSubscription;
}

export async function fetchSubscriptions(): Promise<SoftwareSubscription[]> {
  const data = await apiFetch<{ software_subscriptions: SoftwareSubscription[] }>("/subscriptions/");
  return data.software_subscriptions;
}

export async function createSubscription(
  payload: CreateSubscriptionPayload
): Promise<SoftwareSubscription> {
  const response = await apiFetch<CreateSubscriptionResponse>(
    "/subscriptions/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return response.software_subscription;
}

export async function updateSubscription(
  id: number,
  payload: Partial<CreateSubscriptionPayload>
): Promise<SoftwareSubscription> {
  const response = await apiFetch<CreateSubscriptionResponse>(
    `/subscriptions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
  return response.software_subscription;
}

export async function deleteSubscription(id: number): Promise<void> {
  await apiFetch<{ status: string }>(`/subscriptions/${id}`, {
    method: "DELETE",
  });
}


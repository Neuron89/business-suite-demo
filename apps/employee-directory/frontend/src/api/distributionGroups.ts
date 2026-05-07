import { apiFetch } from "./client";
import type {
  DistributionGroupDetail,
  DistributionGroupResponse,
  DistributionGroupSummary,
  DistributionGroupsResponse,
} from "./types";

export async function fetchDistributionGroups(
  companyId?: number | null
): Promise<DistributionGroupSummary[]> {
  const params = companyId != null ? `?company_id=${companyId}` : "";
  const data = await apiFetch<DistributionGroupsResponse>(
    `/distribution-groups/${params}`
  );
  return data.distribution_groups;
}

export async function fetchDistributionGroup(
  id: number
): Promise<DistributionGroupDetail> {
  const data = await apiFetch<DistributionGroupResponse>(
    `/distribution-groups/${id}`
  );
  return data.distribution_group;
}

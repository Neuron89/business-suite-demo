import { apiFetch } from "./client";
import type { DirectoryGroup } from "./types";

export interface CreateDirectoryGroupPayload {
  group_name: string;
  group_scope?: string | null;
  group_type?: string | null;
  description?: string | null;
  source?: string;
  employee_id: number;
}

interface CreateDirectoryGroupResponse {
  directory_group: DirectoryGroup;
}

export async function fetchDirectoryGroups(): Promise<DirectoryGroup[]> {
  const data = await apiFetch<{ directory_groups: DirectoryGroup[] }>("/directory-groups/");
  return data.directory_groups;
}

export async function createDirectoryGroup(
  payload: CreateDirectoryGroupPayload
): Promise<DirectoryGroup> {
  const response = await apiFetch<CreateDirectoryGroupResponse>(
    "/directory-groups/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return response.directory_group;
}


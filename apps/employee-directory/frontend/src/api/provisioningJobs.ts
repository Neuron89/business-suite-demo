import { apiFetch } from "./client";
import type { ProvisioningJob, ProvisioningJobStatus } from "./types";

export interface ProvisioningJobsResponse {
  jobs: ProvisioningJob[];
}

export interface ProvisioningJobResponse {
  job: ProvisioningJob;
}

export interface ListProvisioningJobsOptions {
  employee_id?: number;
  status?: ProvisioningJobStatus;
  limit?: number;
}

export async function fetchProvisioningJobs(
  options: ListProvisioningJobsOptions = {}
): Promise<ProvisioningJob[]> {
  const params = new URLSearchParams();
  if (options.employee_id != null) {
    params.set("employee_id", String(options.employee_id));
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.limit != null) {
    params.set("limit", String(options.limit));
  }
  const qs = params.toString();
  const path = qs ? `/provisioning-jobs/?${qs}` : "/provisioning-jobs/";
  const response = await apiFetch<ProvisioningJobsResponse>(path);
  return response.jobs;
}

export async function fetchProvisioningJob(
  jobId: number
): Promise<ProvisioningJob> {
  const response = await apiFetch<ProvisioningJobResponse>(
    `/provisioning-jobs/${jobId}`
  );
  return response.job;
}

export async function retryProvisioningJob(
  jobId: number
): Promise<ProvisioningJob> {
  const response = await apiFetch<ProvisioningJobResponse>(
    `/provisioning-jobs/${jobId}/retry`,
    { method: "POST" }
  );
  return response.job;
}

export async function cancelProvisioningJob(
  jobId: number
): Promise<ProvisioningJob> {
  const response = await apiFetch<ProvisioningJobResponse>(
    `/provisioning-jobs/${jobId}`,
    { method: "DELETE" }
  );
  return response.job;
}

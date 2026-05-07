import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import {
  cancelProvisioningJob,
  fetchProvisioningJobs,
  retryProvisioningJob,
} from "../api/provisioningJobs";
import type {
  ProvisioningJob,
  ProvisioningJobStatus,
  ProvisioningJobStepResult,
} from "../api/types";

const KIND_LABEL: Record<ProvisioningJob["kind"], string> = {
  onboard_defaults: "Onboard defaults",
  disable_defaults: "Disable defaults",
};

const STATUS_CLASS: Record<ProvisioningJobStatus, string> = {
  pending: "status-pending",
  running: "status-in_progress",
  succeeded: "status-active",
  failed: "status-terminated",
  partial: "status-pending",
};

const STATUS_LABEL: Record<ProvisioningJobStatus, string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  partial: "Partial",
};

const STEP_LABEL: Record<string, string> = {
  ad_groups: "AD groups",
  distribution_lists: "Distribution lists",
  unifi_policies: "Unifi policies",
  shared_mailbox: "Shared mailbox",
};

const STEP_STATUS_CLASS: Record<string, string> = {
  ok: "status-active",
  skipped: "status-inactive",
  failed: "status-terminated",
  partial: "status-pending",
  manual_required: "status-pending",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function describeStep(result: ProvisioningJobStepResult): string {
  const parts: string[] = [];
  if (result.added && result.added.length) {
    parts.push(`added ${result.added.length}`);
  }
  if (result.already_member && result.already_member.length) {
    parts.push(`already ${result.already_member.length}`);
  }
  if (result.removed && result.removed.length) {
    parts.push(`removed ${result.removed.length}`);
  }
  if (
    result.removed_count != null &&
    !(result.removed && result.removed.length)
  ) {
    parts.push(`removed ${result.removed_count}`);
  }
  if (result.remaining && result.remaining.length) {
    parts.push(`remaining ${result.remaining.length}`);
  }
  if (result.missing_or_failed && result.missing_or_failed.length) {
    parts.push(`missing/failed ${result.missing_or_failed.length}`);
  }
  if (result.reason) {
    parts.push(result.reason);
  }
  if (result.error) {
    parts.push(`error: ${result.error}`);
  }
  if (result.method) {
    parts.push(`via ${result.method}`);
  }
  return parts.length ? parts.join(" · ") : "";
}

interface Props {
  filterEmployeeId?: number | null;
}

export default function ProvisioningJobsView({ filterEmployeeId }: Props) {
  const [jobs, setJobs] = useState<ProvisioningJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProvisioningJobStatus>(
    "all"
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProvisioningJobs({
        employee_id: filterEmployeeId ?? undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 200,
      });
      setJobs(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const anyActive = jobs.some(
      (job) => job.status === "pending" || job.status === "running"
    );
    if (!anyActive) return;
    const id = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(id);
  }, [jobs, load]);

  const handleRetry = async (jobId: number) => {
    setActioningId(jobId);
    setError(null);
    try {
      await retryProvisioningJob(jobId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (jobId: number) => {
    setActioningId(jobId);
    setError(null);
    try {
      await cancelProvisioningJob(jobId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActioningId(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<ProvisioningJobStatus, number> = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      partial: 0,
    };
    for (const job of jobs) {
      c[job.status] += 1;
    }
    return c;
  }, [jobs]);

  return (
    <section className="section-card">
      <header className="section-card__header">
        <div>
          <h2 className="section-card__title">Provisioning Jobs</h2>
          <p className="section-card__subtitle">
            Queued default group/policy actions for new and disabled users.
          </p>
        </div>
        <div className="section-card__actions">
          <select
            className="select-compact"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | ProvisioningJobStatus)
            }
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending ({counts.pending})</option>
            <option value="running">Running ({counts.running})</option>
            <option value="succeeded">Succeeded ({counts.succeeded})</option>
            <option value="failed">Failed ({counts.failed})</option>
            <option value="partial">Partial ({counts.partial})</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          <p>{error}</p>
        </div>
      ) : null}

      {loading && jobs.length === 0 ? (
        <div className="empty-state">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">No jobs found.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Steps</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const isOpen = expandedId === job.id;
              const busy = actioningId === job.id;
              const canRetry =
                job.status === "failed" || job.status === "partial";
              const canCancel = job.status === "pending";
              const stepEntries = job.result
                ? Object.entries(job.result)
                : [];
              return (
                <Fragment key={job.id}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {job.employee_name ?? "—"}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {job.employee_email ?? "—"}
                      </div>
                    </td>
                    <td>{KIND_LABEL[job.kind]}</td>
                    <td>
                      <span
                        className={`status-badge ${STATUS_CLASS[job.status]}`}
                      >
                        {STATUS_LABEL[job.status]}
                      </span>
                    </td>
                    <td>
                      {job.attempts}/{job.max_attempts}
                    </td>
                    <td>{formatTimestamp(job.created_at)}</td>
                    <td>{formatTimestamp(job.completed_at)}</td>
                    <td>
                      {stepEntries.length ? (
                        <button
                          type="button"
                          className="btn btn-tertiary"
                          onClick={() =>
                            setExpandedId(isOpen ? null : job.id)
                          }
                        >
                          {isOpen
                            ? "Hide"
                            : `Show (${stepEntries.length})`}
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        {canRetry ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRetry(job.id)}
                            disabled={busy}
                          >
                            {busy ? "…" : "Retry"}
                          </button>
                        ) : null}
                        {canCancel ? (
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() => handleCancel(job.id)}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {isOpen && stepEntries.length ? (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--bg-card-hover)" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: "8px 4px",
                          }}
                        >
                          {stepEntries.map(([step, result]) => {
                            const status = result.status ?? "unknown";
                            return (
                              <div
                                key={step}
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ minWidth: 160, fontWeight: 600 }}>
                                  {STEP_LABEL[step] ?? step}
                                </div>
                                <span
                                  className={`status-badge ${
                                    STEP_STATUS_CLASS[status] ?? ""
                                  }`}
                                >
                                  {status}
                                </span>
                                <div
                                  className="muted"
                                  style={{ fontSize: 13 }}
                                >
                                  {describeStep(result)}
                                </div>
                              </div>
                            );
                          })}
                          {job.error ? (
                            <div
                              style={{
                                color: "var(--danger)",
                                fontSize: 13,
                              }}
                            >
                              Error: {job.error}
                            </div>
                          ) : null}
                          {job.next_run_at ? (
                            <div className="muted" style={{ fontSize: 12 }}>
                              Next retry at {formatTimestamp(job.next_run_at)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

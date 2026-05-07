import { useState } from "react";
import type { OffboardingTask } from "../api/types";
import { executeOffboardingTask } from "../api/automation";
import { TreeSection } from "./TreeSection";

type OffboardingTaskListProps = {
  categories: Record<string, OffboardingTask[]>;
  onTaskUpdated: () => Promise<void>;
  onManualComplete: (taskId: number) => Promise<void>;
};

const CATEGORY_LABELS: Record<string, string> = {
  account_access: "Account & Access",
  application_access: "Application Access",
  network_physical: "Network & Physical",
  data_transfer: "Data Transfer",
  asset_recovery: "Asset Recovery",
  record_retention: "Record Retention",
  sign_off: "Sign-Off",
};

const CATEGORY_ORDER = [
  "account_access",
  "application_access",
  "network_physical",
  "data_transfer",
  "asset_recovery",
  "record_retention",
  "sign_off",
];

function statusBadge(task: OffboardingTask) {
  if (task.status === "completed") {
    return <span className="tree-pill status-completed">Completed</span>;
  }
  if (task.status === "skipped") {
    return <span className="tree-pill status-skipped">Skipped</span>;
  }
  if (task.notes?.startsWith("FAILED:")) {
    return <span className="tree-pill status-failed">Failed</span>;
  }
  if (task.automatable && !task.requires_confirmation) {
    return <span className="tree-pill status-auto">Auto</span>;
  }
  if (task.requires_confirmation) {
    return <span className="tree-pill status-confirm">Needs Confirmation</span>;
  }
  return <span className="tree-pill status-pending">Manual</span>;
}

function OffboardingTaskList({
  categories,
  onTaskUpdated,
  onManualComplete,
}: OffboardingTaskListProps) {
  const [executingTask, setExecutingTask] = useState<number | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const sortedCategories = CATEGORY_ORDER.filter((cat) => categories[cat]);
  // Include any unlisted categories
  for (const cat of Object.keys(categories)) {
    if (!sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
  }

  const handleExecute = async (taskId: number) => {
    setExecutingTask(taskId);
    setTaskError(null);
    try {
      await executeOffboardingTask(taskId);
      await onTaskUpdated();
    } catch (err) {
      setTaskError(
        err instanceof Error ? err.message : "Failed to execute task"
      );
    } finally {
      setExecutingTask(null);
    }
  };

  const handleManualCheck = async (taskId: number) => {
    setExecutingTask(taskId);
    setTaskError(null);
    try {
      await onManualComplete(taskId);
    } catch (err) {
      setTaskError(
        err instanceof Error ? err.message : "Failed to update task"
      );
    } finally {
      setExecutingTask(null);
    }
  };

  // Overall progress
  const allTasks = Object.values(categories).flat();
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped"
  ).length;
  const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="offboarding-task-list">
      <div className="offboarding-progress">
        <div className="offboarding-progress__bar">
          <div
            className="offboarding-progress__fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="offboarding-progress__label">
          {completedTasks} of {totalTasks} tasks complete ({Math.round(progressPct)}%)
        </span>
      </div>

      {taskError && (
        <div className="inline-error">
          <span>{taskError}</span>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={() => setTaskError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {sortedCategories.map((cat) => {
        const tasks = categories[cat];
        if (!tasks || tasks.length === 0) return null;
        const catCompleted = tasks.filter(
          (t) => t.status === "completed" || t.status === "skipped"
        ).length;
        const label = CATEGORY_LABELS[cat] || cat;

        return (
          <TreeSection
            key={cat}
            title={label}
            countLabel={`${catCompleted}/${tasks.length}`}
            defaultOpen
          >
            <div className="offboarding-task-table">
              {tasks.map((task) => {
                const isCompleted = task.status === "completed" || task.status === "skipped";
                const isFailed = task.notes?.startsWith("FAILED:");
                const canExecute =
                  task.automation_key &&
                  task.requires_confirmation &&
                  !isCompleted;
                const canRetry =
                  task.automation_key && isFailed;
                const isManualPending =
                  !task.automatable && !isCompleted;

                return (
                  <div
                    key={task.id}
                    className={`offboarding-task-row ${isCompleted ? "offboarding-task-row--done" : ""} ${isFailed ? "offboarding-task-row--failed" : ""}`}
                  >
                    <div className="offboarding-task-row__status">
                      {statusBadge(task)}
                    </div>
                    <div className="offboarding-task-row__desc">
                      <span>{task.description}</span>
                      {task.completed_by && (
                        <span className="offboarding-task-row__meta">
                          by {task.completed_by}
                        </span>
                      )}
                      {task.completed_at && (
                        <span className="offboarding-task-row__meta">
                          at {new Date(task.completed_at).toLocaleString()}
                        </span>
                      )}
                      {isFailed && task.notes && (
                        <span className="offboarding-task-row__error">
                          {task.notes.replace("FAILED: ", "")}
                        </span>
                      )}
                    </div>
                    <div className="offboarding-task-row__actions">
                      {(canExecute || canRetry) && (
                        <button
                          type="button"
                          className={`btn ${canRetry ? "btn-danger" : "btn-warning"}`}
                          disabled={executingTask === task.id}
                          onClick={() => handleExecute(task.id)}
                        >
                          {executingTask === task.id
                            ? "Running..."
                            : canRetry
                              ? "Retry"
                              : "Execute"}
                        </button>
                      )}
                      {isManualPending && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={executingTask === task.id}
                          onClick={() => handleManualCheck(task.id)}
                        >
                          {executingTask === task.id ? "Saving..." : "Mark Done"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TreeSection>
        );
      })}
    </div>
  );
}

export default OffboardingTaskList;

import { useState } from "react";
import type { OnboardingTask } from "../api/types";
import { executeOnboardingTask } from "../api/automation";
import { TreeSection } from "./TreeSection";

type OnboardingTaskListProps = {
  categories: Record<string, OnboardingTask[]>;
  onTaskUpdated: () => Promise<void>;
  onManualComplete: (taskId: number) => Promise<void>;
};

const CATEGORY_LABELS: Record<string, string> = {
  account_setup: "Account Setup",
  network_storage: "Network & Storage",
  manual_setup: "Workstation & Software",
  communication: "Communication",
  sign_off: "Sign-Off",
};

const CATEGORY_ORDER = [
  "account_setup",
  "network_storage",
  "manual_setup",
  "communication",
  "sign_off",
];

function statusBadge(task: OnboardingTask) {
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

function OnboardingTaskList({
  categories,
  onTaskUpdated,
  onManualComplete,
}: OnboardingTaskListProps) {
  const [executingTask, setExecutingTask] = useState<number | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const sortedCategories = CATEGORY_ORDER.filter((cat) => categories[cat]);
  for (const cat of Object.keys(categories)) {
    if (!sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
  }

  const handleExecute = async (taskId: number) => {
    setExecutingTask(taskId);
    setTaskError(null);
    try {
      await executeOnboardingTask(taskId);
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

export default OnboardingTaskList;

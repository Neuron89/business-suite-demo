"""Queued provisioning worker.

Polls the `provisioning_jobs` table for pending work and executes it off the
request path. Handlers are pure functions from `employee_provisioning`.

The worker claims one job per tick via a status transition (pending → running)
guarded by a `WHERE status='pending' AND id=:id` update. On SQLite there's no
SKIP LOCKED, but with a single scheduler process + a short tick this is fine.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta

from flask import Flask
from sqlalchemy import and_, or_

from ..config import Config
from ..database import db
from ..models import (
    Employee,
    ProvisioningJob,
    ProvisioningJobKind,
    ProvisioningJobStatus,
)
from .employee_provisioning import (
    add_user_to_ad_groups,
    add_user_to_distribution_lists,
    assign_default_unifi_policies,
    attempt_convert_to_shared_mailbox,
    remove_user_from_all_ad_groups,
    remove_user_from_distribution_lists,
    revoke_all_unifi_policies,
)

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10


def enqueue_job(
    *,
    employee: Employee,
    kind: ProvisioningJobKind,
    triggered_by: str | None = None,
    payload: dict | None = None,
) -> ProvisioningJob:
    job = ProvisioningJob(
        employee_id=employee.id,
        employee_email=employee.email,
        employee_name=employee.full_name,
        kind=kind,
        status=ProvisioningJobStatus.PENDING,
        attempts=0,
        max_attempts=3,
        payload_json=json.dumps(payload) if payload else None,
        next_run_at=datetime.utcnow(),
        triggered_by=triggered_by,
    )
    db.session.add(job)
    db.session.commit()
    return job


def _run_onboard_defaults(employee: Employee) -> dict:
    cfg = Config.ONBOARDING
    steps: dict[str, dict] = {}
    steps["add_ad_groups"] = add_user_to_ad_groups(employee, cfg.get_ad_groups())
    steps["add_distribution_lists"] = add_user_to_distribution_lists(
        employee, cfg.get_distribution_lists()
    )
    steps["assign_unifi_policies"] = assign_default_unifi_policies(
        employee, cfg.get_unifi_policy_ids()
    )
    return steps


def _run_disable_defaults(employee: Employee) -> dict:
    steps: dict[str, dict] = {}
    steps["remove_ad_groups"] = remove_user_from_all_ad_groups(employee)
    steps["remove_distribution_lists"] = remove_user_from_distribution_lists(employee)
    steps["revoke_unifi_policies"] = revoke_all_unifi_policies(employee)
    steps["convert_shared_mailbox"] = attempt_convert_to_shared_mailbox(employee)
    return steps


_HANDLERS = {
    ProvisioningJobKind.ONBOARD_DEFAULTS: _run_onboard_defaults,
    ProvisioningJobKind.DISABLE_DEFAULTS: _run_disable_defaults,
}


def _summarize(steps: dict[str, dict]) -> ProvisioningJobStatus:
    statuses = {s.get("status") for s in steps.values()}
    if statuses == {"ok"} or statuses <= {"ok", "skipped"}:
        return ProvisioningJobStatus.SUCCEEDED
    if "failed" in statuses and not {"ok", "partial"} & statuses:
        return ProvisioningJobStatus.FAILED
    return ProvisioningJobStatus.PARTIAL


def _claim_next_job() -> ProvisioningJob | None:
    now = datetime.utcnow()
    candidate = (
        ProvisioningJob.query.filter(
            ProvisioningJob.status == ProvisioningJobStatus.PENDING,
            or_(
                ProvisioningJob.next_run_at.is_(None),
                ProvisioningJob.next_run_at <= now,
            ),
        )
        .order_by(ProvisioningJob.created_at.asc())
        .first()
    )
    if not candidate:
        return None
    rows = (
        db.session.query(ProvisioningJob)
        .filter(
            ProvisioningJob.id == candidate.id,
            ProvisioningJob.status == ProvisioningJobStatus.PENDING,
        )
        .update(
            {
                "status": ProvisioningJobStatus.RUNNING,
                "started_at": now,
                "attempts": ProvisioningJob.attempts + 1,
            },
            synchronize_session=False,
        )
    )
    db.session.commit()
    if rows == 0:
        return None
    return db.session.get(ProvisioningJob, candidate.id)


def _process_one(job: ProvisioningJob) -> None:
    employee = (
        db.session.get(Employee, job.employee_id) if job.employee_id else None
    )
    if employee is None:
        job.status = ProvisioningJobStatus.FAILED
        job.error = "Employee record no longer exists"
        job.completed_at = datetime.utcnow()
        db.session.commit()
        return

    handler = _HANDLERS.get(job.kind)
    if handler is None:
        job.status = ProvisioningJobStatus.FAILED
        job.error = f"No handler for kind {job.kind}"
        job.completed_at = datetime.utcnow()
        db.session.commit()
        return

    try:
        steps = handler(employee)
    except Exception as exc:
        logger.exception("Provisioning job %s crashed", job.id)
        job.error = f"Handler crash: {exc}"
        if job.attempts < job.max_attempts:
            job.status = ProvisioningJobStatus.PENDING
            job.next_run_at = datetime.utcnow() + timedelta(
                seconds=30 * (2 ** (job.attempts - 1))
            )
        else:
            job.status = ProvisioningJobStatus.FAILED
            job.completed_at = datetime.utcnow()
        db.session.commit()
        return

    job.result_json = json.dumps(steps, default=str)
    job.status = _summarize(steps)
    job.completed_at = datetime.utcnow()
    db.session.commit()


def run_once(app: Flask) -> int:
    """Process all currently-ready jobs. Returns the count processed."""
    processed = 0
    with app.app_context():
        while True:
            job = _claim_next_job()
            if job is None:
                break
            _process_one(job)
            processed += 1
            if processed >= 20:  # safety cap per tick
                break
    return processed


def init_provisioning_worker(app: Flask, scheduler) -> None:
    """Attach the provisioning poll job to an existing BackgroundScheduler."""
    if os.environ.get("PROVISIONING_WORKER_ENABLED", "1") == "0":
        app.logger.info("Provisioning worker disabled by env")
        return
    if scheduler is None:
        app.logger.warning("Provisioning worker: no scheduler available")
        return

    scheduler.add_job(
        run_once,
        trigger="interval",
        seconds=POLL_INTERVAL_SECONDS,
        args=[app],
        id="provisioning_worker",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
        next_run_time=datetime.utcnow() + timedelta(seconds=5),
    )
    app.logger.info(
        "Provisioning worker started — polling every %ss", POLL_INTERVAL_SECONDS
    )

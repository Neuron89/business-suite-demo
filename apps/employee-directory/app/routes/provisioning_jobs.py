from __future__ import annotations

import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..database import db
from ..models import (
    Employee,
    ProvisioningJob,
    ProvisioningJobKind,
    ProvisioningJobStatus,
)
from ..services.provisioning_queue import enqueue_job


provisioning_jobs_bp = Blueprint("provisioning_jobs", __name__)


def _serialize(job: ProvisioningJob) -> dict:
    result = None
    if job.result_json:
        try:
            result = json.loads(job.result_json)
        except json.JSONDecodeError:
            result = {"raw": job.result_json}
    return {
        "id": job.id,
        "employee_id": job.employee_id,
        "employee_email": job.employee_email,
        "employee_name": job.employee_name,
        "kind": job.kind.value,
        "status": job.status.value,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "result": result,
        "error": job.error,
        "triggered_by": job.triggered_by,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "next_run_at": job.next_run_at.isoformat() if job.next_run_at else None,
    }


@provisioning_jobs_bp.route("/", methods=["GET"])
def list_jobs():
    query = ProvisioningJob.query
    employee_id = request.args.get("employee_id", type=int)
    if employee_id is not None:
        query = query.filter_by(employee_id=employee_id)

    status = request.args.get("status")
    if status:
        try:
            query = query.filter_by(status=ProvisioningJobStatus(status))
        except ValueError:
            return jsonify({"error": f"Unknown status: {status}"}), 400

    limit = min(request.args.get("limit", type=int) or 100, 500)
    jobs = query.order_by(ProvisioningJob.created_at.desc()).limit(limit).all()
    return jsonify({"jobs": [_serialize(j) for j in jobs]})


@provisioning_jobs_bp.route("/<int:job_id>", methods=["GET"])
def get_job(job_id: int):
    job = ProvisioningJob.query.get_or_404(job_id)
    return jsonify({"job": _serialize(job)})


@provisioning_jobs_bp.route("/<int:job_id>/retry", methods=["POST"])
def retry_job(job_id: int):
    job = ProvisioningJob.query.get_or_404(job_id)
    if job.status in (ProvisioningJobStatus.PENDING, ProvisioningJobStatus.RUNNING):
        return jsonify({"error": "Job is already pending or running"}), 409

    employee = (
        db.session.get(Employee, job.employee_id) if job.employee_id else None
    )
    if employee is None:
        return jsonify({"error": "Employee record no longer exists"}), 410

    new_job = enqueue_job(
        employee=employee,
        kind=job.kind,
        triggered_by="retry",
    )
    return jsonify({"job": _serialize(new_job)}), 201


@provisioning_jobs_bp.route("/<int:job_id>", methods=["DELETE"])
def cancel_job(job_id: int):
    job = ProvisioningJob.query.get_or_404(job_id)
    if job.status != ProvisioningJobStatus.PENDING:
        return jsonify({"error": "Only pending jobs can be cancelled"}), 409
    job.status = ProvisioningJobStatus.FAILED
    job.error = "Cancelled by admin"
    job.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"job": _serialize(job)})

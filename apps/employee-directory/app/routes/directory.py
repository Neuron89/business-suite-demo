"""Read-only directory API for the Acme Industries portal and other internal services.

This blueprint is intentionally unauthenticated for session cookies — instead
it requires a service token in the `X-Service-Token` header that matches the
`PORTAL_SERVICE_TOKEN` env var. That lets the unified portal (and any other
backend) read the directory without going through the admin web session.
"""
from __future__ import annotations

import os
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import select

from ..database import db
from ..models import Employee, EmployeeStatus

directory_bp = Blueprint("directory", __name__)


_FLAG_FIELDS = {
    "moc": "has_moc_access",
    "it": "has_it_access",
    "qc": "has_qc_access",
    "sds": "has_sds_access",
    "complaint": "has_complaint_access",
    "iqms_chat": "has_iqms_chat_access",
    "employee_db": "has_employee_db_access",
    "shipping": "has_shipping_access",
    "it_test": "has_it_test_access",
}


def _expected_token() -> str | None:
    return os.environ.get("PORTAL_SERVICE_TOKEN") or current_app.config.get(
        "PORTAL_SERVICE_TOKEN"
    )


def require_service_token(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        expected = _expected_token()
        if not expected:
            # No token configured — refuse rather than serve the directory open.
            return jsonify({"error": "directory api not configured"}), 503
        provided = request.headers.get("X-Service-Token", "")
        if provided != expected:
            return jsonify({"error": "invalid service token"}), 401
        return view(*args, **kwargs)

    return wrapper


def _serialize_directory_employee(emp: Employee) -> dict:
    return {
        "id": emp.id,
        "email": emp.email,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "preferred_name": emp.preferred_name,
        "full_name": emp.full_name,
        "department": emp.department,
        "title": emp.title,
        "account_type": emp.account_type or "domain",
        "birthday": emp.birthday.isoformat() if emp.birthday else None,
        "manager_email": emp.manager_email,
        "status": emp.status.value if emp.status else None,
        "company_id": emp.company_id,
        "company_name": emp.company.name if emp.company else None,
        "office_location": emp.office_location,
        "phone": emp.phone,
        "mobile_phone": emp.mobile_phone,
        "extension": emp.extension,
        "portal_role": getattr(emp, "portal_role", "employee") or "employee",
        "moc_role": getattr(emp, "moc_role", None),
        "access": {
            "moc": bool(getattr(emp, "has_moc_access", False)),
            "it": bool(getattr(emp, "has_it_access", True)),
            "qc": bool(getattr(emp, "has_qc_access", False)),
            "sds": bool(getattr(emp, "has_sds_access", False)),
            "complaint": bool(getattr(emp, "has_complaint_access", False)),
            "iqms_chat": bool(getattr(emp, "has_iqms_chat_access", False)),
            "employee_db": bool(getattr(emp, "has_employee_db_access", False)),
            "shipping": bool(getattr(emp, "has_shipping_access", False)),
            "it_test": bool(getattr(emp, "has_it_test_access", False)),
        },
    }


@directory_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@directory_bp.route("/employees", methods=["GET"])
@require_service_token
def list_directory_employees():
    """List active employees, optionally filtered by access flag."""
    flag = request.args.get("has_access")
    include_inactive = request.args.get("include_inactive", "false").lower() == "true"

    query = select(Employee)
    if not include_inactive:
        query = query.where(Employee.status == EmployeeStatus.ACTIVE)
    if flag:
        column = _FLAG_FIELDS.get(flag)
        if not column:
            return jsonify({"error": f"unknown access flag '{flag}'"}), 400
        query = query.where(getattr(Employee, column).is_(True))

    employees = db.session.execute(query).scalars().all()
    return jsonify(
        {
            "count": len(employees),
            "employees": [_serialize_directory_employee(e) for e in employees],
        }
    )


@directory_bp.route("/employees/<path:email>", methods=["GET"])
@require_service_token
def get_directory_employee(email: str):
    employee = (
        db.session.execute(
            select(Employee).where(Employee.email == email.strip().lower())
        )
        .scalars()
        .first()
    )
    if not employee:
        return jsonify({"error": "not found"}), 404
    return jsonify({"employee": _serialize_directory_employee(employee)})


@directory_bp.route("/employees/<path:email>/access", methods=["PATCH"])
@require_service_token
def patch_directory_access(email: str):
    """Toggle access flags for an employee (used by automation/admin tools)."""
    employee = (
        db.session.execute(
            select(Employee).where(Employee.email == email.strip().lower())
        )
        .scalars()
        .first()
    )
    if not employee:
        return jsonify({"error": "not found"}), 404

    payload = request.get_json(force=True, silent=True) or {}
    access = payload.get("access") or {}
    for short_key, column in _FLAG_FIELDS.items():
        if short_key in access:
            setattr(employee, column, bool(access[short_key]))
    if "portal_role" in payload:
        role = str(payload["portal_role"]).lower()
        if role in {"employee", "manager", "hr", "admin"}:
            employee.portal_role = role
    if "moc_role" in payload:
        employee.moc_role = payload["moc_role"]

    db.session.commit()
    return jsonify({"employee": _serialize_directory_employee(employee)})

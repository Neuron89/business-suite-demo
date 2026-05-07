from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

import requests as http_requests
from flask import Blueprint, Response, current_app, jsonify, request
from pydantic import ValidationError

from ..config import Config
from ..database import db
from ..models import (
    Employee,
    UnifiAccessPolicy,
    UnifiAccessUser,
    UnifiSchedule,
)
from ..schemas import EmployeeCreateSchema, EmployeeUpdateSchema
from ..services.m365_sync import (
    M365CredentialsError,
    M365SyncError,
    M365SyncService,
    service_for_employee,
)
from ..services.reporting import (
    build_phone_directory_pdf,
    build_phone_directory_xlsx,
    build_user_list_xlsx,
)
from ..models import ProvisioningJobKind
from ..services.provisioning_queue import enqueue_job
from ..services.provisioning import (
    EmployeeProvisionError,
    generate_friendly_password,
    update_directory_identity,
)
from ..services.directory_push import (
    PUSHABLE_FIELDS,
    push_employee_profile,
)
from ..services.scada_presence import ScadaPresenceError, check_scada_presence
from sqlalchemy.exc import IntegrityError

# Fields pushed by the new directory_push service (beyond what the existing
# identity path already handles).
_EXTRA_PUSH_FIELDS = (
    "start_date",
    "manager_email",
    "mobile_phone",
    "phone",
    "office_location",
    "account_type",
)

SYNC_CACHE_WINDOW = timedelta(seconds=60)

employees_bp = Blueprint("employees", __name__)


def serialize_employee(employee: Employee) -> dict:
    return {
        "id": employee.id,
        "employee_number": employee.employee_number,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "preferred_name": employee.preferred_name,
        "full_name": employee.full_name,
        "email": employee.email,
        "department": employee.department,
        "title": employee.title,
        "status": employee.status.value,
        "created_at": employee.created_at.isoformat() if employee.created_at else None,
        "updated_at": employee.updated_at.isoformat() if employee.updated_at else None,
        "start_date": employee.start_date.isoformat()
        if employee.start_date
        else None,
        "termination_date": employee.termination_date.isoformat()
        if employee.termination_date
        else None,
        "birthday": employee.birthday.isoformat() if employee.birthday else None,
        "manager_email": employee.manager_email,
        "account_type": employee.account_type or "domain",
        "phone": employee.phone,
        "mobile_phone": employee.mobile_phone,
        "extension": employee.extension,
        "alternate_emails": employee.alternate_emails or [],
        "has_scada_account": bool(employee.has_scada_account),
        "scada_checked_at": employee.scada_checked_at.isoformat()
        if employee.scada_checked_at
        else None,
        "last_synced_at": employee.last_synced_at.isoformat()
        if employee.last_synced_at
        else None,
        "office_location": employee.office_location,
        "directory_synced_at": employee.directory_synced_at.isoformat()
        if employee.directory_synced_at
        else None,
        "directory_sync_error": employee.directory_sync_error,
        "initial_password": employee.initial_password,
        "notes": employee.notes,
        "access": {
            "moc": bool(getattr(employee, "has_moc_access", False)),
            "it": bool(getattr(employee, "has_it_access", True)),
            "qc": bool(getattr(employee, "has_qc_access", False)),
            "sds": bool(getattr(employee, "has_sds_access", False)),
            "complaint": bool(getattr(employee, "has_complaint_access", False)),
            "iqms_chat": bool(getattr(employee, "has_iqms_chat_access", False)),
            "employee_db": bool(getattr(employee, "has_employee_db_access", False)),
            "shipping": bool(getattr(employee, "has_shipping_access", False)),
            "it_test": bool(getattr(employee, "has_it_test_access", False)),
        },
        "portal_role": getattr(employee, "portal_role", "employee") or "employee",
        "moc_role": getattr(employee, "moc_role", None),
        "hardware_assets": [
            {
                "id": asset.id,
                "asset_type": asset.asset_type,
                "manufacturer": asset.manufacturer,
                "model": asset.model,
                "serial_number": asset.serial_number,
                "asset_tag": asset.asset_tag,
                "status": asset.status.value,
                "assigned_date": asset.assigned_date.isoformat()
                if asset.assigned_date
                else None,
            }
            for asset in employee.hardware_assets
        ],
        "software_subscriptions": [
            {
                "id": sub.id,
                "name": sub.name,
                "vendor": sub.vendor,
                "license_identifier": sub.license_identifier,
                "status": sub.status.value,
                "cost_center": sub.cost_center,
                "billing_cycle": sub.billing_cycle,
                "cost": sub.cost,
                "renewal_date": sub.renewal_date.isoformat()
                if sub.renewal_date
                else None,
                "assigned_date": sub.assigned_date.isoformat()
                if sub.assigned_date
                else None,
                "notes": sub.notes,
            }
            for sub in employee.software_subscriptions
        ],
        "m365_devices": [
            {
                "id": device.id,
                "device_id": device.device_id,
                "display_name": device.display_name,
                "operating_system": device.operating_system,
                "compliance_state": device.compliance_state,
                "last_sync_time": device.last_sync_time.isoformat()
                if device.last_sync_time
                else None,
            }
            for device in employee.m365_devices
        ],
        "license_assignments": [
            {
                "id": assignment.id,
                "sku_id": assignment.sku_id,
                "sku_part_number": assignment.sku_part_number,
                "sku_name": assignment.sku_name,
                "assigned_date": assignment.assigned_date.isoformat()
                if assignment.assigned_date
                else None,
            }
            for assignment in employee.license_assignments
        ],
        "directory_groups": [
            {
                "id": group.id,
                "group_name": group.group_name,
                "group_scope": group.group_scope,
                "group_type": group.group_type,
                "description": group.description,
                "source": group.source.value,
            }
            for group in employee.directory_groups
        ],
        "unifi_access": _serialize_unifi_access(employee),
        "primary_employee_id": employee.primary_employee_id,
        "linked_accounts": [
            _serialize_linked_account(la)
            for la in sorted(
                employee.linked_accounts, key=lambda e: (e.email or "").lower()
            )
        ],
    }


def _serialize_linked_account(emp: Employee) -> dict:
    return {
        "id": emp.id,
        "email": emp.email,
        "full_name": emp.full_name,
        "account_type": emp.account_type or "domain",
        "status": emp.status.value,
        "company_id": emp.company_id,
    }


def _serialize_unifi_access(employee: Employee) -> dict | None:
    ua = employee.unifi_access_user
    if not ua:
        return None

    policy_ids = [p.policy_id for p in ua.access_policies]
    catalog: dict[str, UnifiAccessPolicy] = {}
    schedules: dict[str, UnifiSchedule] = {}
    if policy_ids:
        catalog = {
            p.unifi_id: p
            for p in UnifiAccessPolicy.query.filter(
                UnifiAccessPolicy.unifi_id.in_(policy_ids)
            ).all()
        }
        schedule_ids = [c.schedule_id for c in catalog.values() if c.schedule_id]
        if schedule_ids:
            schedules = {
                s.unifi_id: s
                for s in UnifiSchedule.query.filter(
                    UnifiSchedule.unifi_id.in_(schedule_ids)
                ).all()
            }

    policies_out: list[dict[str, Any]] = []
    for p in ua.access_policies:
        cat = catalog.get(p.policy_id)
        doors: list[dict[str, Any]] = []
        schedule_payload: dict[str, Any] | None = None
        if cat is not None:
            doors = [
                {
                    "id": d.unifi_id,
                    "name": d.name,
                    "full_name": d.full_name,
                    "floor": d.floor,
                }
                for d in sorted(cat.doors, key=lambda x: x.name.lower())
            ]
            if cat.schedule_id and cat.schedule_id in schedules:
                sch = schedules[cat.schedule_id]
                schedule_payload = {
                    "id": sch.unifi_id,
                    "name": sch.name,
                    "type": sch.schedule_type,
                    "week_schedule": json.loads(sch.week_schedule_json)
                    if sch.week_schedule_json
                    else None,
                }
        policies_out.append(
            {
                "policy_id": p.policy_id,
                "policy_name": p.policy_name,
                "doors": doors,
                "schedule": schedule_payload,
            }
        )

    return {
        "unifi_id": ua.unifi_id,
        "status": ua.status,
        "employee_number": ua.employee_number,
        "avatar_relative_path": ua.avatar_relative_path,
        "phone": ua.phone,
        "nfc_cards": [
            {"card_id": c.card_id, "card_type": c.card_type}
            for c in ua.nfc_cards
        ],
        "access_policies": policies_out,
    }


def _xlsx_response(payload: bytes, filename: str) -> Response:
    return Response(
        payload,
        mimetype=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@employees_bp.route("/export/users", methods=["GET"])
def export_users_xlsx():
    payload = build_user_list_xlsx()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    return _xlsx_response(payload, f"users_{ts}.xlsx")


@employees_bp.route("/export/directory", methods=["GET"])
def export_directory_xlsx():
    payload = build_phone_directory_xlsx()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    return _xlsx_response(payload, f"phone_directory_{ts}.xlsx")


@employees_bp.route("/export/directory.pdf", methods=["GET"])
def export_directory_pdf():
    payload = build_phone_directory_pdf()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    return Response(
        payload,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="phone_directory_{ts}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@employees_bp.route("/", methods=["GET"])
def list_employees():
    query = Employee.query
    company_id = request.args.get("company_id", type=int)
    if company_id is not None:
        query = query.filter_by(company_id=company_id)
    if request.args.get("include_linked") != "1":
        query = query.filter(Employee.primary_employee_id.is_(None))
    employees = query.order_by(Employee.last_name).all()
    return jsonify({"employees": [serialize_employee(emp) for emp in employees]})


@employees_bp.route("/", methods=["POST"])
def create_employee():
    payload = request.get_json() or {}
    try:
        data = EmployeeCreateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    employee = Employee(**data.model_dump())
    employee.initial_password = generate_friendly_password()
    db.session.add(employee)
    db.session.commit()

    provisioning_job_id: int | None = None
    try:
        job = enqueue_job(
            employee=employee,
            kind=ProvisioningJobKind.ONBOARD_DEFAULTS,
            triggered_by="create_employee",
        )
        provisioning_job_id = job.id
    except Exception:
        current_app.logger.exception(
            "Failed to enqueue onboard_defaults job for %s", employee.email
        )

    response = {"employee": serialize_employee(employee)}
    if provisioning_job_id is not None:
        response["provisioning_job_id"] = provisioning_job_id
    return jsonify(response), 201


@employees_bp.route("/<int:employee_id>", methods=["GET"])
def get_employee(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    return jsonify({"employee": serialize_employee(employee)})


@employees_bp.route("/<int:employee_id>", methods=["PATCH"])
def update_employee(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}
    try:
        data = EmployeeUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return jsonify({"employee": serialize_employee(employee)})

    if "email" in updates and updates["email"] != employee.email:
        return (
            jsonify(
                {
                    "error": "Updating the primary email/UPN is not supported via this endpoint."
                }
            ),
            400,
        )

    first_name = updates.get("first_name", employee.first_name)
    last_name = updates.get("last_name", employee.last_name)
    preferred_name = updates.get("preferred_name", employee.preferred_name)

    directory_fields = {
        "first_name",
        "last_name",
        "preferred_name",
        "department",
        "title",
        "employee_number",
    }

    graph_meta: dict[str, Any] | None = None
    graph_updates_needed = any(field in updates for field in directory_fields)
    graph_payload: dict[str, Any] = {}

    if graph_updates_needed:
        display_name = (preferred_name or f"{first_name} {last_name}").strip()
        graph_payload = {
            "displayName": display_name,
            "givenName": first_name,
            "surname": last_name,
        }
        if "department" in updates:
            graph_payload["department"] = updates["department"]
        if "title" in updates:
            graph_payload["jobTitle"] = updates["title"]
        if "employee_number" in updates:
            graph_payload["employeeId"] = updates["employee_number"]

    graph_service: M365SyncService | None = None
    if graph_updates_needed:
        try:
            graph_service = service_for_employee(employee)
        except M365CredentialsError:
            graph_meta = {
                "updated": False,
                "skipped": True,
                "reason": "Missing Microsoft 365 credentials.",
            }
            graph_service = None

    if graph_service and graph_payload:
        try:
            graph_service.update_user(employee.email, graph_payload)
            graph_meta = {
                "updated": True,
                "payload": graph_payload,
            }
        except M365SyncError as exc:
            # User likely doesn't exist in M365 yet (no AD account / not synced).
            # Don't block the local edit — record it and continue.
            current_app.logger.warning(
                "M365 update skipped for %s: %s", employee.email, exc
            )
            graph_meta = {
                "updated": False,
                "skipped": True,
                "reason": f"Microsoft 365 update skipped: {exc}",
            }
    elif graph_meta is None and graph_updates_needed:
        graph_meta = {"updated": False, "skipped": True}

    ad_result: dict[str, Any] | None = None
    if any(field in updates for field in directory_fields):
        try:
            ad_result = update_directory_identity(employee, updates)
        except EmployeeProvisionError as exc:
            # User likely not in AD yet (just created in this app). Don't block
            # the local edit — record the skip and continue.
            current_app.logger.warning(
                "AD update skipped for %s: %s", employee.email, exc
            )
            ad_result = {
                "user_dn": None,
                "updated_attributes": [],
                "skipped": True,
                "reason": str(exc),
            }
    else:
        ad_result = {"user_dn": None, "updated_attributes": []}

    for field, value in updates.items():
        setattr(employee, field, value)

    # Push the extended profile fields (beyond the identity fields handled
    # above) to M365 + local AD. Only fields the caller actually changed.
    extra_push_result: dict[str, Any] | None = None
    extra_fields_changed = [f for f in _EXTRA_PUSH_FIELDS if f in updates]
    if extra_fields_changed:
        try:
            extra_push_result = push_employee_profile(
                employee, extra_fields_changed
            )
            employee.directory_synced_at = datetime.utcnow()
            errors = [
                r.get("error")
                for r in extra_push_result.values()
                if r.get("error")
            ]
            employee.directory_sync_error = "; ".join(errors) if errors else None
        except Exception as exc:  # pragma: no cover — defensive
            current_app.logger.exception(
                "Directory push failed for %s", employee.email
            )
            employee.directory_sync_error = str(exc)
            extra_push_result = {"error": str(exc)}

    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        details = str(exc.orig) if getattr(exc, "orig", None) else None
        return (
            jsonify(
                {
                    "error": "Employee update failed due to a duplicate value.",
                    "details": details,
                }
            ),
            409,
        )

    response: dict[str, Any] = {
        "employee": serialize_employee(employee),
        "local_ad": ad_result,
    }
    if graph_meta is not None:
        response["m365"] = graph_meta
    if extra_push_result is not None:
        response["directory_push"] = extra_push_result

    return jsonify(response)


@employees_bp.route("/<int:employee_id>/directory-push", methods=["POST"])
def resync_directory(employee_id: int):
    """Manually push all profile fields from the app back to M365 + AD."""
    employee = Employee.query.get_or_404(employee_id)
    result = push_employee_profile(employee, list(PUSHABLE_FIELDS))
    employee.directory_synced_at = datetime.utcnow()
    errors = [r.get("error") for r in result.values() if r.get("error")]
    employee.directory_sync_error = "; ".join(errors) if errors else None
    db.session.commit()
    return jsonify(
        {
            "employee": serialize_employee(employee),
            "result": result,
        }
    )


def _parse_graph_hire_date(value: Any) -> str | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.rstrip("Z").split("T")[0]).date().isoformat()
    except (ValueError, TypeError):
        return None


@employees_bp.route("/lookup", methods=["POST"])
def lookup_employee():
    """Look up an email address in Microsoft Graph and return a pre-filled
    create-employee payload. Used by the quick-add onboarding flow.
    """
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    # Detect duplicates before hitting Graph.
    existing = Employee.query.filter_by(email=email).one_or_none()
    if existing:
        return jsonify(
            {
                "exists": True,
                "employee": serialize_employee(existing),
            }
        )

    # Route to the right tenant
    from ..services.m365_sync import graph_config_for_email

    cfg = graph_config_for_email(email)
    if not cfg or not cfg.tenant_id:
        return (
            jsonify({"error": "No Graph tenant configured for that email domain"}),
            400,
        )

    try:
        service = M365SyncService(graph_config=cfg)
    except M365CredentialsError as exc:
        return jsonify({"error": f"Graph credentials missing: {exc}"}), 503

    try:
        user = service.lookup_user_profile(email)
    except M365SyncError as exc:
        return jsonify({"error": f"Graph lookup failed: {exc}"}), 502

    if not user:
        return jsonify({"exists": False, "found_in_graph": False, "email": email})

    display_name = user.get("displayName") or ""
    parts = display_name.split()
    first_name = user.get("givenName") or (parts[0] if parts else "")
    last_name = user.get("surname") or (
        " ".join(parts[1:]) if len(parts) > 1 else ""
    )
    business_phones = user.get("businessPhones") or []
    manager_obj = user.get("manager") or {}
    manager_email = manager_obj.get("mail") or manager_obj.get("userPrincipalName")

    prefilled = {
        "email": user.get("mail") or user.get("userPrincipalName") or email,
        "first_name": first_name,
        "last_name": last_name,
        "preferred_name": display_name or None,
        "department": user.get("department"),
        "title": user.get("jobTitle"),
        "employee_number": user.get("employeeId"),
        "start_date": _parse_graph_hire_date(user.get("employeeHireDate")),
        "manager_email": manager_email,
        "mobile_phone": user.get("mobilePhone"),
        "phone": business_phones[0] if business_phones else None,
        "office_location": user.get("officeLocation"),
        "account_type": user.get("employeeType") or "domain",
    }
    return jsonify(
        {
            "exists": False,
            "found_in_graph": True,
            "prefilled": prefilled,
            "raw": {
                "id": user.get("id"),
                "userType": user.get("userType"),
                "accountEnabled": user.get("accountEnabled"),
            },
        }
    )


@employees_bp.route("/<int:employee_id>", methods=["DELETE"])
def delete_employee(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    if employee.lifecycle_events:
        return (
            jsonify(
                {
                    "error": "Employee has lifecycle events; cancel events before deleting."
                }
            ),
            409,
        )

    db.session.delete(employee)
    db.session.commit()
    return jsonify({"status": "deleted"})


@employees_bp.route("/<int:employee_id>/sync", methods=["POST"])
def sync_employee(employee_id: int):
    """Refresh one employee's live data from M365 + SCADA.

    Cached for 60s per employee; ?force=1 bypasses the cache.
    """
    employee = Employee.query.get_or_404(employee_id)
    force = request.args.get("force", "0").lower() in ("1", "true", "yes")

    if (
        not force
        and employee.last_synced_at
        and datetime.utcnow() - employee.last_synced_at < SYNC_CACHE_WINDOW
    ):
        return jsonify(
            {
                "employee": serialize_employee(employee),
                "cached": True,
                "results": None,
            }
        )

    results: dict[str, Any] = {}
    warnings: list[str] = []

    try:
        service = service_for_employee(employee)
        results["m365"] = service.sync_single_employee(employee)
    except M365CredentialsError as exc:
        warnings.append(f"Microsoft 365 skipped: {exc}")
        results["m365"] = {"error": str(exc)}
    except M365SyncError as exc:
        warnings.append(f"Microsoft 365 error: {exc}")
        results["m365"] = {"error": str(exc)}

    if Config.SCADA_AD.server:
        try:
            scada_match = check_scada_presence(employee)
            results["scada"] = {"has_account": scada_match}
        except ScadaPresenceError as exc:
            warnings.append(f"SCADA skipped: {exc}")
            results["scada"] = {"error": str(exc)}
    else:
        results["scada"] = {"skipped": "SCADA AD not configured"}

    employee.last_synced_at = datetime.utcnow()

    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.exception("Per-user sync commit failed for %s", employee.email)
        return (
            jsonify({"error": "Sync commit failed.", "details": str(exc.orig) if getattr(exc, "orig", None) else None}),
            500,
        )

    return jsonify(
        {
            "employee": serialize_employee(employee),
            "cached": False,
            "results": results,
            "warnings": warnings,
        }
    )


@employees_bp.route("/<int:employee_id>/avatar", methods=["GET"])
def get_employee_avatar(employee_id: int):
    """Proxy the employee's Unifi Access avatar image."""
    employee = Employee.query.get_or_404(employee_id)
    ua = employee.unifi_access_user
    if not ua or not ua.avatar_relative_path:
        return Response(status=404)
    cfg = Config.UNIFI_ACCESS
    if not cfg.configured:
        return Response(status=404)
    # Fetch from Unifi Access API
    url = f"{cfg.base_url}/api/v1/developer/users/{ua.unifi_id}/avatar"
    try:
        resp = http_requests.get(
            url,
            headers={"Authorization": f"Bearer {cfg.api_token}"},
            timeout=10,
            verify=False,
        )
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            return Response(
                resp.content,
                content_type=resp.headers["content-type"],
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except Exception:
        pass
    return Response(status=404)


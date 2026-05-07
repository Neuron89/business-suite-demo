from __future__ import annotations

import time

from typing import Any

from flask import Blueprint, jsonify, make_response, request
from pydantic import ValidationError
from datetime import datetime
from sqlalchemy.exc import OperationalError

from ..config import Config
from ..database import db
from ..models import (
    Employee,
    EmployeeStatus,
    LifecycleEvent,
    LifecycleEventType,
    LifecycleTask,
    LifecycleTaskStatus,
    ProvisioningJobKind,
)
from ..schemas import (
    EmployeePasswordResetSchema,
    EmployeeProvisionSchema,
    LifecycleEventCreateSchema,
    LifecycleTaskUpdateSchema,
)
from ..services.checklist import build_offboarding_checklist
from ..services.provisioning_queue import enqueue_job
from ..services.local_ad_sync import LocalADSyncError, sync_from_config, sync_all_from_config
from ..services.lifecycle import complete_event_if_ready, create_lifecycle_event, create_offboarding_event
from ..services.offboarding_automation import (
    auto_execute_low_risk_tasks,
    execute_task as execute_automation_task,
)
from ..services.onboarding_automation import (
    auto_execute_low_risk_tasks as onboarding_auto_execute,
    execute_task as execute_onboarding_task,
)
from ..services.lifecycle import create_onboarding_event
from ..services.m365_sync import (
    M365CredentialsError,
    M365SyncError,
    M365SyncService,
    service_for_employee,
    sync_all_tenants,
)
from ..services.unifi_access_sync import UnifiAccessError, UnifiAccessService
from ..services.email_templates import generate_announcement_email, generate_manager_email
from ..services.reporting import export_asset_snapshot
from ..services.welcome_packet import build_welcome_packet_html
from ..services.provisioning import (
    EmployeeProvisionError,
    EmployeeProvisionPayload,
    generate_temp_password,
    provision_employee,
    reset_ad_password,
    _ensure_local_ad_settings,
    _build_connection,
    delete_ad_account,
    delete_employee_ad_all,
    set_ad_account_enabled,
    set_employee_enabled_all_ads,
)
from ..services.pruning import prune_employees
from .employees import serialize_employee

automation_bp = Blueprint("automation", __name__)


def serialize_task(task: LifecycleTask) -> dict:
    return {
        "id": task.id,
        "description": task.description,
        "task_type": task.task_type,
        "category": task.category,
        "status": task.status.value,
        "automatable": bool(task.automatable),
        "automation_key": task.automation_key,
        "requires_confirmation": bool(task.requires_confirmation),
        "completed_by": task.completed_by,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "notes": task.notes,
    }


def serialize_event(event: LifecycleEvent) -> dict:
    return {
        "id": event.id,
        "employee_id": event.employee_id,
        "event_type": event.event_type.value,
        "status": event.status.value,
        "initiated_by": event.initiated_by,
        "urgency": event.urgency,
        "delegate_email": event.delegate_email,
        "it_signoff_name": event.it_signoff_name,
        "it_signoff_date": event.it_signoff_date.isoformat() if event.it_signoff_date else None,
        "manager_signoff_name": event.manager_signoff_name,
        "manager_signoff_date": event.manager_signoff_date.isoformat() if event.manager_signoff_date else None,
        "scheduled_for": event.scheduled_for.isoformat()
        if event.scheduled_for
        else None,
        "completed_at": event.completed_at.isoformat()
        if event.completed_at
        else None,
        "notes": event.notes,
        "tasks": [serialize_task(task) for task in event.tasks],
    }


@automation_bp.route("/onboarding/<int:employee_id>", methods=["POST"])
def create_onboarding(employee_id: int):
    return _create_event(employee_id, LifecycleEventType.ONBOARDING)


@automation_bp.route("/offboarding/<int:employee_id>", methods=["POST"])
def create_offboarding(employee_id: int):
    return _create_event(employee_id, LifecycleEventType.OFFBOARDING)


@automation_bp.route(
    "/offboarding/<int:employee_id>/checklist", methods=["GET"]
)
def export_offboarding_checklist(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    checklist = build_offboarding_checklist(employee)
    filename = f"offboarding_{employee.id}_checklist.txt"
    response = make_response(checklist)
    response.headers["Content-Type"] = "text/plain; charset=utf-8"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="{filename}"'
    )
    return response


def _create_event(employee_id: int, event_type: LifecycleEventType):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}
    try:
        data = LifecycleEventCreateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    event = create_lifecycle_event(
        employee=employee,
        event_type=event_type,
        initiated_by=data.initiated_by,
        scheduled_for=data.scheduled_for,
        notes=data.notes,
    )
    return jsonify({"event": serialize_event(event)}), 201


@automation_bp.route("/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id: int):
    task = LifecycleTask.query.get_or_404(task_id)
    payload = request.get_json() or {}
    try:
        data = LifecycleTaskUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    task.status = data.status
    task.notes = data.notes
    task.completed_at = data.completed_at

    if task.status == LifecycleTaskStatus.COMPLETED and not task.completed_at:
        task.completed_at = db.func.now()

    db.session.commit()
    complete_event_if_ready(task.event)
    return jsonify({"task": serialize_task(task)})


@automation_bp.route("/sync/m365", methods=["POST"])
def sync_m365():
    try:
        stats = sync_all_tenants()
    except M365CredentialsError as exc:
        return jsonify({"error": str(exc)}), 400
    except M365SyncError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        return jsonify({"error": f"M365 sync failed: {exc}"}), 502
    return jsonify({"status": "ok", "stats": stats})


@automation_bp.route("/sync/unifi-access", methods=["POST"])
def sync_unifi_access():
    try:
        service = UnifiAccessService()
        stats = service.sync()
    except UnifiAccessError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unifi Access sync failed: {exc}"}), 502
    return jsonify({"status": "ok", "stats": stats})


@automation_bp.route("/sync/scada", methods=["POST"])
def sync_scada():
    from ..services.scada_presence import sync_scada_presence, ScadaPresenceError
    try:
        stats = sync_scada_presence()
    except ScadaPresenceError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"SCADA sync failed: {exc}"}), 502
    return jsonify({"status": "ok", "stats": stats})


@automation_bp.route("/sync/local-ad", methods=["POST"])
def sync_local_ad():
    try:
        stats = sync_all_from_config()
    except LocalADSyncError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - unexpected errors
        return jsonify({"error": f"Local AD sync failed: {exc}"}), 502
    return jsonify({"status": "ok", "stats": stats})


@automation_bp.route("/provision/employee", methods=["POST"])
def provision_employee_endpoint():
    payload = request.get_json() or {}
    try:
        data = EmployeeProvisionSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    try:
        result = provision_employee(
            EmployeeProvisionPayload(**data.model_dump())
        )
    except EmployeeProvisionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - unexpected errors
        return jsonify({"error": f"Employee provisioning failed: {exc}"}), 502

    employee = result["employee"]
    response_payload = {
        "status": "ok",
        "employee": serialize_employee(employee),
        "details": {
            "ad_user_dn": result.get("ad_user_dn"),
            "m365_user": {
                "id": result.get("m365_user", {}).get("id"),
                "userPrincipalName": result.get("m365_user", {}).get("userPrincipalName"),
            }
            if result.get("m365_user")
            else None,
            "initial_password_set": result.get("initial_password_set", False),
            "m365_password_generated": result.get("m365_password_generated", False),
            "temp_password_generated": result.get("temp_password_generated", False),
            "initial_password": employee.initial_password,
        },
    }
    return jsonify(response_payload), 201


@automation_bp.route("/sync/all", methods=["POST"])
def sync_all():
    from ..services.full_sync import run_full_sync
    results = run_full_sync()
    return jsonify({"status": "ok", "stats": results})


def _commit_with_retry(retries: int = 3, delay: float = 0.15) -> None:
    for attempt in range(retries):
        try:
            db.session.commit()
            return
        except OperationalError as exc:
            db.session.rollback()
            if attempt == retries - 1:
                raise exc
            time.sleep(delay)


@automation_bp.route("/users/<int:employee_id>/disable", methods=["POST"])
def disable_employee_account(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}
    disable = bool(payload.get("disable", True))

    ad_results = set_employee_enabled_all_ads(employee, enabled=not disable)

    m365_updated = False
    m365_error: str | None = None
    try:
        service = service_for_employee(employee)
        m365_updated = service.set_user_enabled(employee.email, not disable)
    except M365CredentialsError as exc:
        m365_error = f"Missing credentials: {exc}"
    except M365SyncError as exc:
        m365_error = str(exc)

    employee.status = (
        EmployeeStatus.INACTIVE if disable else EmployeeStatus.ACTIVE
    )
    _commit_with_retry()

    warnings: list[str] = []
    for r in ad_results:
        if r["error"]:
            warnings.append(f"{r['label']} AD error: {r['error']}")
        elif not r["found"]:
            warnings.append(f"{r['label']} AD account not found; skipped.")
    if m365_error:
        warnings.append(f"Microsoft 365 error: {m365_error}")
    elif not m365_updated:
        warnings.append("Microsoft 365 account not found in the expected tenant; skipped.")

    provisioning_job_id: int | None = None
    if disable:
        try:
            job = enqueue_job(
                employee=employee,
                kind=ProvisioningJobKind.DISABLE_DEFAULTS,
                triggered_by="disable_employee_account",
            )
            provisioning_job_id = job.id
        except Exception as exc:
            warnings.append(f"Failed to queue disable cleanup: {exc}")

    return jsonify(
        {
            "status": "ok",
            "disabled": disable,
            "ad_results": ad_results,
            "m365_updated": m365_updated,
            "warnings": warnings,
            "provisioning_job_id": provisioning_job_id,
        }
    )


@automation_bp.route("/users/<int:employee_id>/reset-password", methods=["POST"])
def reset_employee_password(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}
    try:
        data = EmployeePasswordResetSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    generated = False
    password = data.password
    if data.generate or not password:
        password = generate_temp_password()
        generated = True

    try:
        settings = _ensure_local_ad_settings()
        ad_result = reset_ad_password(
            settings,
            employee.email,
            password,
            force_reset=data.force_password_reset,
        )
        ad_result["force_reset_requested"] = data.force_password_reset
        if data.enable_local_ad:
            ad_result["enabled"] = set_ad_account_enabled(
                settings, employee.email, enabled=True
            )
    except EmployeeProvisionError as exc:
        return jsonify({"error": str(exc)}), 502

    m365_result: dict[str, Any] | None = None
    try:
        service = service_for_employee(employee)
        service.reset_user_password(
            employee.email,
            password,
            force_change=data.force_password_reset,
        )
        m365_result = {
            "updated": True,
            "force_reset_requested": data.force_password_reset,
        }
        if data.enable_m365:
            service.set_user_enabled(employee.email, True)
            m365_result["enabled"] = True
    except M365CredentialsError:
        m365_result = {
            "updated": False,
            "skipped": True,
            "reason": "Missing Microsoft 365 credentials.",
        }
    except M365SyncError as exc:
        return jsonify({"error": f"Microsoft 365 password reset failed: {exc}"}), 502

    response: dict[str, Any] = {
        "status": "ok",
        "password": password,
        "generated": generated,
        "local_ad": ad_result,
    }
    if m365_result is not None:
        response["m365"] = m365_result
    return jsonify(response)


@automation_bp.route("/users/<int:employee_id>/delete", methods=["POST"])
def delete_employee_account(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}
    confirm_text = str(payload.get("confirm", "")).strip()
    expected = employee.full_name

    if confirm_text != expected:
        return (
            jsonify(
                {
                    "error": f"Please enter '{expected}' to confirm deletion.",
                }
            ),
            400,
        )

    export_dir = Config.EXPORT_DIR
    export_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    checklist_path = export_dir / f"offboarding_{employee.id}_{timestamp}.txt"
    checklist_text = build_offboarding_checklist(employee)
    with checklist_path.open("w", encoding="utf-8") as handle:
        handle.write(checklist_text)
    payload_export = checklist_path

    # Step 2: optionally confirm deletion after export
    if not payload.get("force"):
        return jsonify(
            {
                "status": "pending",
                "message": "Offboarding checklist exported. Confirm deletion to continue.",
                "export_path": str(payload_export),
            }
        )

    ad_results = delete_employee_ad_all(employee)

    m365_deleted = False
    m365_error: str | None = None
    try:
        service = service_for_employee(employee)
        m365_deleted = service.delete_user(employee.email)
    except M365CredentialsError as exc:
        m365_error = f"Missing credentials: {exc}"
    except M365SyncError as exc:
        m365_error = str(exc)

    db.session.delete(employee)
    _commit_with_retry()

    warnings: list[str] = []
    for r in ad_results:
        if r["error"]:
            warnings.append(f"{r['label']} AD error: {r['error']}")
        elif not r["found"]:
            warnings.append(f"{r['label']} AD account not found; skipped.")
    if m365_error:
        warnings.append(f"Microsoft 365 error: {m365_error}")
    elif not m365_deleted:
        warnings.append("Microsoft 365 account not found in the expected tenant; skipped.")

    return jsonify(
        {
            "status": "ok",
            "export_path": str(payload_export),
            "ad_results": ad_results,
            "m365_deleted": m365_deleted,
            "warnings": warnings,
        }
    )


@automation_bp.route("/offboarding/<int:employee_id>/start", methods=["POST"])
def start_offboarding(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}

    urgency = payload.get("urgency", "standard")
    if urgency not in ("immediate", "standard"):
        return jsonify({"error": "urgency must be 'immediate' or 'standard'"}), 400

    delegate_email = payload.get("delegate_email")
    litigation_hold = bool(payload.get("litigation_hold", False))
    convert_shared_mailbox = bool(payload.get("convert_shared_mailbox", False))
    initiated_by = payload.get("initiated_by")
    notes = payload.get("notes")

    event = create_offboarding_event(
        employee=employee,
        initiated_by=initiated_by,
        notes=notes,
        urgency=urgency,
        delegate_email=delegate_email,
        convert_shared_mailbox=convert_shared_mailbox,
        litigation_hold=litigation_hold,
    )

    # Auto-execute low-risk tasks
    auto_results = auto_execute_low_risk_tasks(event)

    return jsonify({
        "event": serialize_event(event),
        "automation": auto_results,
    }), 201


@automation_bp.route("/offboarding/tasks/<int:task_id>/execute", methods=["POST"])
def execute_offboarding_task(task_id: int):
    task = LifecycleTask.query.get_or_404(task_id)
    if not task.automation_key:
        return jsonify({"error": "This task cannot be automated"}), 400

    result = execute_automation_task(task)
    complete_event_if_ready(task.event)
    return jsonify({"task": serialize_task(task), "result": result})


@automation_bp.route("/offboarding/<int:event_id>/signoff", methods=["POST"])
def signoff_offboarding(event_id: int):
    event = LifecycleEvent.query.get_or_404(event_id)
    payload = request.get_json() or {}

    role = payload.get("role")
    name = payload.get("name")

    if not role or role not in ("it", "manager"):
        return jsonify({"error": "role must be 'it' or 'manager'"}), 400
    if not name or not name.strip():
        return jsonify({"error": "name is required"}), 400

    if role == "it":
        event.it_signoff_name = name.strip()
        event.it_signoff_date = datetime.utcnow()
    else:
        event.manager_signoff_name = name.strip()
        event.manager_signoff_date = datetime.utcnow()

    db.session.commit()
    return jsonify({"event": serialize_event(event)})


@automation_bp.route("/offboarding/<int:event_id>/status", methods=["GET"])
def offboarding_status(event_id: int):
    event = LifecycleEvent.query.get_or_404(event_id)

    # Group tasks by category
    categories: dict[str, list] = {}
    for task in event.tasks:
        cat = task.category or task.task_type or "other"
        categories.setdefault(cat, []).append(serialize_task(task))

    total = len(event.tasks)
    completed = sum(
        1 for t in event.tasks
        if t.status in (LifecycleTaskStatus.COMPLETED, LifecycleTaskStatus.SKIPPED)
    )

    return jsonify({
        "event": serialize_event(event),
        "categories": categories,
        "progress": {"total": total, "completed": completed},
    })


# ── Onboarding automation endpoints ──────────────────────────────────


@automation_bp.route("/onboarding/<int:employee_id>/start", methods=["POST"])
def start_onboarding(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    payload = request.get_json() or {}

    initiated_by = payload.get("initiated_by")
    notes = payload.get("notes")

    event = create_onboarding_event(
        employee=employee,
        initiated_by=initiated_by,
        notes=notes,
    )

    # Auto-execute low-risk tasks
    auto_results = onboarding_auto_execute(event)

    return jsonify({
        "event": serialize_event(event),
        "automation": auto_results,
    }), 201


@automation_bp.route("/onboarding/tasks/<int:task_id>/execute", methods=["POST"])
def execute_onboarding_task_endpoint(task_id: int):
    task = LifecycleTask.query.get_or_404(task_id)
    if not task.automation_key:
        return jsonify({"error": "This task cannot be automated"}), 400

    result = execute_onboarding_task(task)
    complete_event_if_ready(task.event)
    return jsonify({"task": serialize_task(task), "result": result})


@automation_bp.route("/onboarding/<int:event_id>/signoff", methods=["POST"])
def signoff_onboarding(event_id: int):
    event = LifecycleEvent.query.get_or_404(event_id)
    payload = request.get_json() or {}

    role = payload.get("role")
    name = payload.get("name")

    if not role or role not in ("it", "manager"):
        return jsonify({"error": "role must be 'it' or 'manager'"}), 400
    if not name or not name.strip():
        return jsonify({"error": "name is required"}), 400

    if role == "it":
        event.it_signoff_name = name.strip()
        event.it_signoff_date = datetime.utcnow()
    else:
        event.manager_signoff_name = name.strip()
        event.manager_signoff_date = datetime.utcnow()

    db.session.commit()
    return jsonify({"event": serialize_event(event)})


@automation_bp.route("/onboarding/<int:event_id>/status", methods=["GET"])
def onboarding_status(event_id: int):
    event = LifecycleEvent.query.get_or_404(event_id)

    # Group tasks by category
    categories: dict[str, list] = {}
    for task in event.tasks:
        cat = task.category or task.task_type or "other"
        categories.setdefault(cat, []).append(serialize_task(task))

    total = len(event.tasks)
    completed = sum(
        1 for t in event.tasks
        if t.status in (LifecycleTaskStatus.COMPLETED, LifecycleTaskStatus.SKIPPED)
    )

    return jsonify({
        "event": serialize_event(event),
        "categories": categories,
        "progress": {"total": total, "completed": completed},
    })


@automation_bp.route(
    "/onboarding/<int:employee_id>/welcome-packet", methods=["GET"]
)
def onboarding_welcome_packet(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    company_id = request.args.get("company_id", type=int)
    html_content = build_welcome_packet_html(employee, company_id)
    response = make_response(html_content)
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


@automation_bp.route(
    "/onboarding/<int:employee_id>/emails", methods=["GET"]
)
def onboarding_emails(employee_id: int):
    employee = Employee.query.get_or_404(employee_id)
    company_id = request.args.get("company_id", type=int)
    return jsonify(
        {
            "manager_email": generate_manager_email(employee, company_id),
            "announcement_email": generate_announcement_email(employee, company_id),
        }
    )


@automation_bp.route("/provision/debug", methods=["POST"])
def provision_debug():
    details = {}
    try:
        settings = _ensure_local_ad_settings()
        details = {
            "server": settings.server,
            "base_dn": settings.base_dn,
            "auth_type": settings.auth_type,
            "use_ssl": settings.use_ssl,
            "staff_ou": settings.staff_ou,
            "sync_user": settings.user,
            "sync_user_repr": repr(settings.user),
            "provision_user": settings.provision_user or settings.user,
            "provision_user_repr": repr(settings.provision_user or settings.user),
            "sync_password_set": bool(settings.password),
            "provision_password_set": bool(settings.provision_password or settings.password),
            "sync_password_length": len(settings.password or ""),
            "provision_password_length": len(settings.provision_password or settings.password or ""),
        }
        conn = _build_connection(settings)
        conn.unbind()
        return jsonify({"status": "ok", "details": details})
    except EmployeeProvisionError as exc:
        return jsonify({"status": "error", "message": str(exc), "details": details})
    except Exception as exc:  # pragma: no cover
        return jsonify({"status": "error", "message": str(exc), "details": details}), 500


@automation_bp.route("/export/excel", methods=["POST"])
def export_excel():
    export_path = export_asset_snapshot()
    return jsonify({"status": "ok", "export_path": str(export_path)})


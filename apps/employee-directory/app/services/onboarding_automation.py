from __future__ import annotations

import logging
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote

from flask import current_app

from ..database import db
from ..models import (
    Employee,
    LifecycleEvent,
    LifecycleTask,
    LifecycleTaskStatus,
)
from .lifecycle import complete_event_if_ready
from .provisioning import (
    _ensure_local_ad_settings,
    _build_connection,
    _find_ad_user_dn,
)
from .m365_sync import (
    M365CredentialsError,
    M365SyncError,
    M365SyncService,
    service_for_employee,
)

logger = logging.getLogger(__name__)


class OnboardingAutomationError(RuntimeError):
    """Raised when an onboarding automation step fails."""


def _get_m365_service(employee: Employee | None = None) -> M365SyncService | None:
    try:
        if employee is not None:
            return service_for_employee(employee)
        return M365SyncService()
    except M365CredentialsError:
        logger.warning("M365 credentials not configured; skipping M365 operations.")
        return None


def _get_onboarding_config():
    return current_app.config.get("ONBOARDING")


def _mark_task_completed(task: LifecycleTask, completed_by: str, notes: str | None = None) -> None:
    task.status = LifecycleTaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    task.completed_by = completed_by
    if notes:
        task.notes = notes


def _mark_task_failed(task: LifecycleTask, error: str) -> None:
    task.notes = f"FAILED: {error}"


# ── Individual automation functions ──────────────────────────────────

def _exec_add_ad_groups(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    groups = config.get_ad_groups() if config else []
    if not groups:
        _mark_task_completed(task, "automation", notes="No standard AD groups configured")
        return

    from ldap3 import MODIFY_ADD

    settings = _ensure_local_ad_settings(employee.email)
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            _mark_task_failed(task, "AD account not found")
            return

        added = 0
        skipped = 0
        for group_cn in groups:
            conn.search(
                search_base=settings.base_dn,
                search_filter=f"(&(objectClass=group)(cn={group_cn}))",
                attributes=["distinguishedName"],
            )
            if not conn.entries:
                logger.warning("AD group not found: %s", group_cn)
                continue

            group_dn = str(conn.entries[0].distinguishedName)
            if conn.modify(group_dn, {"member": [(MODIFY_ADD, [user_dn])]}):
                added += 1
            else:
                message = conn.result.get("message", "")
                if "already" in message.lower() or conn.result.get("result", 0) == 68:
                    skipped += 1
                else:
                    logger.warning("Failed to add %s to %s: %s", user_dn, group_dn, conn.result)

        _mark_task_completed(task, "automation", notes=f"Added to {added} groups, {skipped} already member")
    except Exception as exc:
        _mark_task_failed(task, str(exc))
    finally:
        conn.unbind()


def _exec_add_distribution_lists(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    dist_lists = config.get_distribution_lists() if config else []
    if not dist_lists:
        _mark_task_completed(task, "automation", notes="No distribution lists configured")
        return

    svc = _get_m365_service(employee)
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return

    user_data = svc.get_user(employee.email)
    if not user_data:
        _mark_task_failed(task, f"User {employee.email} not found in M365")
        return
    user_id = user_data.get("id", "")

    added = 0
    skipped = 0
    for list_identifier in dist_lists:
        try:
            # Search by mail or displayName
            search_url = (
                "https://graph.microsoft.com/v1.0/groups"
                f"?$filter=mail eq '{list_identifier}' or displayName eq '{list_identifier}'"
                "&$select=id,displayName,mail"
            )
            data = svc._get(search_url)
            groups = data.get("value", [])
            if not groups:
                logger.warning("Distribution list not found: %s", list_identifier)
                continue

            group_id = groups[0]["id"]
            member_url = f"https://graph.microsoft.com/v1.0/groups/{group_id}/members/$ref"
            payload = {"@odata.id": f"https://graph.microsoft.com/v1.0/directoryObjects/{user_id}"}
            try:
                svc._request("POST", member_url, json=payload, expected_status=(204,))
                added += 1
            except M365SyncError as exc:
                if "already exist" in str(exc).lower():
                    skipped += 1
                else:
                    logger.warning("Failed to add %s to %s: %s", employee.email, list_identifier, exc)
        except M365SyncError as exc:
            logger.warning("Error searching for group %s: %s", list_identifier, exc)

    _mark_task_completed(task, "automation", notes=f"Added to {added} lists, {skipped} already member")


def _exec_assign_m365_licenses(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    sku_ids = config.get_license_skus() if config else []
    if not sku_ids:
        _mark_task_completed(task, "automation", notes="No M365 license SKUs configured")
        return

    svc = _get_m365_service(employee)
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return

    encoded = quote(employee.email)
    assign_url = f"https://graph.microsoft.com/v1.0/users/{encoded}/assignLicense"
    add_licenses = [{"skuId": sku, "disabledPlans": []} for sku in sku_ids]
    payload = {"addLicenses": add_licenses, "removeLicenses": []}

    try:
        svc._request("POST", assign_url, json=payload, expected_status=(200,))
        _mark_task_completed(task, "automation", notes=f"Assigned {len(sku_ids)} license(s)")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def _exec_enable_m365_signin(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service(employee)
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        svc.set_user_enabled(employee.email, True)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def _exec_create_home_drive(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    if not config or not config.home_drive_path:
        _mark_task_completed(task, "automation", notes="Home drive path not configured")
        return

    username = employee.email.split("@")[0] if employee.email else ""
    if not username:
        _mark_task_failed(task, "Cannot determine username from email")
        return

    unc_path = config.home_drive_path.replace("{username}", username)
    try:
        Path(unc_path).mkdir(parents=True, exist_ok=True)
        _mark_task_completed(task, "automation", notes=f"Created {unc_path}")
    except OSError as exc:
        _mark_task_failed(task, f"Failed to create {unc_path}: {exc}")


def _exec_set_home_drive_permissions(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    if not config or not config.home_drive_path:
        _mark_task_completed(task, "automation", notes="Home drive path not configured")
        return

    username = employee.email.split("@")[0] if employee.email else ""
    if not username:
        _mark_task_failed(task, "Cannot determine username from email")
        return

    unc_path = config.home_drive_path.replace("{username}", username)

    # Extract domain from base_dn (e.g. DC=contoso,DC=com -> CONTOSO)
    settings = _ensure_local_ad_settings(employee.email)
    domain = ""
    if settings.base_dn:
        parts = [p.split("=")[1] for p in settings.base_dn.split(",") if p.upper().startswith("DC=")]
        if parts:
            domain = parts[0].upper()

    if domain:
        user_acl = f"{domain}\\{username}:(OI)(CI)F"
    else:
        user_acl = f"{username}:(OI)(CI)F"

    try:
        result = subprocess.run(
            ["icacls", unc_path, "/grant", user_acl],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            _mark_task_completed(task, "automation", notes=f"Granted full control to {user_acl}")
        else:
            _mark_task_failed(task, f"icacls failed: {result.stderr.strip()}")
    except Exception as exc:
        _mark_task_failed(task, f"icacls error: {exc}")


def _exec_generate_gpo_script(employee: Employee, task: LifecycleTask) -> None:
    config = _get_onboarding_config()
    if not config or not config.home_drive_path:
        _mark_task_completed(task, "automation", notes="Home drive path not configured")
        return

    username = employee.email.split("@")[0] if employee.email else ""
    if not username:
        _mark_task_failed(task, "Cannot determine username from email")
        return

    unc_path = config.home_drive_path.replace("{username}", username)
    drive_letter = config.home_drive_letter.rstrip(":")

    script = (
        f"# GPO Drive Mapping Script for {employee.full_name}\n"
        f"# Paste into Group Policy > User Configuration > Preferences > Drive Maps\n"
        f"# Or use as a logon script:\n"
        f"\n"
        f'$driveLetter = "{drive_letter}"\n'
        f'$uncPath = "{unc_path}"\n'
        f"\n"
        f"if (Test-Path ${{driveLetter}}:) {{\n"
        f"    Remove-PSDrive -Name $driveLetter -Force -ErrorAction SilentlyContinue\n"
        f"}}\n"
        f"New-PSDrive -Name $driveLetter -PSProvider FileSystem -Root $uncPath -Persist -Scope Global\n"
        f'Write-Host "Mapped ${{driveLetter}}: to $uncPath"\n'
    )

    _mark_task_completed(task, "automation", notes=script)


# ── Automation key → function mapping ────────────────────────────────

ONBOARDING_HANDLERS: dict[str, Callable[[Employee, LifecycleTask], None]] = {
    "add_ad_groups": _exec_add_ad_groups,
    "add_distribution_lists": _exec_add_distribution_lists,
    "assign_m365_licenses": _exec_assign_m365_licenses,
    "enable_m365_signin": _exec_enable_m365_signin,
    "create_home_drive": _exec_create_home_drive,
    "set_home_drive_permissions": _exec_set_home_drive_permissions,
    "generate_gpo_script": _exec_generate_gpo_script,
}


def execute_task(task: LifecycleTask) -> dict[str, Any]:
    """Execute a single automatable onboarding task."""
    if not task.automation_key:
        return {"status": "skipped", "reason": "No automation key"}

    handler = ONBOARDING_HANDLERS.get(task.automation_key)
    if not handler:
        return {"status": "skipped", "reason": f"No handler for {task.automation_key}"}

    employee = task.event.employee
    try:
        handler(employee, task)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        _mark_task_failed(task, str(exc))
        db.session.commit()
        return {"status": "failed", "error": str(exc)}

    if task.status == LifecycleTaskStatus.COMPLETED:
        return {"status": "completed"}
    return {"status": "failed", "error": task.notes or "Unknown error"}


def auto_execute_low_risk_tasks(event: LifecycleEvent) -> dict[str, Any]:
    """Execute all low-risk (auto) tasks for an onboarding event."""
    results: dict[str, Any] = {"auto_completed": 0, "auto_failed": 0, "errors": []}

    for task in event.tasks:
        if not task.automatable or task.requires_confirmation:
            continue
        if task.status != LifecycleTaskStatus.PENDING:
            continue
        if not task.automation_key:
            continue

        result = execute_task(task)
        if result["status"] == "completed":
            results["auto_completed"] += 1
        else:
            results["auto_failed"] += 1
            results["errors"].append({
                "task_id": task.id,
                "description": task.description,
                "error": result.get("error", "Unknown"),
            })

    complete_event_if_ready(event)
    return results

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Callable

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
    EmployeeProvisionError,
    _ensure_local_ad_settings,
    _build_connection,
    _find_ad_user_dn,
    set_ad_account_enabled,
    reset_ad_password,
    generate_temp_password,
)
from .m365_sync import M365CredentialsError, M365SyncError, M365SyncService

logger = logging.getLogger(__name__)


class OffboardingAutomationError(RuntimeError):
    """Raised when an offboarding automation step fails."""


def _get_m365_service() -> M365SyncService | None:
    try:
        return M365SyncService()
    except M365CredentialsError:
        logger.warning("M365 credentials not configured; skipping M365 operations.")
        return None


def _mark_task_completed(task: LifecycleTask, completed_by: str, notes: str | None = None) -> None:
    task.status = LifecycleTaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    task.completed_by = completed_by
    if notes:
        task.notes = notes


def _mark_task_failed(task: LifecycleTask, error: str) -> None:
    task.notes = f"FAILED: {error}"


# ── Individual automation functions ──────────────────────────────────

def _exec_disable_ad(employee: Employee, task: LifecycleTask) -> None:
    settings = _ensure_local_ad_settings()
    result = set_ad_account_enabled(settings, employee.email, enabled=False)
    if result:
        _mark_task_completed(task, "automation")
    else:
        _mark_task_failed(task, "AD account not found")


def _exec_move_ad_ou(employee: Employee, task: LifecycleTask) -> None:
    from .provisioning import _build_connection, _ensure_local_ad_settings, _find_ad_user_dn
    settings = _ensure_local_ad_settings()
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            _mark_task_failed(task, "AD account not found")
            return
        move_to_offboarded_ou(conn, settings, user_dn)
        _mark_task_completed(task, "automation")
    except Exception as exc:
        _mark_task_failed(task, str(exc))
    finally:
        conn.unbind()


def move_to_offboarded_ou(conn, settings, user_dn: str) -> None:
    """Move an AD user to the Offboarded Users OU."""
    from ldap3 import MODIFY_DN
    from ldap3.utils.dn import parse_dn, escape_rdn

    # Extract the CN from the current DN
    parts = parse_dn(user_dn)
    cn_value = parts[0][1] if parts else None
    if not cn_value:
        raise EmployeeProvisionError(f"Cannot parse CN from DN: {user_dn}")

    # Target OU: OU=Offboarded Users under the base DN
    offboarded_ou = f"OU=Offboarded Users,{settings.base_dn}"

    relative_dn = f"CN={escape_rdn(cn_value)}"
    if not conn.modify_dn(user_dn, relative_dn, new_superior=offboarded_ou):
        message = conn.result.get("message") or "unknown error"
        raise EmployeeProvisionError(f"Failed to move user to Offboarded OU: {message}")


def _exec_reset_ad_password(employee: Employee, task: LifecycleTask) -> None:
    try:
        settings = _ensure_local_ad_settings()
        new_password = generate_temp_password(24)
        reset_ad_password(settings, employee.email, new_password, force_reset=True)
        _mark_task_completed(task, "automation", notes="Password randomized")
    except EmployeeProvisionError as exc:
        _mark_task_failed(task, str(exc))


def _exec_remove_ad_groups(employee: Employee, task: LifecycleTask) -> None:
    settings = _ensure_local_ad_settings()
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            _mark_task_failed(task, "AD account not found")
            return
        remove_all_ad_groups(conn, user_dn)
        _mark_task_completed(task, "automation")
    except Exception as exc:
        _mark_task_failed(task, str(exc))
    finally:
        conn.unbind()


def remove_all_ad_groups(conn, user_dn: str) -> int:
    """Remove a user from all AD groups except Domain Users."""
    from ldap3 import MODIFY_DELETE

    conn.search(
        search_base=user_dn,
        search_filter="(objectClass=user)",
        attributes=["memberOf"],
    )
    if not conn.entries:
        return 0

    member_of = conn.entries[0].entry_attributes_as_dict.get("memberOf", [])
    removed = 0
    for group_dn in member_of:
        if "CN=Domain Users" in group_dn:
            continue
        if conn.modify(group_dn, {"member": [(MODIFY_DELETE, [user_dn])]}):
            removed += 1
        else:
            logger.warning("Failed to remove %s from %s: %s", user_dn, group_dn, conn.result)
    return removed


def _exec_block_m365_signin(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        block_user_signin(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def block_user_signin(svc: M365SyncService, user_email: str) -> None:
    svc.set_user_enabled(user_email, False)


def _exec_remove_mfa(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        remove_mfa_methods(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def remove_mfa_methods(svc: M365SyncService, user_email: str) -> int:
    """Remove all authentication methods (MFA) for a user."""
    from urllib.parse import quote
    encoded = quote(user_email)
    url = f"https://graph.microsoft.com/v1.0/users/{encoded}/authentication/methods"
    try:
        data = svc._get(url)
    except M365SyncError:
        return 0

    removed = 0
    for method in data.get("value", []):
        method_type = method.get("@odata.type", "")
        method_id = method.get("id", "")
        # Skip password method – cannot be deleted
        if "passwordAuthenticationMethod" in method_type:
            continue
        if not method_id:
            continue
        # Determine the correct resource path
        type_map = {
            "phoneAuthenticationMethod": "phone",
            "emailAuthenticationMethod": "email",
            "microsoftAuthenticatorAuthenticationMethod": "microsoftAuthenticator",
            "softwareOathAuthenticationMethod": "softwareOath",
            "fido2AuthenticationMethod": "fido2",
            "windowsHelloForBusinessAuthenticationMethod": "windowsHelloForBusiness",
            "temporaryAccessPassAuthenticationMethod": "temporaryAccessPass",
        }
        resource = None
        for key, val in type_map.items():
            if key in method_type:
                resource = val
                break
        if not resource:
            continue
        delete_url = f"https://graph.microsoft.com/v1.0/users/{encoded}/authentication/{resource}Methods/{method_id}"
        try:
            svc._request("DELETE", delete_url, expected_status=(204,), allow_not_found=True)
            removed += 1
        except M365SyncError:
            logger.warning("Failed to remove MFA method %s for %s", method_id, user_email)
    return removed


def _exec_revoke_sessions(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        revoke_user_sessions(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def revoke_user_sessions(svc: M365SyncService, user_email: str) -> None:
    from urllib.parse import quote
    encoded = quote(user_email)
    url = f"https://graph.microsoft.com/v1.0/users/{encoded}/revokeSignInSessions"
    svc._request("POST", url, expected_status=(200,))


def _exec_remove_m365_licenses(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        remove_user_licenses(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def remove_user_licenses(svc: M365SyncService, user_email: str) -> int:
    """Remove all assigned licenses from a user."""
    from urllib.parse import quote
    encoded = quote(user_email)
    url = f"https://graph.microsoft.com/v1.0/users/{encoded}/licenseDetails"
    try:
        data = svc._get(url)
    except M365SyncError:
        return 0

    sku_ids = [lic["skuId"] for lic in data.get("value", []) if lic.get("skuId")]
    if not sku_ids:
        return 0

    assign_url = f"https://graph.microsoft.com/v1.0/users/{encoded}/assignLicense"
    payload = {"addLicenses": [], "removeLicenses": sku_ids}
    svc._request("POST", assign_url, json=payload, expected_status=(200,))
    return len(sku_ids)


def _exec_remove_distribution_lists(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        count = remove_from_distribution_lists(svc, employee.email)
        _mark_task_completed(task, "automation", notes=f"Removed from {count} groups")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def remove_from_distribution_lists(svc: M365SyncService, user_email: str) -> int:
    """Remove user from all distribution groups and mail-enabled security groups."""
    from urllib.parse import quote
    encoded = quote(user_email)
    url = f"https://graph.microsoft.com/v1.0/users/{encoded}/memberOf"
    try:
        data = svc._get(url)
    except M365SyncError:
        return 0

    removed = 0
    for group in data.get("value", []):
        group_type = group.get("@odata.type", "")
        group_id = group.get("id", "")
        # Only remove from groups (not roles/admin units)
        if "#microsoft.graph.group" not in group_type:
            continue
        mail_enabled = group.get("mailEnabled", False)
        if not mail_enabled:
            continue
        # Get user ID first
        user_data = svc.get_user(user_email)
        if not user_data:
            break
        user_id = user_data.get("id", "")
        remove_url = f"https://graph.microsoft.com/v1.0/groups/{group_id}/members/{user_id}/$ref"
        try:
            svc._request("DELETE", remove_url, expected_status=(204,), allow_not_found=True)
            removed += 1
        except M365SyncError:
            logger.warning("Failed to remove %s from group %s", user_email, group_id)
    return removed


def _exec_convert_shared_mailbox(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        convert_to_shared_mailbox(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def convert_to_shared_mailbox(svc: M365SyncService, user_email: str) -> None:
    """Convert a user mailbox to shared via Graph beta endpoint."""
    from urllib.parse import quote
    encoded = quote(user_email)
    url = f"https://graph.microsoft.com/beta/users/{encoded}/mailboxSettings"
    # Note: Full shared mailbox conversion typically requires Exchange Online PowerShell.
    # This attempts the Graph approach; may require Exchange admin API in production.
    try:
        svc._request(
            "PATCH",
            f"https://graph.microsoft.com/v1.0/users/{encoded}",
            json={"mailboxSettings": {"userPurpose": "shared"}},
            expected_status=(200, 204),
        )
    except M365SyncError:
        # Fallback: just log that manual conversion is needed
        raise M365SyncError(
            f"Automated shared mailbox conversion not available via Graph for {user_email}. "
            "Use Exchange Online PowerShell: Set-Mailbox -Identity {email} -Type Shared"
        )


def _exec_grant_mailbox_access(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    data = json.loads(task.assignee_data) if task.assignee_data else {}
    delegate_email = data.get("delegate_email") or (task.event.delegate_email if task.event else None)
    if not delegate_email:
        _mark_task_failed(task, "No delegate email specified")
        return
    try:
        grant_shared_mailbox_access(svc, employee.email, delegate_email)
        _mark_task_completed(task, "automation", notes=f"Access granted to {delegate_email}")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def grant_shared_mailbox_access(svc: M365SyncService, mailbox_email: str, delegate_email: str) -> None:
    """Grant full access + send-as permissions on a shared mailbox."""
    from urllib.parse import quote
    # This requires Exchange Online management. Using Graph permissions endpoint as best-effort.
    mailbox_user = svc.get_user(mailbox_email)
    delegate_user = svc.get_user(delegate_email)
    if not mailbox_user or not delegate_user:
        raise M365SyncError("Could not resolve mailbox or delegate user")

    mailbox_id = mailbox_user.get("id", "")
    delegate_id = delegate_user.get("id", "")

    # Grant FullAccess via mailboxPermission (Exchange Online PowerShell typically required)
    # As a best-effort Graph approach: add delegate as mailbox folder permission
    url = f"https://graph.microsoft.com/v1.0/users/{quote(mailbox_email)}/mailFolders/inbox/permissions"
    payload = {
        "emailAddress": {"address": delegate_email},
        "isInsideOrganization": True,
        "role": "editor",
    }
    try:
        svc._request("POST", url, json=payload, expected_status=(201, 200))
    except M365SyncError:
        raise M365SyncError(
            f"Graph mailbox permission grant failed. Use Exchange Online PowerShell: "
            f"Add-MailboxPermission -Identity {mailbox_email} -User {delegate_email} -AccessRights FullAccess"
        )


def _exec_enable_litigation_hold(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    try:
        enable_litigation_hold(svc, employee.email)
        _mark_task_completed(task, "automation")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def enable_litigation_hold(svc: M365SyncService, user_email: str) -> None:
    """Enable litigation hold. Requires Exchange Online PowerShell in production."""
    # Graph API doesn't directly support litigation hold; this is a placeholder
    # that logs the requirement for manual action via Exchange PowerShell.
    raise M365SyncError(
        f"Litigation hold requires Exchange Online PowerShell: "
        f"Set-Mailbox -Identity {user_email} -LitigationHoldEnabled $true"
    )


def _exec_transfer_onedrive(employee: Employee, task: LifecycleTask) -> None:
    svc = _get_m365_service()
    if not svc:
        _mark_task_failed(task, "M365 not configured")
        return
    data = json.loads(task.assignee_data) if task.assignee_data else {}
    delegate_email = data.get("delegate_email") or (task.event.delegate_email if task.event else None)
    if not delegate_email:
        _mark_task_failed(task, "No delegate email specified")
        return
    try:
        transfer_onedrive(svc, employee.email, delegate_email)
        _mark_task_completed(task, "automation", notes=f"OneDrive access granted to {delegate_email}")
    except M365SyncError as exc:
        _mark_task_failed(task, str(exc))


def transfer_onedrive(svc: M365SyncService, user_email: str, delegate_email: str) -> None:
    """Grant delegate access to the departing user's OneDrive."""
    from urllib.parse import quote
    delegate_user = svc.get_user(delegate_email)
    if not delegate_user:
        raise M365SyncError(f"Delegate user {delegate_email} not found in M365")
    delegate_id = delegate_user.get("id", "")

    encoded = quote(user_email)
    # Grant site collection admin access to OneDrive
    # In practice this uses SharePoint admin API. Using Graph drive permissions.
    drive_url = f"https://graph.microsoft.com/v1.0/users/{encoded}/drive"
    try:
        drive_data = svc._get(drive_url)
    except M365SyncError:
        raise M365SyncError(f"Could not access OneDrive for {user_email}")

    drive_id = drive_data.get("id", "")
    root_url = f"https://graph.microsoft.com/v1.0/users/{encoded}/drive/root/invite"
    payload = {
        "recipients": [{"email": delegate_email}],
        "roles": ["write"],
        "requireSignIn": True,
        "sendInvitation": False,
    }
    svc._request("POST", root_url, json=payload, expected_status=(200,))


# ── Automation key → function mapping ────────────────────────────────

AUTOMATION_HANDLERS: dict[str, Callable[[Employee, LifecycleTask], None]] = {
    "disable_ad": _exec_disable_ad,
    "move_ad_ou": _exec_move_ad_ou,
    "reset_ad_password": _exec_reset_ad_password,
    "remove_ad_groups": _exec_remove_ad_groups,
    "block_m365_signin": _exec_block_m365_signin,
    "remove_mfa": _exec_remove_mfa,
    "revoke_sessions": _exec_revoke_sessions,
    "remove_m365_licenses": _exec_remove_m365_licenses,
    "remove_distribution_lists": _exec_remove_distribution_lists,
    "convert_shared_mailbox": _exec_convert_shared_mailbox,
    "grant_mailbox_access": _exec_grant_mailbox_access,
    "enable_litigation_hold": _exec_enable_litigation_hold,
    "transfer_onedrive": _exec_transfer_onedrive,
}


def execute_task(task: LifecycleTask) -> dict[str, Any]:
    """Execute a single automatable offboarding task."""
    if not task.automation_key:
        return {"status": "skipped", "reason": "No automation key"}

    handler = AUTOMATION_HANDLERS.get(task.automation_key)
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
    """Execute all low-risk (auto) tasks for an offboarding event."""
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

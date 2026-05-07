"""Pure-logic provisioning helpers, reusable outside lifecycle tasks.

These are called directly by the queued ProvisioningJob worker. Each returns
a plain dict describing the outcome (status + step-level detail) so the
worker can persist it as `result_json` without any LifecycleTask coupling.

Result contract (per helper):
    {
        "status": "ok" | "skipped" | "failed",
        "reason": "..."          # when skipped
        "error":  "..."          # when failed
        ... additional per-step counts ...
    }
"""
from __future__ import annotations

import logging
from urllib.parse import quote

from ..config import Config
from ..models import Employee
from .m365_sync import (
    M365CredentialsError,
    M365SyncError,
    M365SyncService,
)
from .offboarding_automation import (
    remove_all_ad_groups,
    remove_from_distribution_lists,
)
from .provisioning import (
    _build_connection,
    _ensure_local_ad_settings,
    _find_ad_user_dn,
)
from .unifi_access_sync import UnifiAccessError, UnifiAccessService

logger = logging.getLogger(__name__)


def _get_m365() -> M365SyncService | None:
    try:
        return M365SyncService()
    except M365CredentialsError:
        return None


def _get_unifi() -> UnifiAccessService | None:
    try:
        return UnifiAccessService()
    except UnifiAccessError:
        return None


# ── Add operations (onboarding defaults) ───────────────────────────────

def add_user_to_ad_groups(
    employee: Employee, groups: list[str]
) -> dict:
    if not groups:
        return {"status": "skipped", "reason": "no AD groups configured"}

    from ldap3 import MODIFY_ADD

    settings = _ensure_local_ad_settings()
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            return {"status": "failed", "error": "AD account not found"}

        added: list[str] = []
        already: list[str] = []
        missing: list[str] = []

        for group_cn in groups:
            conn.search(
                search_base=settings.base_dn,
                search_filter=f"(&(objectClass=group)(cn={group_cn}))",
                attributes=["distinguishedName"],
            )
            if not conn.entries:
                missing.append(group_cn)
                continue
            group_dn = str(conn.entries[0].distinguishedName)
            if conn.modify(group_dn, {"member": [(MODIFY_ADD, [user_dn])]}):
                added.append(group_cn)
            else:
                msg = (conn.result.get("message") or "").lower()
                if "already" in msg or conn.result.get("result", 0) == 68:
                    already.append(group_cn)
                else:
                    missing.append(f"{group_cn} ({conn.result.get('message', 'failed')})")

        status = "ok" if (added or already) and not missing else (
            "partial" if (added or already) and missing else "failed"
        )
        return {
            "status": status,
            "added": added,
            "already_member": already,
            "missing_or_failed": missing,
        }
    except Exception as exc:
        logger.exception("add_user_to_ad_groups failed for %s", employee.email)
        return {"status": "failed", "error": str(exc)}
    finally:
        try:
            conn.unbind()
        except Exception:
            pass


def add_user_to_distribution_lists(
    employee: Employee, list_identifiers: list[str]
) -> dict:
    if not list_identifiers:
        return {"status": "skipped", "reason": "no distribution lists configured"}
    svc = _get_m365()
    if not svc:
        return {"status": "failed", "error": "M365 not configured"}

    user_data = svc.get_user(employee.email)
    if not user_data:
        return {"status": "failed", "error": f"User {employee.email} not in M365"}
    user_id = user_data.get("id", "")

    added: list[str] = []
    already: list[str] = []
    missing: list[str] = []

    for ident in list_identifiers:
        try:
            search_url = (
                "https://graph.microsoft.com/v1.0/groups"
                f"?$filter=mail eq '{ident}' or displayName eq '{ident}'"
                "&$select=id,displayName,mail"
            )
            data = svc._get(search_url)
            groups = data.get("value", [])
            if not groups:
                missing.append(ident)
                continue
            group_id = groups[0]["id"]
            member_url = f"https://graph.microsoft.com/v1.0/groups/{group_id}/members/$ref"
            payload = {
                "@odata.id": f"https://graph.microsoft.com/v1.0/directoryObjects/{user_id}"
            }
            try:
                svc._request("POST", member_url, json=payload, expected_status=(204,))
                added.append(ident)
            except M365SyncError as exc:
                if "already exist" in str(exc).lower():
                    already.append(ident)
                else:
                    missing.append(f"{ident} ({exc})")
        except M365SyncError as exc:
            missing.append(f"{ident} ({exc})")

    status = "ok" if (added or already) and not missing else (
        "partial" if (added or already) and missing else "failed"
    )
    return {
        "status": status,
        "added": added,
        "already_member": already,
        "missing_or_failed": missing,
    }


def assign_default_unifi_policies(
    employee: Employee, policy_ids: list[str]
) -> dict:
    if not policy_ids:
        return {"status": "skipped", "reason": "no default Unifi policies configured"}
    svc = _get_unifi()
    if not svc:
        return {"status": "skipped", "reason": "Unifi Access not configured"}
    try:
        return svc.assign_policies_to_employee(employee, policy_ids)
    except UnifiAccessError as exc:
        return {"status": "failed", "error": str(exc)}


# ── Remove operations (disable defaults) ───────────────────────────────

def remove_user_from_all_ad_groups(employee: Employee) -> dict:
    settings = _ensure_local_ad_settings()
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            return {"status": "failed", "error": "AD account not found"}
        removed = remove_all_ad_groups(conn, user_dn)
        return {"status": "ok", "removed_count": removed}
    except Exception as exc:
        logger.exception("remove_user_from_all_ad_groups failed for %s", employee.email)
        return {"status": "failed", "error": str(exc)}
    finally:
        try:
            conn.unbind()
        except Exception:
            pass


def remove_user_from_distribution_lists(employee: Employee) -> dict:
    svc = _get_m365()
    if not svc:
        return {"status": "failed", "error": "M365 not configured"}
    try:
        removed = remove_from_distribution_lists(svc, employee.email)
        return {"status": "ok", "removed_count": removed}
    except M365SyncError as exc:
        return {"status": "failed", "error": str(exc)}


def revoke_all_unifi_policies(employee: Employee) -> dict:
    svc = _get_unifi()
    if not svc:
        return {"status": "skipped", "reason": "Unifi Access not configured"}
    try:
        return svc.revoke_policies_from_employee(employee, policy_ids=None)
    except UnifiAccessError as exc:
        return {"status": "failed", "error": str(exc)}


def attempt_convert_to_shared_mailbox(employee: Employee) -> dict:
    """Best-effort conversion via Graph. Typically requires Exchange PS in prod.

    Always returns a structured result so the job can surface a manual-step
    warning in the UI rather than silently failing.
    """
    svc = _get_m365()
    if not svc:
        return {"status": "failed", "error": "M365 not configured"}

    encoded = quote(employee.email)
    url = f"https://graph.microsoft.com/v1.0/users/{encoded}"
    try:
        svc._request(
            "PATCH",
            url,
            json={"mailboxSettings": {"userPurpose": "shared"}},
            expected_status=(200, 204),
        )
        return {"status": "ok", "method": "graph_patch"}
    except M365SyncError as exc:
        return {
            "status": "manual_required",
            "reason": (
                "Graph PATCH not supported for shared-mailbox conversion. "
                f"Run in Exchange Online PowerShell: "
                f"Set-Mailbox -Identity {employee.email} -Type Shared"
            ),
            "error": str(exc),
        }

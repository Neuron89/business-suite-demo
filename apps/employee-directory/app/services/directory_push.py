"""Push employee profile changes back to Microsoft Graph and on-prem AD.

Scope: profile fields only. This module DOES NOT touch any identity or mail
routing attributes:
    - mail / proxyAddresses / userPrincipalName
    - displayName / mailNickname / givenName / surname
    - mailbox recipientType, distribution groups, licenses

Pushable fields (all optional, per-employee):
    title, department, start_date, manager_email, mobile_phone, phone,
    office_location, account_type
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any
from urllib.parse import quote

from flask import current_app
from ldap3 import Connection, NTLM, Server, Tls, MODIFY_REPLACE, SUBTREE  # type: ignore[import]

from ..config import Config
from ..models import Employee
from .m365_sync import (
    GRAPH_BASE_URL,
    M365SyncService,
    graph_config_for_email,
)


# Fields we are willing to sync. Order matters for user-facing logs.
PUSHABLE_FIELDS: tuple[str, ...] = (
    "title",
    "department",
    "start_date",
    "manager_email",
    "mobile_phone",
    "phone",
    "office_location",
    "account_type",
)


@dataclass(slots=True)
class PushResult:
    target: str  # "m365" or "local_ad"
    applied: dict[str, Any] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "applied": self.applied,
            "skipped": self.skipped,
            "error": self.error,
        }


def _ad_config_for_employee(employee: Employee):
    """Pick the Local AD config that matches the employee's company."""
    configs = Config.get_ad_configs()
    if not configs:
        return None
    # Prefer the employee's company name
    from ..models import Company

    company_name = None
    if employee.company_id:
        company = Company.query.get(employee.company_id)
        company_name = company.name if company else None

    if company_name and company_name in configs:
        return configs[company_name]
    # Fallback by email domain
    domain = (
        employee.email.rsplit("@", 1)[-1].lower()
        if "@" in (employee.email or "")
        else ""
    )
    if "acme" in domain and "Acme" in configs:
        return configs["Acme"]
    if "plant_a" in domain and "Plant A" in configs:
        return configs["Plant A"]
    return None


# --- Microsoft 365 / Graph -------------------------------------------------


def _graph_patch_payload(employee: Employee, fields: list[str]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for name in fields:
        value = getattr(employee, name, None)
        if name == "title":
            payload["jobTitle"] = value or None
        elif name == "department":
            payload["department"] = value or None
        elif name == "start_date":
            if isinstance(value, date):
                payload["employeeHireDate"] = f"{value.isoformat()}T00:00:00Z"
            elif value is None:
                payload["employeeHireDate"] = None
        elif name == "mobile_phone":
            payload["mobilePhone"] = value or None
        elif name == "phone":
            # businessPhones is a list; empty list clears it
            payload["businessPhones"] = [value] if value else []
        elif name == "office_location":
            payload["officeLocation"] = value or None
        elif name == "account_type":
            payload["employeeType"] = value or None
        # manager is handled separately via $ref endpoint
    return payload


def push_to_m365(
    employee: Employee,
    fields: list[str],
    *,
    dry_run: bool = False,
) -> PushResult:
    result = PushResult(target="m365")
    fields = [f for f in fields if f in PUSHABLE_FIELDS]
    if not fields:
        return result

    cfg = graph_config_for_email(employee.email)
    if not cfg or not cfg.tenant_id:
        result.error = "No Graph config for this employee's tenant"
        for f in fields:
            result.skipped[f] = "no tenant config"
        return result

    try:
        service = M365SyncService(graph_config=cfg, company_id=employee.company_id)
    except Exception as exc:  # credentials missing
        result.error = str(exc)
        for f in fields:
            result.skipped[f] = "credentials error"
        return result

    manager_field = "manager_email" in fields
    profile_fields = [f for f in fields if f != "manager_email"]
    payload = _graph_patch_payload(employee, profile_fields)

    encoded_upn = quote(employee.email)

    # 1. PATCH the user object for scalar profile fields
    if payload:
        if dry_run:
            result.applied.update(payload)
        else:
            try:
                service._request(
                    "PATCH",
                    f"{GRAPH_BASE_URL}/users/{encoded_upn}",
                    json=payload,
                    expected_status=(204,),
                )
                result.applied.update(payload)
            except Exception as exc:
                result.error = f"PATCH failed: {exc}"
                for name in profile_fields:
                    result.skipped[name] = "patch error"
                return result

    # 2. Handle manager separately via $ref
    if manager_field:
        manager_email = employee.manager_email
        if not manager_email:
            # Clear manager reference
            if dry_run:
                result.applied["manager"] = None
            else:
                try:
                    service._request(
                        "DELETE",
                        f"{GRAPH_BASE_URL}/users/{encoded_upn}/manager/$ref",
                        expected_status=(204,),
                        allow_not_found=True,
                    )
                    result.applied["manager"] = None
                except Exception as exc:
                    result.skipped["manager_email"] = f"clear failed: {exc}"
        else:
            # Resolve manager user id, then PUT $ref
            try:
                mgr = service.get_user(manager_email)
            except Exception as exc:
                mgr = None
                result.skipped["manager_email"] = f"lookup failed: {exc}"
                mgr = None
            if mgr and mgr.get("id"):
                if dry_run:
                    result.applied["manager"] = manager_email
                else:
                    try:
                        service._request(
                            "PUT",
                            f"{GRAPH_BASE_URL}/users/{encoded_upn}/manager/$ref",
                            json={
                                "@odata.id": (
                                    f"{GRAPH_BASE_URL}/users/{mgr['id']}"
                                )
                            },
                            expected_status=(204,),
                        )
                        result.applied["manager"] = manager_email
                    except Exception as exc:
                        result.skipped["manager_email"] = f"set failed: {exc}"
            elif "manager_email" not in result.skipped:
                result.skipped["manager_email"] = "manager not found in tenant"

    return result


# --- Local AD --------------------------------------------------------------


_AD_ATTR_MAP: dict[str, str] = {
    "title": "title",
    "department": "department",
    "mobile_phone": "mobile",
    "phone": "telephoneNumber",
    "office_location": "physicalDeliveryOfficeName",
    "account_type": "employeeType",
}


def _ad_build_connection(ad_config, for_write: bool) -> Connection:
    user = (ad_config.provision_user or ad_config.user) if for_write else ad_config.user
    password = (
        ad_config.provision_password or ad_config.password
    ) if for_write else ad_config.password
    tls = Tls() if ad_config.ssl else None
    server = Server(ad_config.server, use_ssl=ad_config.ssl, tls=tls, get_info="NONE")
    auth = (ad_config.auth or "SIMPLE").upper()
    if auth == "NTLM":
        return Connection(
            server, user=user, password=password, authentication=NTLM, auto_bind=True
        )
    return Connection(server, user=user, password=password, auto_bind=True)


def _ad_find_dn(conn: Connection, base_dn: str, email: str) -> str | None:
    filt = f"(&(objectClass=user)(|(mail={email})(userPrincipalName={email})))"
    conn.search(
        search_base=base_dn,
        search_filter=filt,
        search_scope=SUBTREE,
        attributes=["distinguishedName"],
        size_limit=1,
    )
    if not conn.entries:
        return None
    return conn.entries[0].entry_dn


def push_to_local_ad(
    employee: Employee,
    fields: list[str],
    *,
    dry_run: bool = False,
) -> PushResult:
    result = PushResult(target="local_ad")
    fields = [f for f in fields if f in PUSHABLE_FIELDS]
    if not fields:
        return result

    ad_config = _ad_config_for_employee(employee)
    if not ad_config or not ad_config.server:
        result.error = "No Local AD config for this employee"
        for f in fields:
            result.skipped[f] = "no AD config"
        return result

    try:
        conn = _ad_build_connection(ad_config, for_write=True)
    except Exception as exc:
        result.error = f"LDAP bind failed: {exc}"
        for f in fields:
            result.skipped[f] = "bind error"
        return result

    try:
        user_dn = _ad_find_dn(conn, ad_config.base_dn, employee.email)
        if not user_dn:
            result.error = "User not found in AD"
            for f in fields:
                result.skipped[f] = "user dn not found"
            return result

        changes: dict[str, list] = {}
        for name in fields:
            if name == "manager_email":
                continue  # handled below
            if name == "start_date":
                value = employee.start_date
                iso = value.isoformat() if isinstance(value, date) else None
                changes["extensionAttribute1"] = [(MODIFY_REPLACE, [iso] if iso else [])]
                continue
            ad_attr = _AD_ATTR_MAP.get(name)
            if not ad_attr:
                continue
            value = getattr(employee, name, None)
            changes[ad_attr] = [(MODIFY_REPLACE, [value] if value else [])]

        # manager → DN lookup
        if "manager_email" in fields:
            if employee.manager_email:
                mgr_dn = _ad_find_dn(conn, ad_config.base_dn, employee.manager_email)
                if mgr_dn:
                    changes["manager"] = [(MODIFY_REPLACE, [mgr_dn])]
                else:
                    result.skipped["manager_email"] = "manager dn not found"
            else:
                changes["manager"] = [(MODIFY_REPLACE, [])]

        if not changes:
            return result

        if dry_run:
            for ad_attr, ops in changes.items():
                result.applied[ad_attr] = ops[0][1]
            return result

        if not conn.modify(user_dn, changes):
            result.error = f"LDAP modify failed: {conn.result}"
            for f in fields:
                if f not in result.skipped:
                    result.skipped[f] = "modify error"
            return result

        for ad_attr, ops in changes.items():
            result.applied[ad_attr] = ops[0][1]
        return result
    finally:
        try:
            conn.unbind()
        except Exception:
            pass


# --- Orchestration ---------------------------------------------------------


def push_employee_profile(
    employee: Employee,
    fields: list[str],
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Push to both M365 and local AD; return combined result dict."""
    m365_result = push_to_m365(employee, fields, dry_run=dry_run)
    ad_result = push_to_local_ad(employee, fields, dry_run=dry_run)
    current_app.logger.info(
        "directory_push employee=%s fields=%s m365=%s ad=%s",
        employee.email,
        fields,
        m365_result.as_dict(),
        ad_result.as_dict(),
    )
    return {
        "m365": m365_result.as_dict(),
        "local_ad": ad_result.as_dict(),
    }

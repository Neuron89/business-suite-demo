"""Lightweight SCADA AD presence sync.

The SCADA domain is only used for access control to the SCADA system — we do
not replicate SCADA users into the employee table. Instead, for each existing
employee we simply flip `has_scada_account` based on whether a matching user
exists in SCADA AD, keyed by displayName / cn.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from flask import current_app
from ldap3 import Connection, NTLM, SIMPLE, Server, Tls

from ..config import Config
from ..database import db
from ..models import Employee


class ScadaPresenceError(RuntimeError):
    pass


def _build_connection() -> Connection:
    cfg = Config.SCADA_AD
    if not cfg.server:
        raise ScadaPresenceError("SCADA_AD is not configured.")
    tls = Tls() if cfg.ssl else None
    server = Server(cfg.server, use_ssl=cfg.ssl, tls=tls, get_info="NONE")
    auth_type = (cfg.auth or "SIMPLE").upper()
    bind_user = cfg.provision_user or cfg.user
    bind_password = cfg.provision_password or cfg.password
    if auth_type == "NTLM":
        return Connection(server, user=bind_user, password=bind_password,
                          authentication=NTLM, auto_bind=True)
    return Connection(server, user=bind_user, password=bind_password,
                      authentication=SIMPLE, auto_bind=True)


def _escape(value: str) -> str:
    return (value.replace("\\", "\\5c")
                 .replace("*", "\\2a")
                 .replace("(", "\\28")
                 .replace(")", "\\29"))


def _collect_scada_names(conn: Connection) -> set[str]:
    """Return the lowercase set of every enabled SCADA user's displayName/cn."""
    cfg = Config.SCADA_AD
    conn.search(
        search_base=cfg.base_dn,
        search_filter="(&(objectClass=user)(objectCategory=person))",
        attributes=["displayName", "cn", "sAMAccountName", "userAccountControl"],
    )
    names: set[str] = set()
    for entry in conn.entries:
        try:
            uac = int(entry.userAccountControl.value or 0)
        except Exception:
            uac = 0
        if uac & 0x0002:  # ACCOUNTDISABLE
            continue
        for attr in ("displayName", "cn", "sAMAccountName"):
            val = getattr(entry, attr, None)
            if val and val.value:
                names.add(str(val.value).strip().lower())
    return names


def check_scada_presence(employee: Employee) -> bool:
    """Return True if this employee has a SCADA AD account.

    Builds a short-lived LDAP connection, looks up by displayName / cn /
    sAMAccountName candidates, and updates employee.has_scada_account +
    scada_checked_at. Does not commit.
    """
    try:
        conn = _build_connection()
    except Exception as exc:
        raise ScadaPresenceError(f"Failed to bind to SCADA AD: {exc}") from exc

    try:
        scada_names = _collect_scada_names(conn)
    finally:
        conn.unbind()

    candidates = {
        (employee.full_name or "").strip().lower(),
        (employee.email.split("@", 1)[0] if employee.email else "").lower(),
    }
    if employee.preferred_name:
        candidates.add(
            f"{employee.preferred_name} {employee.last_name}".strip().lower()
        )
    has_account = bool(candidates & scada_names)
    employee.has_scada_account = has_account
    employee.scada_checked_at = datetime.utcnow()
    return has_account


def sync_scada_presence() -> dict[str, Any]:
    """Flip has_scada_account on every employee based on SCADA AD membership."""
    try:
        conn = _build_connection()
    except Exception as exc:
        raise ScadaPresenceError(f"Failed to bind to SCADA AD: {exc}") from exc

    try:
        scada_names = _collect_scada_names(conn)
    finally:
        conn.unbind()

    employees = Employee.query.all()
    now = datetime.utcnow()
    match_count = 0
    for emp in employees:
        candidates = {
            (emp.full_name or "").strip().lower(),
            (emp.email.split("@", 1)[0] if emp.email else "").lower(),
        }
        if emp.preferred_name:
            candidates.add(f"{emp.preferred_name} {emp.last_name}".strip().lower())
        has_account = bool(candidates & scada_names)
        emp.has_scada_account = has_account
        emp.scada_checked_at = now
        if has_account:
            match_count += 1
    db.session.commit()
    current_app.logger.info(
        "SCADA presence sync: %s SCADA users, %s/%s employees matched",
        len(scada_names), match_count, len(employees),
    )
    return {
        "scada_users": len(scada_names),
        "employees_with_account": match_count,
        "employees_total": len(employees),
    }

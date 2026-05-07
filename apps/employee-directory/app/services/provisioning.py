from __future__ import annotations

import re
import secrets
import string
from dataclasses import dataclass
from typing import Any, Optional

from flask import current_app
from sqlalchemy.exc import IntegrityError
from ldap3 import Connection, NTLM, Server, Tls, MODIFY_REPLACE
from ldap3.core.exceptions import LDAPExceptionError
from ldap3.utils.dn import escape_rdn

from ..database import db
from datetime import date

from ..models import Employee, EmployeeStatus
from .m365_sync import (
    M365CredentialsError,
    M365SyncError,
    M365SyncService,
    graph_config_for_email,
)


class EmployeeProvisionError(RuntimeError):
    """Raised when provisioning to AD or Microsoft 365 fails."""


@dataclass(slots=True)
class EmployeeProvisionPayload:
    first_name: str
    last_name: str
    email: str
    password: Optional[str]
    preferred_name: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    employee_number: Optional[str] = None
    start_date: Optional[date] = None
    termination_date: Optional[date] = None
    birthday: Optional[date] = None
    manager_email: Optional[str] = None
    notes: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    force_password_reset: bool = True
    sam_account_name: Optional[str] = None
    account_type: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    extension: Optional[str] = None
    office_location: Optional[str] = None


@dataclass(slots=True)
class LocalADSettings:
    server: str
    base_dn: str
    user: str
    password: str
    provision_user: Optional[str]
    provision_password: Optional[str]
    use_ssl: bool
    auth_type: str
    staff_ou: Optional[str]
    match_by: str = "EMAIL"
    label: str = "Local AD"


def _ad_config_for_email(email: str | None):
    """Pick the AD config that owns this email's domain.

    Mirrors `graph_config_for_email`: @acme.* → ACME_AD, else LOCAL_AD.
    """
    from ..config import Config

    if email and "@" in email:
        domain = email.rsplit("@", 1)[-1].lower()
        if (
            domain.endswith("acme.com")
            or domain.endswith("acme.onmicrosoft.com")
            or domain.endswith("acme.net")
        ):
            if Config.ACME_AD.server:
                return Config.ACME_AD, "Acme"
    return Config.LOCAL_AD, "Local AD"


def _ensure_local_ad_settings(email: str | None = None) -> LocalADSettings:
    config, label = _ad_config_for_email(email)
    if not config or not getattr(config, "server", None):
        # Fall back to the legacy app-config LOCAL_AD when nothing matched.
        config = current_app.config.get("LOCAL_AD")
        label = "Local AD"
    if not config:
        raise EmployeeProvisionError("Local AD configuration is missing.")

    for field in ("server", "base_dn", "user", "password"):
        if not getattr(config, field, None):
            raise EmployeeProvisionError(
                f"Local AD setting {field.upper()} is not configured."
            )

    auth_type = str(getattr(config, "auth", "SIMPLE")).upper()
    if auth_type not in {"SIMPLE", "NTLM"}:
        raise EmployeeProvisionError(
            f"Unsupported LOCAL_AD_AUTH value '{auth_type}'. Expected SIMPLE or NTLM."
        )

    return LocalADSettings(
        server=config.server,
        base_dn=config.base_dn,
        user=config.user,
        password=config.password,
        provision_user=getattr(config, "provision_user", None),
        provision_password=getattr(config, "provision_password", None),
        use_ssl=bool(getattr(config, "ssl", False)),
        auth_type=auth_type,
        staff_ou=getattr(config, "staff_ou", None),
        match_by=str(getattr(config, "match_by", "EMAIL") or "EMAIL").upper(),
        label=label,
    )


def _settings_from_config(label: str, config) -> LocalADSettings:
    """Convert any LocalADConfig (Acme / SCADA / etc.) into LocalADSettings."""
    auth_type = str(getattr(config, "auth", "SIMPLE") or "SIMPLE").upper()
    return LocalADSettings(
        server=config.server,
        base_dn=config.base_dn,
        user=config.user,
        password=config.password,
        provision_user=getattr(config, "provision_user", None),
        provision_password=getattr(config, "provision_password", None),
        use_ssl=bool(getattr(config, "ssl", False)),
        auth_type=auth_type,
        staff_ou=getattr(config, "staff_ou", None),
        match_by=str(getattr(config, "match_by", "EMAIL") or "EMAIL").upper(),
        label=label,
    )


def _build_connection(settings: LocalADSettings) -> Connection:
    tls = Tls() if settings.use_ssl else None
    server = Server(settings.server, use_ssl=settings.use_ssl, tls=tls, get_info="NONE")
    try:
        if settings.auth_type == "NTLM":
            bind_user = settings.provision_user or settings.user
            bind_password = settings.provision_password or settings.password
            if not bind_user or "\\" not in bind_user:
                raise EmployeeProvisionError(
                    f"NTLM bind requires DOMAIN\\username, got {bind_user!r}"
                )
            if not bind_password:
                raise EmployeeProvisionError(
                    "NTLM bind requires a non-empty password."
                )
            return Connection(
                server,
                user=bind_user,
                password=bind_password,
                authentication=NTLM,
                auto_bind=True,
            )
        bind_user = settings.provision_user or settings.user
        bind_password = settings.provision_password or settings.password
        if not bind_user:
            raise EmployeeProvisionError("LDAP bind requires a bind username.")
        if not bind_password:
            raise EmployeeProvisionError("LDAP bind requires a bind password.")
        return Connection(
            server,
            user=bind_user,
            password=bind_password,
            auto_bind=True,
        )
    except LDAPExceptionError as exc:
        raise EmployeeProvisionError(f"Failed to bind to Active Directory: {exc}") from exc


def _build_staff_container(base_dn: str, staff_ou: Optional[str]) -> str:
    if not staff_ou:
        return base_dn
    staff_ou = staff_ou.strip()
    if not staff_ou:
        return base_dn
    if staff_ou.lower().endswith(base_dn.lower()):
        return staff_ou
    return f"{staff_ou},{base_dn}"


def _sanitize_sam_account_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "", value)
    return cleaned[:20] or cleaned


def _derive_sam_account_name(payload: EmployeeProvisionPayload) -> str:
    if payload.sam_account_name:
        return _sanitize_sam_account_name(payload.sam_account_name)
    if "@" in payload.email:
        prefix = payload.email.split("@", 1)[0]
        sanitized = _sanitize_sam_account_name(prefix)
        if sanitized:
            return sanitized
    fallback = f"{payload.first_name[:1]}{payload.last_name}".lower()
    sanitized = _sanitize_sam_account_name(fallback)
    if sanitized:
        return sanitized
    raise EmployeeProvisionError("Unable to derive a valid sAMAccountName.")


def _ad_entry_exists(conn: Connection, base_dn: str, attribute: str, value: str) -> bool:
    search_filter = f"(&(objectClass=user)({attribute}={value}))"
    conn.search(
        search_base=base_dn,
        search_filter=search_filter,
        attributes=["distinguishedName"],
        size_limit=1,
    )
    return bool(conn.entries)


def _generate_unique_cn(conn: Connection, container_dn: str, base_name: str) -> str:
    candidate = base_name
    counter = 1
    while True:
        escaped = escape_rdn(candidate)
        search_filter = f"(&(objectClass=user)(cn={escaped}))"
        conn.search(
            search_base=container_dn,
            search_filter=search_filter,
            attributes=["cn"],
            size_limit=1,
        )
        if not conn.entries:
            return candidate
        counter += 1
        candidate = f"{base_name} {counter}"


def _generate_temp_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%&*?"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_temp_password(length: int = 16) -> str:
    return _generate_temp_password(length)


_FRIENDLY_ADJECTIVES = (
    "Cool", "Brave", "Fast", "Wild", "Bold", "Quick", "Smart", "Loud",
    "Dark", "Bright", "Calm", "Wise", "Lucky", "Happy", "Sharp", "Mighty",
    "Silent", "Proud", "Fierce", "Royal", "Noble", "Swift", "Sunny", "Frosty",
    "Clever", "Eager", "Jolly", "Kind", "Merry", "Witty", "Zany", "Cosmic",
)
_FRIENDLY_NOUNS = (
    "Cat", "Dog", "Fox", "Bear", "Lion", "Wolf", "Hawk", "Tiger",
    "Eagle", "Shark", "Owl", "Bat", "Crab", "Star", "Moon", "Comet",
    "Falcon", "Otter", "Lynx", "Panda", "Raven", "Whale", "Dragon", "Phoenix",
    "Wizard", "Knight", "Ranger", "Pilot", "Rocket", "River", "Storm", "Forest",
)
_LEET_VOWELS = {"a": "@", "e": "3", "i": "1", "o": "0"}


def _leet(word: str) -> str:
    return "".join(_LEET_VOWELS.get(c.lower(), c) for c in word)


def generate_friendly_password() -> str:
    """Generate a memorable temp password like 'C00l#Cat'.

    Adjective with vowels leet-substituted (a→@, e→3, i→1, o→0), then '#',
    then a capitalized noun. Always satisfies upper/lower/digit/symbol
    complexity rules and is at least 8 characters.
    """
    adj = secrets.choice(_FRIENDLY_ADJECTIVES)
    noun = secrets.choice(_FRIENDLY_NOUNS)
    return f"{_leet(adj)}#{noun}"


def _string_values(value: str | None) -> list[str]:
    if value is None:
        return []
    trimmed = value.strip()
    if not trimmed:
        return []
    return [trimmed]


def update_directory_identity(
    employee: Employee, changes: dict[str, Any]
) -> dict[str, Any]:
    settings = _ensure_local_ad_settings(employee.email)
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, employee.email)
        if not user_dn:
            raise EmployeeProvisionError(
                f"Unable to locate Active Directory account for {employee.email}."
            )

        modifications: dict[str, list[tuple[int, list[str]]]] = {}
        updated_attrs: list[str] = []

        current_first = employee.first_name
        current_last = employee.last_name

        if "first_name" in changes:
            new_first = changes["first_name"]
            if not new_first or not str(new_first).strip():
                raise EmployeeProvisionError("First name cannot be blank.")
            current_first = str(new_first).strip()
            modifications["givenName"] = [(MODIFY_REPLACE, [current_first])]
            updated_attrs.append("givenName")

        if "last_name" in changes:
            new_last = changes["last_name"]
            if not new_last or not str(new_last).strip():
                raise EmployeeProvisionError("Last name cannot be blank.")
            current_last = str(new_last).strip()
            modifications["sn"] = [(MODIFY_REPLACE, [current_last])]
            updated_attrs.append("sn")

        preferred_name = changes.get(
            "preferred_name", employee.preferred_name
        )
        if any(key in changes for key in ("first_name", "last_name", "preferred_name")):
            display_value = (
                str(preferred_name).strip()
                if preferred_name
                else f"{current_first} {current_last}".strip()
            )
            if display_value:
                modifications["displayName"] = [
                    (MODIFY_REPLACE, [display_value])
                ]
                updated_attrs.append("displayName")

        if "department" in changes:
            modifications["department"] = [
                (MODIFY_REPLACE, _string_values(changes["department"]))
            ]
            updated_attrs.append("department")

        if "title" in changes:
            modifications["title"] = [
                (MODIFY_REPLACE, _string_values(changes["title"]))
            ]
            updated_attrs.append("title")

        if "employee_number" in changes:
            modifications["employeeID"] = [
                (MODIFY_REPLACE, _string_values(changes["employee_number"]))
            ]
            updated_attrs.append("employeeID")

        if not updated_attrs:
            return {"user_dn": user_dn, "updated_attributes": []}

        if not conn.modify(user_dn, modifications):
            message = conn.result.get("message") or "unknown error"
            raise EmployeeProvisionError(
                f"Failed to update Active Directory profile: {message}"
            )

        return {"user_dn": user_dn, "updated_attributes": updated_attrs}
    finally:
        conn.unbind()


def reset_ad_password(
    settings: LocalADSettings,
    email: str,
    new_password: str,
    *,
    force_reset: bool = True,
) -> dict[str, Any]:
    if not settings.use_ssl:
        raise EmployeeProvisionError(
            "Password resets require LOCAL_AD_SSL to be enabled for LDAPS."
        )
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, email)
        if not user_dn:
            raise EmployeeProvisionError(
                f"Unable to locate Active Directory account for {email}."
            )
        if not conn.extend.microsoft.modify_password(user_dn, new_password):
            message = conn.result.get("message") or "unknown error"
            raise EmployeeProvisionError(
                f"Failed to reset Active Directory password: {message}"
            )
        pwd_last_set_applied: bool | None = None
        if force_reset:
            if conn.modify(
                user_dn,
                {
                    "pwdLastSet": [
                        (MODIFY_REPLACE, [0]),
                    ]
                },
            ):
                pwd_last_set_applied = True
            else:
                current_app.logger.warning(
                    "Unable to set pwdLastSet to force password reset for %s: %s",
                    user_dn,
                    conn.result,
                )
                pwd_last_set_applied = False
        return {
            "user_dn": user_dn,
            "updated": True,
            "force_reset_applied": pwd_last_set_applied,
        }
    finally:
        conn.unbind()


def _create_ad_user(
    conn: Connection,
    settings: LocalADSettings,
    payload: EmployeeProvisionPayload,
) -> tuple[str, str, bool]:
    container_dn = _build_staff_container(settings.base_dn, settings.staff_ou)
    sam_account_name = _derive_sam_account_name(payload)

    # Ensure no existing account conflicts.
    for attribute, value in (
        ("mail", payload.email),
        ("userPrincipalName", payload.email),
        ("sAMAccountName", sam_account_name),
    ):
        if _ad_entry_exists(conn, settings.base_dn, attribute, value):
            raise EmployeeProvisionError(
                f"An Active Directory account already uses {attribute}={value}."
            )

    display_name = f"{payload.first_name} {payload.last_name}".strip()
    common_name = _generate_unique_cn(conn, container_dn, display_name)
    user_dn = f"CN={escape_rdn(common_name)},{container_dn}"

    attributes: dict[str, Any] = {
        "givenName": payload.first_name,
        "sn": payload.last_name,
        "displayName": display_name,
        "userPrincipalName": payload.email,
        "sAMAccountName": sam_account_name,
        "mail": payload.email,
    }
    if payload.department:
        attributes["department"] = payload.department
    if payload.title:
        attributes["title"] = payload.title
    if payload.employee_number:
        attributes["employeeID"] = payload.employee_number

    if not conn.add(
        user_dn,
        ["top", "person", "organizationalPerson", "user"],
        attributes,
    ):
        raise EmployeeProvisionError(
            f"Failed to create Active Directory user: {conn.result.get('message')}"
        )

    password_set = False
    control_changes: dict[str, Any] = {}
    password_value = (payload.password or "").strip()

    if password_value and settings.use_ssl:
        if not conn.extend.microsoft.modify_password(user_dn, password_value):
            raise EmployeeProvisionError(
                f"Failed to set initial password: {conn.result.get('message')}"
            )
        password_set = True
        control_changes["userAccountControl"] = [
            (MODIFY_REPLACE, [512])  # NORMAL_ACCOUNT
        ]
        control_changes["pwdLastSet"] = [
            (MODIFY_REPLACE, [0 if payload.force_password_reset else -1])
        ]
    else:
        control_changes["userAccountControl"] = [
            (MODIFY_REPLACE, [0x0202])  # ACCOUNTDISABLE + PASSWD_NOTREQD
        ]

    if control_changes and not conn.modify(user_dn, control_changes):
        raise EmployeeProvisionError(
            f"Failed to finalize AD account attributes: {conn.result.get('message')}"
        )

    return user_dn, sam_account_name, password_set


def _find_ad_user_dn(
    conn: Connection,
    settings: LocalADSettings,
    email: str,
    *,
    display_name: str | None = None,
) -> str | None:
    """Locate an AD user by mail/UPN, or by displayName/cn if MATCH_BY=NAME."""

    def _escape(value: str) -> str:
        return value.replace("\\", "\\5c").replace("*", "\\2a").replace("(", "\\28").replace(")", "\\29")

    filters: list[str] = []
    if settings.match_by == "NAME" and display_name:
        safe = _escape(display_name)
        filters.extend([f"(displayName={safe})", f"(cn={safe})"])
    if email:
        safe_email = _escape(email)
        filters.extend([f"(mail={safe_email})", f"(userPrincipalName={safe_email})"])
    # Fallback: if NAME-mode but no match yet, still try mail/UPN
    if settings.match_by == "NAME" and display_name and email:
        pass  # already added above

    for search_filter in filters:
        filter_expr = f"(&(objectClass=user){search_filter})"
        conn.search(
            search_base=settings.base_dn,
            search_filter=filter_expr,
            attributes=["distinguishedName"],
            size_limit=1,
        )
        if conn.entries:
            return conn.entries[0].entry_dn
    return None


def set_ad_account_enabled(
    settings: LocalADSettings,
    email: str,
    *,
    enabled: bool,
    display_name: str | None = None,
) -> bool:
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, email, display_name=display_name)
        if not user_dn:
            current_app.logger.warning(
                "Unable to locate AD account for %s (%s) in %s while %s",
                email,
                display_name,
                settings.label,
                "enabling" if enabled else "disabling",
            )
            return False
        new_control = 512 if enabled else 0x0202
        if not conn.modify(
            user_dn,
            {
                "userAccountControl": [
                    (MODIFY_REPLACE, [new_control])
                ]
            },
        ):
            raise EmployeeProvisionError(
                f"Failed to {'enable' if enabled else 'disable'} AD account: {conn.result.get('message')}"
            )
        return True
    finally:
        conn.unbind()


def set_employee_enabled_all_ads(
    employee: "Employee",
    *,
    enabled: bool,
) -> list[dict[str, Any]]:
    """Enable/disable an employee across every configured lifecycle AD.

    Returns one result dict per AD: {label, found, error}. Ignores Plant A
    (per Config.get_lifecycle_ad_configs) and silently skips unconfigured ones.
    """
    from ..config import Config

    results: list[dict[str, Any]] = []
    ad_configs = Config.get_lifecycle_ad_configs()
    for label, cfg in ad_configs.items():
        settings = _settings_from_config(label, cfg)
        entry: dict[str, Any] = {"label": label, "found": False, "error": None}
        try:
            entry["found"] = set_ad_account_enabled(
                settings,
                employee.email,
                enabled=enabled,
                display_name=employee.full_name,
            )
        except EmployeeProvisionError as exc:
            entry["error"] = str(exc)
        except Exception as exc:  # bind failure, network issue, etc.
            entry["error"] = f"{type(exc).__name__}: {exc}"
        results.append(entry)
    return results


def delete_employee_ad_all(employee: "Employee") -> list[dict[str, Any]]:
    """Delete an employee across every configured lifecycle AD."""
    from ..config import Config

    results: list[dict[str, Any]] = []
    ad_configs = Config.get_lifecycle_ad_configs()
    for label, cfg in ad_configs.items():
        settings = _settings_from_config(label, cfg)
        entry: dict[str, Any] = {"label": label, "found": False, "error": None}
        try:
            entry["found"] = delete_ad_account(
                settings,
                employee.email,
                display_name=employee.full_name,
            )
        except EmployeeProvisionError as exc:
            entry["error"] = str(exc)
        except Exception as exc:
            entry["error"] = f"{type(exc).__name__}: {exc}"
        results.append(entry)
    return results


def delete_ad_account(
    settings: LocalADSettings,
    email: str,
    *,
    display_name: str | None = None,
) -> bool:
    conn = _build_connection(settings)
    try:
        user_dn = _find_ad_user_dn(conn, settings, email, display_name=display_name)
        if not user_dn:
            current_app.logger.warning(
                "Unable to locate AD account for %s (%s) in %s during deletion.",
                email,
                display_name,
                settings.label,
            )
            return False
        if not conn.delete(user_dn):
            raise EmployeeProvisionError(
                f"Failed to delete AD account: {conn.result.get('message')}"
            )
        return True
    finally:
        conn.unbind()


def _delete_ad_user(conn: Connection, user_dn: str) -> None:
    try:
        conn.delete(user_dn)
    except LDAPExceptionError:
        current_app.logger.exception("Unable to delete AD user %s during rollback", user_dn)


def _provision_m365_user(
    graph_service: M365SyncService,
    payload: EmployeeProvisionPayload,
    mail_nickname: str,
) -> tuple[dict[str, Any], bool]:
    existing = graph_service.get_user(payload.email)
    if existing:
        raise EmployeeProvisionError(
            "A Microsoft 365 account already exists for this email address."
        )

    generated_temp = False
    password_value = (payload.password or "").strip()
    if not password_value:
        password_value = _generate_temp_password()
        generated_temp = True

    try:
        user_payload = graph_service.create_user(
            display_name=f"{payload.first_name} {payload.last_name}".strip(),
            given_name=payload.first_name,
            surname=payload.last_name,
            user_principal_name=payload.email,
            mail_nickname=mail_nickname,
            password=password_value,
            department=payload.department,
            job_title=payload.title,
            force_password_reset=True,
        )
        if not payload.password:
            graph_service.set_user_enabled(payload.email, False)
        return user_payload, generated_temp
    except M365SyncError as exc:
        raise EmployeeProvisionError(f"Microsoft 365 user creation failed: {exc}") from exc


def provision_employee(payload: EmployeeProvisionPayload) -> dict[str, Any]:
    settings = _ensure_local_ad_settings(payload.email)
    conn = _build_connection(settings)
    ad_user_dn: Optional[str] = None
    graph_user: Optional[dict[str, Any]] = None
    graph_service: Optional[M365SyncService] = None

    password_auto_generated = False
    if not (payload.password or "").strip():
        payload.password = generate_friendly_password()
        password_auto_generated = True

    try:
        ad_user_dn, sam_account_name, password_set = _create_ad_user(
            conn, settings, payload
        )
        try:
            graph_service = M365SyncService(
                graph_config=graph_config_for_email(payload.email)
            )
        except M365CredentialsError as exc:
            raise EmployeeProvisionError(str(exc)) from exc
        graph_user, m365_password_generated = _provision_m365_user(
            graph_service, payload, sam_account_name
        )

        employee = Employee(
            first_name=payload.first_name,
            last_name=payload.last_name,
            preferred_name=payload.preferred_name
            or f"{payload.first_name} {payload.last_name}".strip(),
            email=payload.email.lower(),
            department=payload.department,
            title=payload.title,
            employee_number=payload.employee_number,
            manager_email=payload.manager_email,
            notes=payload.notes,
            start_date=payload.start_date,
            termination_date=payload.termination_date,
            birthday=payload.birthday,
            status=payload.status,
            account_type=payload.account_type or "domain",
            phone=payload.phone,
            mobile_phone=payload.mobile_phone,
            extension=payload.extension,
            office_location=payload.office_location,
            initial_password=payload.password,
        )
        db.session.add(employee)
        try:
            db.session.flush()
            db.session.commit()
        except IntegrityError as exc:
            db.session.rollback()
            error_message = "Employee record already exists in the database."
            detail = str(exc.orig).lower() if exc.orig else ""
            if "ix_employees_employee_number" in detail:
                error_message = (
                    "Employee number already exists. Use a unique number or leave it blank."
                )
            elif "ix_employees_email" in detail:
                error_message = "An employee with this email already exists."
            raise EmployeeProvisionError(error_message) from exc

        return {
            "employee": employee,
            "ad_user_dn": ad_user_dn,
            "m365_user": graph_user,
            "initial_password_set": password_set,
            "m365_password_generated": m365_password_generated,
            "temp_password_generated": password_auto_generated,
        }
    except Exception:
        db.session.rollback()
        if graph_service and graph_user:
            user_id = graph_user.get("id") or graph_user.get("userPrincipalName")
            if user_id:
                try:
                    graph_service.delete_user(user_id)
                except M365SyncError:
                    current_app.logger.exception(
                        "Failed to roll back Microsoft 365 user %s", user_id
                    )
        if ad_user_dn:
            _delete_ad_user(conn, ad_user_dn)
        raise
    finally:
        conn.unbind()



from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from dataclasses import asdict
from typing import Any
from urllib.parse import quote


def _parse_graph_date(value: Any) -> date | None:
    """Parse an ISO date string from Graph (e.g. employeeHireDate) to a date."""
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.rstrip("Z").split("T")[0]).date()
    except (ValueError, TypeError):
        return None

import msal
import requests
from flask import current_app

from ..config import Config, GraphConfig
from ..database import db
from ..models import (
    Company,
    DistributionGroup,
    DistributionGroupMember,
    DistributionGroupMemberRole,
    DistributionGroupSendPermission,
    DistributionGroupType,
    Employee,
    EmployeeStatus,
    M365Device,
    M365LicenseAssignment,
    SuppressedEmail,
)


def _is_suppressed(email: str) -> bool:
    if not email:
        return False
    return (
        SuppressedEmail.query.filter(
            db.func.lower(SuppressedEmail.email) == email.lower()
        ).first()
        is not None
    )

_COMPANY_DOMAIN_MAP: dict[str, str] = {
    "Acme": "acme.com",
    "Plant A": "plant_a.com",
}

# Map email domains to company names for auto-assignment
_DOMAIN_COMPANY_MAP: dict[str, str] = {
    "acme.com": "Acme",
    "plant_a.com": "Plant A",
}


def _resolve_company_id(email: str) -> int | None:
    """Return the company_id for an email based on its domain."""
    domain = email.rsplit("@", 1)[-1].lower() if "@" in email else ""
    company_name = _DOMAIN_COMPANY_MAP.get(domain)
    if not company_name:
        return None
    company = Company.query.filter_by(name=company_name).one_or_none()
    return company.id if company else None

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


def graph_config_for_email(email: str | None) -> GraphConfig:
    """Return the GraphConfig for the tenant that owns this email.

    Routes @acme.* domains to ACME_GRAPH; everything else falls back to the
    default Plant A config. Falls back if the Acme config isn't set.
    """
    if email:
        domain = email.rsplit("@", 1)[-1].lower() if "@" in email else ""
        if (domain.endswith("acme.com") or domain.endswith("acme.onmicrosoft.com") or
                domain.endswith("acme.net")):
            if Config.ACME_GRAPH.tenant_id:
                return Config.ACME_GRAPH
    return Config.GRAPH


def service_for_employee(employee: "Employee") -> "M365SyncService":
    """Build an M365SyncService routed to the employee's home tenant."""
    cfg = graph_config_for_email(employee.email)
    company_id = employee.company_id
    return M365SyncService(graph_config=cfg, company_id=company_id)


class M365CredentialsError(RuntimeError):
    pass


class M365SyncError(RuntimeError):
    pass


class M365SyncService:
    def __init__(self, graph_config: GraphConfig | None = None, company_id: int | None = None):
        self.graph_config = graph_config or Config.GRAPH
        self.company_id = company_id
        missing = [
            name
            for name, value in asdict(self.graph_config).items()
            if name
            not in {"scope", "authority_url"}  # optional fields
            and not value
        ]
        if missing:
            raise M365CredentialsError(
                f"Missing Microsoft Graph credentials: {', '.join(sorted(missing))}"
            )

        authority_url = (
            self.graph_config.authority_url
            or f"https://login.microsoftonline.com/{self.graph_config.tenant_id}"
        )
        self.client = msal.ConfidentialClientApplication(
            client_id=self.graph_config.client_id,
            authority=authority_url,
            client_credential=self.graph_config.client_secret,
        )

    def _get_access_token(self) -> str:
        token_response = self.client.acquire_token_silent(
            scopes=[self.graph_config.scope], account=None
        )
        if not token_response:
            token_response = self.client.acquire_token_for_client(
                scopes=[self.graph_config.scope]
            )
        if "access_token" not in token_response:
            raise M365SyncError(
                token_response.get("error_description")
                or "Unable to acquire Microsoft Graph access token"
            )
        return token_response["access_token"]

    def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        expected_status: tuple[int, ...] = (200,),
        allow_not_found: bool = False,
    ) -> requests.Response:
        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        if json is not None:
            headers["Content-Type"] = "application/json"

        response = requests.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json,
            timeout=30,
        )
        if response.status_code in expected_status:
            return response
        if allow_not_found and response.status_code == 404:
            return response
        raise M365SyncError(
            f"Graph request failed: {response.status_code} {response.text}"
        )

    def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self._request("GET", url, params=params)
        return response.json()

    def sync_directory(self) -> dict[str, int]:
        stats = defaultdict(int)
        current_app.logger.info("Starting Microsoft 365 directory sync")

        user_count, user_emails = self._sync_users()
        stats["employees"] = user_count
        stats["emails"] = sorted(user_emails)
        stats["devices"] = self._sync_devices()
        stats["licenses"] = self._sync_license_assignments()
        stats["distribution_groups"] = self._sync_distribution_groups()

        db.session.commit()
        current_app.logger.info("Microsoft 365 sync complete: %s", dict(stats))
        return dict(stats)

    def _sync_users(self) -> tuple[int, set[str]]:
        url = f"{GRAPH_BASE_URL}/users"
        params = {
            "$select": ",".join([
                "id", "displayName", "givenName", "surname", "mail",
                "userPrincipalName", "department", "jobTitle", "employeeId",
                "employeeHireDate", "mobilePhone", "businessPhones",
                "officeLocation", "employeeType", "userType", "accountEnabled",
            ]),
            "$expand": "manager($select=mail,userPrincipalName)",
            "$top": "999",
        }
        processed = 0
        emails: set[str] = set()

        while url:
            payload = self._get(url, params=params)
            for user in payload.get("value", []):
                email = user.get("mail") or user.get("userPrincipalName")
                if not email:
                    continue
                employee = Employee.query.filter_by(email=email).one_or_none()
                if employee is None and _is_suppressed(email):
                    continue
                created = False
                display_name = user.get("displayName") or ""
                name_parts = display_name.split()
                first_name = user.get("givenName") or (name_parts[0] if name_parts else "")
                last_name = user.get("surname") or (
                    " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
                )

                company_id = self.company_id or _resolve_company_id(email)

                # Derived profile fields
                hire_date = _parse_graph_date(user.get("employeeHireDate"))
                business_phones = user.get("businessPhones") or []
                business_phone = business_phones[0] if business_phones else None
                manager_obj = user.get("manager") or {}
                manager_email = (
                    manager_obj.get("mail")
                    or manager_obj.get("userPrincipalName")
                )

                if not employee:
                    employee = Employee(
                        email=email,
                        first_name=first_name,
                        last_name=last_name or first_name,
                        department=user.get("department"),
                        title=user.get("jobTitle"),
                        employee_number=user.get("employeeId"),
                        start_date=hire_date,
                        mobile_phone=user.get("mobilePhone"),
                        phone=business_phone,
                        office_location=user.get("officeLocation"),
                        manager_email=manager_email,
                        status=EmployeeStatus.ACTIVE,
                        company_id=company_id,
                    )
                    db.session.add(employee)
                    created = True
                else:
                    employee.first_name = user.get("givenName") or first_name or employee.first_name
                    employee.last_name = user.get("surname") or last_name or employee.last_name
                    employee.department = user.get("department")
                    employee.title = user.get("jobTitle")
                    employee.employee_number = (
                        user.get("employeeId") or employee.employee_number
                    )
                    # Only overwrite profile fields when Graph has a value —
                    # never clobber app-side data with nulls.
                    if hire_date:
                        employee.start_date = hire_date
                    if user.get("mobilePhone"):
                        employee.mobile_phone = user.get("mobilePhone")
                    if business_phone:
                        employee.phone = business_phone
                    if user.get("officeLocation"):
                        employee.office_location = user.get("officeLocation")
                    if manager_email:
                        employee.manager_email = manager_email
                    # Fix company assignment if missing or wrong
                    if company_id and employee.company_id != company_id:
                        employee.company_id = company_id
                processed += 1
                emails.add(email.lower())
                current_app.logger.debug(
                    "Synced employee %s (%s)", email, "created" if created else "updated"
                )

            url = payload.get("@odata.nextLink")
            params = None

        return processed, emails

    def get_user(self, user_principal_name: str) -> dict[str, Any] | None:
        encoded = quote(user_principal_name)
        response = self._request(
            "GET",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            allow_not_found=True,
        )
        if response.status_code == 404:
            return None
        return response.json()

    def lookup_user_profile(self, user_principal_name: str) -> dict[str, Any] | None:
        """Fetch the full employee-profile attribute set for one user."""
        encoded = quote(user_principal_name)
        params = {
            "$select": ",".join([
                "id", "displayName", "givenName", "surname", "mail",
                "userPrincipalName", "department", "jobTitle", "employeeId",
                "employeeHireDate", "mobilePhone", "businessPhones",
                "officeLocation", "employeeType", "userType", "accountEnabled",
            ]),
            "$expand": "manager($select=mail,userPrincipalName)",
        }
        response = self._request(
            "GET",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            params=params,
            allow_not_found=True,
        )
        if response.status_code == 404:
            return None
        return response.json()

    def create_user(
        self,
        *,
        display_name: str,
        given_name: str,
        surname: str,
        user_principal_name: str,
        mail_nickname: str,
        password: str,
        department: str | None = None,
        job_title: str | None = None,
        force_password_reset: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "accountEnabled": True,
            "displayName": display_name,
            "mailNickname": mail_nickname,
            "userPrincipalName": user_principal_name,
            "passwordProfile": {
                "forceChangePasswordNextSignIn": force_password_reset,
                "password": password,
            },
            "givenName": given_name,
            "surname": surname,
        }
        if department:
            payload["department"] = department
        if job_title:
            payload["jobTitle"] = job_title

        response = self._request(
            "POST",
            f"{GRAPH_BASE_URL}/users",
            json=payload,
            expected_status=(201,),
        )
        return response.json()

    def update_user(
        self,
        user_principal_name: str,
        updates: dict[str, Any],
    ) -> None:
        if not updates:
            return
        encoded = quote(user_principal_name)
        self._request(
            "PATCH",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            json=updates,
            expected_status=(204,),
            allow_not_found=False,
        )

    def delete_user(self, user_id_or_upn: str) -> bool:
        encoded = quote(user_id_or_upn)
        resp = self._request(
            "DELETE",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            expected_status=(204,),
            allow_not_found=True,
        )
        return resp.status_code == 204

    def set_user_enabled(self, user_principal_name: str, enabled: bool) -> bool:
        payload = {"accountEnabled": enabled}
        encoded = quote(user_principal_name)
        resp = self._request(
            "PATCH",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            json=payload,
            expected_status=(204,),
            allow_not_found=True,
        )
        return resp.status_code == 204

    def reset_user_password(
        self,
        user_principal_name: str,
        password: str,
        *,
        force_change: bool = True,
    ) -> None:
        payload = {
            "passwordProfile": {
                "forceChangePasswordNextSignIn": force_change,
                "password": password,
            }
        }
        encoded = quote(user_principal_name)
        self._request(
            "PATCH",
            f"{GRAPH_BASE_URL}/users/{encoded}",
            json=payload,
            expected_status=(204,),
            allow_not_found=False,
        )

    def _sync_devices(self) -> int:
        url = f"{GRAPH_BASE_URL}/devices"
        params = {
            "$select": "id,deviceId,displayName,operatingSystem,complianceState,approximateLastSignInDateTime",
            "$expand": "registeredOwners($select=userPrincipalName)",
            "$top": "999",
        }
        processed = 0

        # Clear existing devices before reimporting
        M365Device.query.delete()

        while url:
            payload = self._get(url, params=params)
            for device in payload.get("value", []):
                registered_users = device.get("registeredOwners", [])
                employee = None
                for owner in registered_users:
                    email = owner.get("userPrincipalName")
                    if not email:
                        continue
                    employee = Employee.query.filter_by(email=email).one_or_none()
                    if employee:
                        break

                last_sync_raw = device.get("approximateLastSignInDateTime")
                last_sync = None
                if last_sync_raw:
                    try:
                        last_sync = datetime.fromisoformat(
                            last_sync_raw.replace("Z", "+00:00")
                        )
                    except ValueError:
                        last_sync = None

                m_device = M365Device(
                    device_id=device.get("deviceId") or device.get("id"),
                    display_name=device.get("displayName"),
                    operating_system=device.get("operatingSystem"),
                    compliance_state=device.get("complianceState"),
                    last_sync_time=last_sync,
                    employee=employee,
                )
                db.session.add(m_device)
                processed += 1

            url = payload.get("@odata.nextLink")
            params = None

        return processed

    def sync_single_employee(self, employee: "Employee") -> dict[str, Any]:
        """Refresh one employee's M365 data in place.

        Pulls the user record, license details, and any devices where they
        are a registered owner. Replaces only this employee's child rows
        (licenses, devices) — does not touch group memberships (those refresh
        on the nightly full sync).
        """
        email = employee.email
        result: dict[str, Any] = {
            "email": email,
            "found": False,
            "licenses": 0,
            "devices": 0,
        }

        user = self.get_user(email)
        if not user:
            return result
        result["found"] = True

        if user.get("givenName"):
            employee.first_name = user["givenName"]
        if user.get("surname"):
            employee.last_name = user["surname"]
        if "department" in user:
            employee.department = user.get("department")
        if "jobTitle" in user:
            employee.title = user.get("jobTitle")
        if user.get("employeeId"):
            employee.employee_number = user["employeeId"]
        if "accountEnabled" in user:
            employee.status = (
                EmployeeStatus.ACTIVE if user["accountEnabled"] else EmployeeStatus.INACTIVE
            )

        M365LicenseAssignment.query.filter_by(employee_id=employee.id).delete()
        lic_payload = self._get(
            f"{GRAPH_BASE_URL}/users/{quote(email)}/licenseDetails"
        )
        for license_detail in lic_payload.get("value", []):
            sku_id = license_detail.get("skuId")
            if not sku_id:
                continue
            assignment = M365LicenseAssignment(
                sku_id=sku_id,
                sku_part_number=license_detail.get("skuPartNumber"),
                sku_name=license_detail.get("skuPartNumber"),
                employee=employee,
            )
            db.session.add(assignment)
            result["licenses"] += 1

        user_id = user.get("id")
        if user_id:
            M365Device.query.filter_by(employee_id=employee.id).delete()
            dev_url = f"{GRAPH_BASE_URL}/users/{user_id}/ownedDevices"
            dev_payload = self._get(dev_url)
            for device in dev_payload.get("value", []):
                if device.get("@odata.type") and "device" not in device["@odata.type"].lower():
                    continue
                last_sync_raw = device.get("approximateLastSignInDateTime")
                last_sync = None
                if last_sync_raw:
                    try:
                        last_sync = datetime.fromisoformat(
                            last_sync_raw.replace("Z", "+00:00")
                        )
                    except ValueError:
                        last_sync = None
                m_device = M365Device(
                    device_id=device.get("deviceId") or device.get("id"),
                    display_name=device.get("displayName"),
                    operating_system=device.get("operatingSystem"),
                    compliance_state=device.get("complianceState"),
                    last_sync_time=last_sync,
                    employee=employee,
                )
                db.session.add(m_device)
                result["devices"] += 1

        employee.last_synced_at = datetime.utcnow()
        return result

    def _sync_license_assignments(self, max_workers: int = 10) -> int:
        """Fetch license details for every employee in parallel, then write.

        DB writes stay on the main thread; only Graph fetches run in the
        pool. Tenant filter uses email domain to avoid cross-tenant 404s.
        """
        M365LicenseAssignment.query.delete()

        tenant_domains = self._tenant_domains()
        employees = [
            e for e in Employee.query.all()
            if self._email_in_tenant(e.email, tenant_domains)
        ]
        if not employees:
            return 0

        def fetch(emp: Employee) -> tuple[Employee, list[dict[str, Any]] | None]:
            try:
                payload = self._get(
                    f"{GRAPH_BASE_URL}/users/{quote(emp.email)}/licenseDetails"
                )
                return emp, payload.get("value", [])
            except M365SyncError as exc:
                if " 404" in str(exc) or "404 " in str(exc):
                    return emp, None
                current_app.logger.warning(
                    "License fetch failed for %s: %s", emp.email, exc
                )
                return emp, None

        total = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = [pool.submit(fetch, e) for e in employees]
            for fut in as_completed(futures):
                emp, details = fut.result()
                if not details:
                    continue
                for license_detail in details:
                    sku_id = license_detail.get("skuId")
                    if not sku_id:
                        continue
                    assignment = M365LicenseAssignment(
                        sku_id=sku_id,
                        sku_part_number=license_detail.get("skuPartNumber"),
                        sku_name=license_detail.get("skuPartNumber"),
                        employee=emp,
                    )
                    db.session.add(assignment)
                    total += 1
        return total

    def _tenant_domains(self) -> set[str]:
        """Return the email domains that belong to this tenant."""
        if self.company_id:
            company = Company.query.filter_by(id=self.company_id).one_or_none()
            name = company.name if company else None
            if name == "Acme":
                return {"acme.com", "acme.onmicrosoft.com", "acme.net"}
            if name == "Plant A":
                return {"plant_a.com"}
        return set()

    def _email_in_tenant(self, email: str | None, domains: set[str]) -> bool:
        """Tenant domain gate; empty domains means 'accept all'."""
        if not domains:
            return True
        if not email or "@" not in email:
            return False
        domain = email.rsplit("@", 1)[-1].lower()
        return any(domain.endswith(d) for d in domains)


    def _sync_distribution_groups(self) -> int:
        """Pull mail-enabled groups from Graph and upsert members, owners,
        and send-on-behalf permissions.

        Graph limitations: send-as for classic distribution lists is not
        exposed; `grantSendOnBehalfTo` covers send-on-behalf on unified
        groups. Classic DL send permissions stay blank until an Exchange
        Online source is wired up.
        """
        url = f"{GRAPH_BASE_URL}/groups"
        params = {
            "$filter": "mailEnabled eq true",
            "$select": (
                "id,displayName,mail,groupTypes,description,visibility,"
                "securityEnabled,mailEnabled"
            ),
            "$top": "100",
        }

        existing = {g.m365_id: g for g in DistributionGroup.query.all()}
        seen_ids: set[str] = set()
        processed = 0

        while url:
            payload = self._get(url, params=params)
            for raw in payload.get("value", []):
                m365_id = raw.get("id")
                if not m365_id:
                    continue
                seen_ids.add(m365_id)
                group = existing.get(m365_id) or DistributionGroup(m365_id=m365_id)
                group.display_name = raw.get("displayName") or "(unnamed)"
                group.mail = raw.get("mail")
                group.description = raw.get("description")
                group.visibility = raw.get("visibility")
                group.group_type = _classify_group_type(raw)
                group.synced_at = datetime.utcnow()
                if group.mail:
                    group.company_id = _resolve_company_id(group.mail)
                if group.id is None:
                    db.session.add(group)
                db.session.flush()
                self._sync_group_memberships(group)
                self._sync_group_send_on_behalf(group)
                processed += 1
            url = payload.get("@odata.nextLink")
            params = None

        # Remove groups that disappeared from Graph.
        for m365_id, group in existing.items():
            if m365_id not in seen_ids:
                db.session.delete(group)

        return processed

    def _sync_group_memberships(self, group: DistributionGroup) -> None:
        DistributionGroupMember.query.filter_by(group_id=group.id).delete()
        for role, endpoint in (
            (DistributionGroupMemberRole.MEMBER, "members"),
            (DistributionGroupMemberRole.OWNER, "owners"),
        ):
            url = f"{GRAPH_BASE_URL}/groups/{group.m365_id}/{endpoint}"
            params: dict[str, Any] | None = {
                "$select": "id,userPrincipalName,mail,displayName",
                "$top": "999",
            }
            while url:
                payload = self._get(url, params=params)
                for entry in payload.get("value", []):
                    self._insert_group_actor(
                        group=group,
                        raw=entry,
                        role=role,
                    )
                url = payload.get("@odata.nextLink")
                params = None

    def _sync_group_send_on_behalf(self, group: DistributionGroup) -> None:
        # grantSendOnBehalfTo is not exposed on microsoft.graph.group; it's a
        # mailbox-level property only reachable via Exchange Online PowerShell.
        # Clear stale rows and leave the list empty until an EXO source is wired in.
        DistributionGroupSendPermission.query.filter_by(
            group_id=group.id, permission_type="send_on_behalf"
        ).delete()

    def _insert_group_actor(
        self,
        *,
        group: DistributionGroup,
        raw: dict[str, Any],
        role: DistributionGroupMemberRole,
    ) -> None:
        email = raw.get("userPrincipalName") or raw.get("mail")
        display = raw.get("displayName")
        employee = (
            Employee.query.filter_by(email=email).one_or_none() if email else None
        )
        member = DistributionGroupMember(
            group_id=group.id,
            employee_id=employee.id if employee else None,
            external_email=email if not employee else None,
            external_display_name=display if not employee else None,
            role=role,
        )
        db.session.add(member)


def _classify_group_type(raw: dict[str, Any]) -> DistributionGroupType:
    group_types = [t.lower() for t in (raw.get("groupTypes") or [])]
    if "unified" in group_types:
        return DistributionGroupType.M365_UNIFIED
    if raw.get("securityEnabled") and raw.get("mailEnabled"):
        return DistributionGroupType.MAIL_ENABLED_SECURITY
    return DistributionGroupType.DISTRIBUTION


def _resolve_company_id_by_name(name: str) -> int | None:
    company = Company.query.filter_by(name=name).one_or_none()
    return company.id if company else None


def sync_all_tenants() -> dict[str, object]:
    """Sync all configured M365 tenants (one per company)."""
    graph_configs = Config.get_graph_configs()
    if not graph_configs:
        raise M365CredentialsError("No Microsoft Graph configurations found.")

    results: dict[str, object] = {}
    all_emails: set[str] = set()
    total_employees = 0

    for company_name, graph_config in graph_configs.items():
        company_id = _resolve_company_id_by_name(company_name)
        current_app.logger.info(
            "Syncing M365 for %s (company_id=%s)", company_name, company_id
        )
        try:
            service = M365SyncService(graph_config=graph_config, company_id=company_id)
            stats = service.sync_directory()
            results[company_name] = stats
            all_emails.update(stats.get("emails", []))
            total_employees += stats.get("employees", 0)
        except Exception as exc:
            current_app.logger.error(
                "M365 sync failed for %s: %s", company_name, exc
            )
            results[company_name] = {"error": str(exc)}

    results["_totals"] = {
        "employees": total_employees,
        "emails": sorted(all_emails),
    }
    return results


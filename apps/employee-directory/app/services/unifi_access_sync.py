from __future__ import annotations

import json
from typing import Any

import requests
from flask import current_app
from sqlalchemy import func

from ..config import Config
from ..database import db
from ..models import (
    Employee,
    UnifiAccessPolicy,
    UnifiAccessPolicyAssignment,
    UnifiAccessUser,
    UnifiDoor,
    UnifiNfcCard,
    UnifiSchedule,
    unifi_access_policy_doors,
)


class UnifiAccessError(RuntimeError):
    pass


class UnifiAccessService:
    def __init__(self):
        cfg = Config.UNIFI_ACCESS
        if not cfg.configured:
            raise UnifiAccessError("Unifi Access is not configured (missing host or API token).")
        self.base_url = f"{cfg.base_url}/api/v1/developer"
        self.headers = {"Authorization": f"Bearer {cfg.api_token}"}

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        response = requests.get(url, headers=self.headers, timeout=30, verify=False)
        if response.status_code != 200:
            raise UnifiAccessError(f"Unifi Access API error: {response.status_code} {response.text}")
        data = response.json()
        if data.get("code") != "SUCCESS":
            raise UnifiAccessError(f"Unifi Access API error: {data.get('msg', 'unknown')}")
        return data

    def _put(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        response = requests.put(
            url,
            headers={**self.headers, "Content-Type": "application/json"},
            json=payload,
            timeout=30,
            verify=False,
        )
        if response.status_code not in (200, 204):
            raise UnifiAccessError(
                f"Unifi Access API error: {response.status_code} {response.text}"
            )
        if response.status_code == 204 or not response.text:
            return {}
        data = response.json()
        if data.get("code") not in ("SUCCESS", None):
            raise UnifiAccessError(f"Unifi Access API error: {data.get('msg', 'unknown')}")
        return data

    def fetch_users(self) -> list[dict[str, Any]]:
        data = self._get("/users")
        return data.get("data", [])

    def fetch_user_policies(self, user_id: str) -> list[dict[str, Any]]:
        data = self._get(f"/users/{user_id}/access_policies")
        return data.get("data", [])

    def fetch_user(self, user_id: str) -> dict[str, Any]:
        data = self._get(f"/users/{user_id}")
        return data.get("data") or {}

    def _resolve_unifi_user_id_for_employee(self, employee: Employee) -> str | None:
        """Look up the Unifi user id we cached from the last sync."""
        if not employee:
            return None
        ua_user = (
            UnifiAccessUser.query.filter_by(employee_id=employee.id)
            .order_by(UnifiAccessUser.id.desc())
            .first()
        )
        return ua_user.unifi_id if ua_user else None

    def set_user_access_policies(
        self, user_id: str, policy_ids: list[str]
    ) -> dict[str, Any]:
        """Overwrite the full set of access policies for a Unifi user."""
        unique_ids = list(dict.fromkeys(pid for pid in policy_ids if pid))
        return self._put(
            f"/users/{user_id}",
            {"access_policy_ids": unique_ids},
        )

    def assign_policies_to_employee(
        self, employee: Employee, policy_ids: list[str]
    ) -> dict[str, Any]:
        """Idempotently add policies to an employee's Unifi user.

        Returns a result dict with counts + skip reason if we cannot act.
        """
        if not policy_ids:
            return {"status": "skipped", "reason": "no policies configured"}
        unifi_user_id = self._resolve_unifi_user_id_for_employee(employee)
        if not unifi_user_id:
            return {
                "status": "skipped",
                "reason": "no Unifi Access user linked (register a badge first)",
            }

        current = self.fetch_user_policies(unifi_user_id)
        current_ids = {p.get("id") for p in current if p.get("id")}
        target_ids = list(current_ids | set(policy_ids))
        self.set_user_access_policies(unifi_user_id, target_ids)
        added = [pid for pid in policy_ids if pid not in current_ids]
        return {
            "status": "ok",
            "added": added,
            "already_assigned": [pid for pid in policy_ids if pid in current_ids],
            "unifi_user_id": unifi_user_id,
        }

    def revoke_policies_from_employee(
        self, employee: Employee, policy_ids: list[str] | None = None
    ) -> dict[str, Any]:
        """Remove the given policies from an employee (or all policies if None)."""
        unifi_user_id = self._resolve_unifi_user_id_for_employee(employee)
        if not unifi_user_id:
            return {
                "status": "skipped",
                "reason": "no Unifi Access user linked",
            }

        current = self.fetch_user_policies(unifi_user_id)
        current_ids = [p.get("id") for p in current if p.get("id")]
        if policy_ids is None:
            remaining: list[str] = []
            removed = list(current_ids)
        else:
            to_remove = set(policy_ids)
            remaining = [pid for pid in current_ids if pid not in to_remove]
            removed = [pid for pid in current_ids if pid in to_remove]
        self.set_user_access_policies(unifi_user_id, remaining)
        return {
            "status": "ok",
            "removed": removed,
            "remaining": remaining,
            "unifi_user_id": unifi_user_id,
        }

    def fetch_doors(self) -> list[dict[str, Any]]:
        data = self._get("/doors")
        return data.get("data", [])

    def fetch_access_policies(self) -> list[dict[str, Any]]:
        data = self._get("/access_policies")
        return data.get("data", [])

    def fetch_door_groups(self) -> list[dict[str, Any]]:
        try:
            data = self._get("/door_groups")
        except UnifiAccessError:
            return []
        return data.get("data", [])

    def fetch_schedules(self) -> list[dict[str, Any]]:
        try:
            data = self._get("/schedules")
        except UnifiAccessError:
            return []
        return data.get("data", [])

    def _match_employee(self, ua_user: dict[str, Any]) -> Employee | None:
        email = ua_user.get("user_email")
        if email:
            emp = Employee.query.filter(
                func.lower(Employee.email) == email.lower()
            ).first()
            if emp:
                return emp

        emp_num = ua_user.get("employee_number")
        if emp_num:
            emp = Employee.query.filter(
                func.lower(Employee.employee_number) == emp_num.lower()
            ).first()
            if emp:
                return emp

        first = ua_user.get("first_name")
        last = ua_user.get("last_name")
        if first and last:
            emp = Employee.query.filter(
                func.lower(Employee.first_name) == first.lower(),
                func.lower(Employee.last_name) == last.lower(),
            ).first()
            if emp:
                return emp

        return None

    def _sync_catalog(self, stats: dict[str, int]) -> None:
        """Refresh the doors/schedules/policies catalog (global, not per-user)."""
        db.session.execute(unifi_access_policy_doors.delete())
        UnifiAccessPolicy.query.delete()
        UnifiDoor.query.delete()
        UnifiSchedule.query.delete()
        db.session.flush()

        # Doors
        door_by_unifi_id: dict[str, UnifiDoor] = {}
        for d in self.fetch_doors():
            uid = d.get("id")
            if not uid:
                continue
            door = UnifiDoor(
                unifi_id=uid,
                name=d.get("name") or "Unknown door",
                full_name=d.get("full_name"),
                floor=d.get("floor_name") or d.get("floor_id"),
            )
            db.session.add(door)
            door_by_unifi_id[uid] = door
            stats["doors"] += 1
        db.session.flush()

        # Door groups → map of group_id -> [door_id,...]
        door_group_members: dict[str, list[str]] = {}
        for dg in self.fetch_door_groups():
            dgid = dg.get("id")
            if not dgid:
                continue
            members: list[str] = []
            for r in dg.get("resources") or []:
                if r.get("type") == "door" and r.get("id"):
                    members.append(r["id"])
            door_group_members[dgid] = members

        # Schedules
        for s in self.fetch_schedules():
            uid = s.get("id")
            if not uid:
                continue
            week = s.get("week_schedule")
            holiday = s.get("holiday_schedule")
            sched = UnifiSchedule(
                unifi_id=uid,
                name=s.get("name") or "Unknown schedule",
                schedule_type=s.get("type"),
                week_schedule_json=json.dumps(week) if week is not None else None,
                holiday_schedule_json=json.dumps(holiday) if holiday is not None else None,
            )
            db.session.add(sched)
            stats["schedules"] += 1
        db.session.flush()

        # Access policies → catalog (doors resolved, schedule_id captured)
        for p in self.fetch_access_policies():
            uid = p.get("id")
            if not uid:
                continue
            policy = UnifiAccessPolicy(
                unifi_id=uid,
                name=p.get("name") or "Unknown policy",
                schedule_id=p.get("schedule_id"),
            )
            db.session.add(policy)
            db.session.flush()

            resolved_door_ids: set[str] = set()
            for r in p.get("resources") or []:
                rid = r.get("id")
                rtype = r.get("type")
                if not rid:
                    continue
                if rtype == "door":
                    resolved_door_ids.add(rid)
                elif rtype in ("door_group", "group"):
                    for child_id in door_group_members.get(rid, []):
                        resolved_door_ids.add(child_id)

            for d_uid in resolved_door_ids:
                door = door_by_unifi_id.get(d_uid)
                if door is not None:
                    policy.doors.append(door)

            stats["catalog_policies"] += 1
        db.session.flush()

    def sync(self) -> dict[str, int]:
        current_app.logger.info("Starting Unifi Access sync")

        # Clear existing user data
        UnifiAccessPolicyAssignment.query.delete()
        UnifiNfcCard.query.delete()
        UnifiAccessUser.query.delete()
        db.session.flush()

        stats = {
            "users": 0,
            "matched": 0,
            "unmatched": 0,
            "badges": 0,
            "policies": 0,
            "doors": 0,
            "schedules": 0,
            "catalog_policies": 0,
        }

        # Refresh the global catalog first so per-user assignments can be joined
        # to door + schedule details.
        try:
            self._sync_catalog(stats)
        except UnifiAccessError as exc:
            current_app.logger.warning("Unifi Access catalog sync failed: %s", exc)

        ua_users = self.fetch_users()
        matched_employee_ids: set[int] = set()

        for ua_user in ua_users:
            unifi_id = ua_user.get("id")
            if not unifi_id:
                continue

            employee = self._match_employee(ua_user)
            # Avoid assigning multiple Unifi users to the same employee
            if employee and employee.id in matched_employee_ids:
                employee = None
            if employee:
                matched_employee_ids.add(employee.id)

            access_user = UnifiAccessUser(
                unifi_id=unifi_id,
                status=ua_user.get("status", "UNKNOWN"),
                employee_number=ua_user.get("employee_number"),
                avatar_relative_path=ua_user.get("avatar_relative_path"),
                phone=ua_user.get("phone") or None,
                employee=employee,
            )
            db.session.add(access_user)
            db.session.flush()

            stats["users"] += 1
            if employee:
                stats["matched"] += 1
            else:
                stats["unmatched"] += 1
                current_app.logger.debug(
                    "Unifi user %s (%s) not matched to an employee",
                    ua_user.get("full_name"), ua_user.get("user_email"),
                )

            # NFC cards / badges
            for card in ua_user.get("nfc_cards", []):
                nfc = UnifiNfcCard(
                    card_id=card.get("id", ""),
                    card_type=card.get("type"),
                    token=card.get("token"),
                    access_user_id=access_user.id,
                )
                db.session.add(nfc)
                stats["badges"] += 1

            # Access policies
            try:
                user_policies = self.fetch_user_policies(unifi_id)
                for policy in user_policies:
                    assignment = UnifiAccessPolicyAssignment(
                        policy_id=policy.get("id", ""),
                        policy_name=policy.get("name", "Unknown"),
                        access_user_id=access_user.id,
                    )
                    db.session.add(assignment)
                    stats["policies"] += 1
            except UnifiAccessError as exc:
                current_app.logger.warning(
                    "Failed to fetch policies for %s: %s", ua_user.get("full_name"), exc
                )

        db.session.commit()
        current_app.logger.info("Unifi Access sync complete: %s", stats)
        return stats

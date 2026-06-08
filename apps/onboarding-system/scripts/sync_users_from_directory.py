#!/usr/bin/env python3
"""Sync IT-Request users from the Employee Tech Doc directory.

Pulls every active employee from the directory API and upserts them into the
IT request system's `users` table with:
  - role derived from directory portal_role + department
  - manager_id resolved from directory manager_email (second pass)
  - default password = Password@1 (same as portal_users)

The directory is the source of truth — re-run this whenever you change
someone's department or manager in the Employee DB and the IT system
will pick up the new role/approver assignments.

Usage:
    python3 sync_users_from_directory.py            # apply changes
    python3 sync_users_from_directory.py --dry-run  # preview only

Env vars (with defaults shown):
    DIRECTORY_BASE_URL       http://localhost:5065
    PORTAL_SERVICE_TOKEN     (required — set in the environment / server .env)
    PGHOST                   localhost
    PGUSER                   moc_user
    PGPASSWORD               changeme
    PGDATABASE               it_request_db
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request

# Bcrypt hash of "Password@1" — same value used for portal_users.
DEFAULT_PASSWORD_HASH = "$2b$10$Sp9F.huhM8feCm0Ux9YW1u/CQgOd0ObvqF/eIxXLGRAibvt/btCcS"

DIRECTORY_BASE_URL = os.environ.get("DIRECTORY_BASE_URL", "http://localhost:5065")
SERVICE_TOKEN = os.environ.get("PORTAL_SERVICE_TOKEN", "")


def fetch_directory_employees() -> list[dict]:
    req = urllib.request.Request(
        f"{DIRECTORY_BASE_URL.rstrip('/')}/api/directory/employees",
        headers={"X-Service-Token": SERVICE_TOKEN, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read())
    return [e for e in body.get("employees", []) if e.get("status") == "active" and e.get("email")]


def derive_role(emp: dict, manages_someone: bool) -> str:
    """Map directory record -> IT users.role enum."""
    portal_role = (emp.get("portal_role") or "").lower()
    dept = (emp.get("department") or "").lower()

    if portal_role == "admin":
        return "it_admin"
    if dept == "it" or "information technology" in dept:
        return "it_admin"
    if dept.startswith("hr") or "human resources" in dept:
        return "hr"
    if manages_someone:
        return "manager"
    return "employee"


def sql_quote(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def run_psql(sql: str) -> tuple[int, str]:
    env = os.environ.copy()
    env.setdefault("PGPASSWORD", "changeme")
    proc = subprocess.run(
        [
            "psql",
            "-h", env.get("PGHOST", "localhost"),
            "-U", env.get("PGUSER", "moc_user"),
            "-d", env.get("PGDATABASE", "it_request_db"),
            "-v", "ON_ERROR_STOP=1",
            "-X", "-q", "-A", "-t",
            "-c", sql,
        ],
        env=env,
        capture_output=True,
        text=True,
    )
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    employees = fetch_directory_employees()
    print(f"Pulled {len(employees)} active employees from directory.")

    # Dedupe by lowercase email.
    by_email: dict[str, dict] = {}
    for e in employees:
        by_email[e["email"].strip().lower()] = e

    # Identify managers: anyone listed as another employee's manager_email.
    manager_emails: set[str] = set()
    for e in by_email.values():
        m = (e.get("manager_email") or "").strip().lower()
        if m:
            manager_emails.add(m)

    rows: list[tuple[str, str, str]] = []  # (email, name, role)
    role_counts: dict[str, int] = {}
    for email, e in sorted(by_email.items()):
        manages = email in manager_emails
        role = derive_role(e, manages)
        role_counts[role] = role_counts.get(role, 0) + 1
        name = e.get("full_name") or f'{e.get("first_name", "")} {e.get("last_name", "")}'.strip() or email
        rows.append((email, name, role))

    print(f"Roles to apply: {role_counts}")

    if dry_run:
        print("(dry run — no DB writes)")
        # Show a few sample rows
        for email, name, role in rows[:8]:
            print(f"  {role:9s}  {email:35s}  {name}")
        if len(rows) > 8:
            print(f"  ... and {len(rows) - 8} more")
        return 0

    # Pass 1: upsert all users in one batch.
    values_clauses = []
    for email, name, role in rows:
        values_clauses.append(
            f"({sql_quote(email)}, {sql_quote(DEFAULT_PASSWORD_HASH)}, {sql_quote(name)}, {sql_quote(role)}, true)"
        )
    upsert_sql = (
        "INSERT INTO users (email, password_hash, name, role, is_active) VALUES "
        + ",".join(values_clauses)
        + " ON CONFLICT (email) DO UPDATE SET"
        "   name = EXCLUDED.name,"
        "   role = EXCLUDED.role,"
        "   is_active = true,"
        "   updated_at = NOW()"
        " RETURNING email"
    )
    rc, out = run_psql(upsert_sql)
    if rc != 0:
        print(f"upsert failed:\n{out}", file=sys.stderr)
        return 1
    upserted = [line for line in out.splitlines() if line]
    print(f"Upserted {len(upserted)} users.")

    # Pass 2: link managers. Use a single SQL update via a VALUES list.
    pairs = []
    for email, e in by_email.items():
        m_email = (e.get("manager_email") or "").strip().lower()
        if m_email and m_email in by_email:
            pairs.append((email, m_email))
    if pairs:
        pair_clauses = ",".join(
            f"({sql_quote(child)}, {sql_quote(parent)})" for child, parent in pairs
        )
        link_sql = (
            "UPDATE users AS u "
            "SET manager_id = m.id, updated_at = NOW() "
            "FROM (VALUES " + pair_clauses + ") AS pair(child_email, manager_email) "
            "JOIN users m ON m.email = pair.manager_email "
            "WHERE u.email = pair.child_email "
            "RETURNING u.email"
        )
        rc, out = run_psql(link_sql)
        if rc != 0:
            print(f"manager-link failed:\n{out}", file=sys.stderr)
            return 1
        linked = [line for line in out.splitlines() if line]
        print(f"Linked managers: {len(linked)}/{len(pairs)} pairs")
    else:
        print("No manager links to apply.")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

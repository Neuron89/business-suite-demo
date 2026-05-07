"""Shared full-sync orchestrator used by the /sync/all route and the
nightly APScheduler job. Keeps the same behavior in both places.
"""
from __future__ import annotations

from typing import Any

from flask import current_app

from ..database import db
from .local_ad_sync import LocalADSyncError, sync_all_from_config
from .m365_sync import (
    M365CredentialsError,
    M365SyncError,
    sync_all_tenants,
)
from .pruning import prune_employees
from .scada_presence import sync_scada_presence
from .unifi_access_sync import UnifiAccessService


def run_full_sync() -> dict[str, Any]:
    """Run the full sync pipeline. Never raises; returns a stats dict with
    per-source errors instead, so one broken source doesn't kill the others.
    """
    results: dict[str, Any] = {}
    local_emails: set[str] = set()
    m365_emails: set[str] = set()

    try:
        local_stats = sync_all_from_config()
        results["local_ad"] = local_stats
        totals = local_stats.get("_totals", {})
        local_emails = set(totals.get("emails", []))
    except LocalADSyncError as exc:
        results["local_ad"] = {"error": str(exc)}
    except Exception as exc:
        current_app.logger.exception("Local AD sync crashed")
        results["local_ad"] = {"error": f"{type(exc).__name__}: {exc}"}

    try:
        m365_stats = sync_all_tenants()
        results["m365"] = m365_stats
        m365_totals = m365_stats.get("_totals", {})
        m365_emails = set(m365_totals.get("emails", []))
    except (M365CredentialsError, M365SyncError) as exc:
        results["m365"] = {"error": str(exc)}
    except Exception as exc:
        current_app.logger.exception("M365 sync crashed")
        results["m365"] = {"error": f"{type(exc).__name__}: {exc}"}

    try:
        unifi_service = UnifiAccessService()
        results["unifi_access"] = unifi_service.sync()
    except Exception as exc:
        results["unifi_access"] = {"error": str(exc)}

    active_emails = {e.lower() for e in local_emails.union(m365_emails)}
    try:
        results["pruned"] = prune_employees(active_emails)
    except Exception as exc:
        db.session.rollback()
        results["pruned"] = {"error": f"{type(exc).__name__}: {exc}"}

    try:
        results["scada"] = sync_scada_presence()
    except Exception as exc:
        results["scada"] = {"error": str(exc)}

    return results

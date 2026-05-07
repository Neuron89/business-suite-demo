from __future__ import annotations

from dataclasses import asdict

from flask import current_app

from ..config import Config
from ..database import db
from ..models import Company
from scripts.sync_local_ad_groups import SyncConfig, run_sync  # type: ignore[import]


class LocalADSyncError(RuntimeError):
    pass


def _build_sync_config(ad_config) -> SyncConfig:
    """Build a SyncConfig from a LocalADConfig instance."""
    data = asdict(ad_config)
    required_fields = ["server", "base_dn", "user", "password"]
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        raise LocalADSyncError(
            "Missing Local AD settings: " + ", ".join(field.upper() for field in missing)
        )

    return SyncConfig(
        server=data["server"],
        base_dn=data["base_dn"],
        user=data["user"],
        password=data["password"],
        use_ssl=bool(data.get("ssl")),
        auth_type=str(data.get("auth", "SIMPLE")).upper(),
        staff_ou=data.get("staff_ou"),
        match_strategy=str(data.get("match_by", "EMAIL")).upper(),
        provision_user=data.get("provision_user"),
        provision_password=data.get("provision_password"),
    )


def _resolve_company_id(company_name: str) -> int | None:
    """Look up company_id by name."""
    company = Company.query.filter_by(name=company_name).one_or_none()
    return company.id if company else None


def sync_from_config() -> dict[str, int]:
    """Sync the default (Plant A) Local AD config. Kept for backward compat."""
    config = current_app.config.get("LOCAL_AD")
    if not config:
        raise LocalADSyncError("Local AD configuration is missing.")

    sync_config = _build_sync_config(config)
    company_id = _resolve_company_id("Plant A")
    return run_sync(sync_config, company_id=company_id)


def sync_all_from_config() -> dict[str, object]:
    """Sync all configured AD sources (Plant A + Acme)."""
    ad_configs = Config.get_ad_configs()
    if not ad_configs:
        raise LocalADSyncError("No Local AD configurations found.")

    results: dict[str, object] = {}
    all_emails: set[str] = set()
    total_employees = 0

    for company_name, ad_config in ad_configs.items():
        company_id = _resolve_company_id(company_name)
        current_app.logger.info(
            "Syncing Local AD for %s (company_id=%s)", company_name, company_id
        )
        try:
            sync_config = _build_sync_config(ad_config)
            stats = run_sync(sync_config, company_id=company_id)
            results[company_name] = stats
            all_emails.update(stats.get("emails", []))
            total_employees += stats.get("employees", 0)
        except Exception as exc:
            current_app.logger.error(
                "Local AD sync failed for %s: %s", company_name, exc
            )
            results[company_name] = {"error": str(exc)}

    results["_totals"] = {
        "employees": total_employees,
        "emails": sorted(all_emails),
    }
    return results

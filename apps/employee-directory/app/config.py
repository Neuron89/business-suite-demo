from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)


def _parse_admin_users(raw: str | None) -> Dict[str, str]:
    users: Dict[str, str] = {}
    if not raw:
        return users
    chunks = [chunk.strip() for chunk in raw.split(",") if chunk.strip()]
    for chunk in chunks:
        if ":" not in chunk:
            continue
        username, password = chunk.split(":", 1)
        username = username.strip().lower()
        password = password.strip()
        if username and password:
            users[username] = password
    return users


@dataclass(slots=True)
class GraphConfig:
    tenant_id: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    authority_url: str | None = None
    scope: str | None = None

    @classmethod
    def from_env(cls, prefix: str = "GRAPH") -> "GraphConfig":
        return cls(
            tenant_id=os.getenv(f"{prefix}_TENANT_ID"),
            client_id=os.getenv(f"{prefix}_CLIENT_ID"),
            client_secret=os.getenv(f"{prefix}_CLIENT_SECRET"),
            authority_url=os.getenv(f"{prefix}_AUTHORITY_URL"),
            scope=os.getenv(f"{prefix}_SCOPE", "https://graph.microsoft.com/.default"),
        )


class Config:
    BASE_DIR = BASE_DIR
    GRAPH = GraphConfig.from_env("GRAPH")
    ACME_GRAPH = GraphConfig.from_env("ACME_GRAPH")
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")

    @classmethod
    def get_graph_configs(cls) -> Dict[str, GraphConfig]:
        configs: Dict[str, GraphConfig] = {}
        if cls.GRAPH.tenant_id:
            configs["Plant A"] = cls.GRAPH
        if cls.ACME_GRAPH.tenant_id:
            configs["Acme"] = cls.ACME_GRAPH
        return configs

    @dataclass(slots=True)
    class LocalADConfig:
        server: str | None = None
        base_dn: str | None = None
        user: str | None = None
        password: str | None = None
        provision_user: str | None = None
        provision_password: str | None = None
        ssl: bool = False
        auth: str = "SIMPLE"
        staff_ou: str | None = None
        match_by: str = "EMAIL"

        @classmethod
        def from_env(cls, prefix: str = "LOCAL_AD") -> "Config.LocalADConfig":
            return cls(
                server=os.getenv(f"{prefix}_SERVER"),
                base_dn=os.getenv(f"{prefix}_BASE_DN"),
                user=os.getenv(f"{prefix}_USER"),
                password=os.getenv(f"{prefix}_PASSWORD"),
                provision_user=os.getenv(f"{prefix}_PROVISION_USER"),
                provision_password=os.getenv(f"{prefix}_PROVISION_PASSWORD"),
                ssl=os.getenv(f"{prefix}_SSL", "false").lower() in {"1", "true", "yes"},
                auth=os.getenv(f"{prefix}_AUTH", "SIMPLE"),
                staff_ou=os.getenv(f"{prefix}_STAFF_OU"),
                match_by=os.getenv(f"{prefix}_MATCH_BY", "EMAIL"),
            )

    LOCAL_AD = LocalADConfig.from_env("LOCAL_AD")
    ACME_AD = LocalADConfig.from_env("ACME_AD")
    SCADA_AD = LocalADConfig.from_env("SCADA_AD")

    # Map company names → AD configs for full user-record sync. SCADA is
    # intentionally excluded because we only track presence there, not users.
    @classmethod
    def get_ad_configs(cls) -> Dict[str, "Config.LocalADConfig"]:
        configs: Dict[str, "Config.LocalADConfig"] = {}
        if cls.LOCAL_AD.server:
            configs["Plant A"] = cls.LOCAL_AD
        if cls.ACME_AD.server:
            configs["Acme"] = cls.ACME_AD
        return configs

    # Account lifecycle targets (disable / delete / reset). Plant A is
    # intentionally excluded until we switch focus back to it.
    @classmethod
    def get_lifecycle_ad_configs(cls) -> Dict[str, "Config.LocalADConfig"]:
        configs: Dict[str, "Config.LocalADConfig"] = {}
        if cls.ACME_AD.server:
            configs["Acme"] = cls.ACME_AD
        if cls.SCADA_AD.server:
            configs["SCADA"] = cls.SCADA_AD
        return configs

    @dataclass(slots=True)
    class OnboardingConfig:
        standard_ad_groups: str | None = os.getenv("ONBOARDING_STANDARD_AD_GROUPS")
        distribution_lists: str | None = os.getenv("ONBOARDING_DISTRIBUTION_LISTS")
        home_drive_path: str | None = os.getenv("ONBOARDING_HOME_DRIVE_PATH")
        home_drive_letter: str = os.getenv("ONBOARDING_HOME_DRIVE_LETTER", "H:")
        m365_license_skus: str | None = os.getenv("ONBOARDING_M365_LICENSE_SKUS")
        default_unifi_policies: str | None = os.getenv("ONBOARDING_DEFAULT_UNIFI_POLICIES")

        def get_ad_groups(self) -> list[str]:
            if not self.standard_ad_groups:
                return []
            return [g.strip() for g in self.standard_ad_groups.split(",") if g.strip()]

        def get_distribution_lists(self) -> list[str]:
            if not self.distribution_lists:
                return []
            return [d.strip() for d in self.distribution_lists.split(",") if d.strip()]

        def get_license_skus(self) -> list[str]:
            if not self.m365_license_skus:
                return []
            return [s.strip() for s in self.m365_license_skus.split(",") if s.strip()]

        def get_unifi_policy_ids(self) -> list[str]:
            if not self.default_unifi_policies:
                return []
            return [p.strip() for p in self.default_unifi_policies.split(",") if p.strip()]

    ONBOARDING = OnboardingConfig()

    @dataclass(slots=True)
    class UnifiAccessConfig:
        host: str | None = os.getenv("UNIFI_ACCESS_HOST")
        port: int = int(os.getenv("UNIFI_ACCESS_PORT", "12445"))
        api_token: str | None = os.getenv("UNIFI_ACCESS_API_TOKEN")

        @property
        def base_url(self) -> str:
            return f"https://{self.host}:{self.port}"

        @property
        def configured(self) -> bool:
            return bool(self.host and self.api_token)

    UNIFI_ACCESS = UnifiAccessConfig()

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = (
        os.getenv("SESSION_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
    )

    ADMIN_USERS = _parse_admin_users(os.getenv("APP_ADMIN_USERS"))

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BASE_DIR / 'employee_assets.db').as_posix()}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    EXPORT_DIR = Path(os.getenv("EXPORT_DIR", BASE_DIR / "exports"))


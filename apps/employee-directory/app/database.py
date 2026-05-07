from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, select, text

db = SQLAlchemy()


class TimestampMixin:
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime, server_default=db.func.now(), onupdate=db.func.now()
    )


def _add_columns_if_missing(
    inspector, table: str, column_defs: list[tuple[str, str]]
) -> list[str]:
    if table not in inspector.get_table_names():
        return []
    existing = {col["name"] for col in inspector.get_columns(table)}
    return [
        f"ALTER TABLE {table} ADD COLUMN {name} {dtype}"
        for name, dtype in column_defs
        if name not in existing
    ]


def apply_schema_upgrades() -> None:
    inspector = inspect(db.engine)
    statements: list[str] = []

    statements.extend(
        _add_columns_if_missing(inspector, "software_subscriptions", [
            ("billing_cycle", "VARCHAR(64)"),
            ("cost", "FLOAT"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "lifecycle_events", [
            ("urgency", "VARCHAR(32)"),
            ("it_signoff_name", "VARCHAR(120)"),
            ("it_signoff_date", "DATETIME"),
            ("manager_signoff_name", "VARCHAR(120)"),
            ("manager_signoff_date", "DATETIME"),
            ("delegate_email", "VARCHAR(255)"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "lifecycle_tasks", [
            ("category", "VARCHAR(64)"),
            ("automatable", "BOOLEAN DEFAULT 0"),
            ("automation_key", "VARCHAR(64)"),
            ("requires_confirmation", "BOOLEAN DEFAULT 0"),
            ("completed_by", "VARCHAR(120)"),
            ("assignee_data", "TEXT"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "employees", [
            ("account_type", "VARCHAR(32) DEFAULT 'domain'"),
            ("office_location", "VARCHAR(120)"),
            ("directory_synced_at", "DATETIME"),
            ("directory_sync_error", "TEXT"),
            ("primary_employee_id", "INTEGER REFERENCES employees(id) ON DELETE SET NULL"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "organization_settings", [
            ("company_id", "INTEGER REFERENCES companies(id) ON DELETE CASCADE"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "employees", [
            ("company_id", "INTEGER REFERENCES companies(id) ON DELETE RESTRICT"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "employees", [
            ("initial_password", "VARCHAR(64)"),
        ])
    )

    statements.extend(
        _add_columns_if_missing(inspector, "employees", [
            ("birthday", "DATE"),
        ])
    )

    # Acme Industries portal: per-system access flags + portal role.
    statements.extend(
        _add_columns_if_missing(inspector, "employees", [
            ("has_moc_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_it_access", "BOOLEAN NOT NULL DEFAULT 1"),
            ("has_qc_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_sds_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_complaint_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_iqms_chat_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_employee_db_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_shipping_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("has_it_test_access", "BOOLEAN NOT NULL DEFAULT 0"),
            ("portal_role", "VARCHAR(32) NOT NULL DEFAULT 'employee'"),
            ("moc_role", "VARCHAR(32)"),
        ])
    )

    if not statements:
        return

    with db.engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        # Drop old unique index on setting_key alone (replaced by composite)
        connection.execute(text(
            "DROP INDEX IF EXISTS ix_organization_settings_key"
        ))


_DEFAULT_SETTINGS: list[tuple[str, str, str]] = [
    # (key, label, category)
    ("company_name", "Company Name", "general"),
    ("sharepoint_url", "SharePoint URL", "systems"),
    ("erp_url", "ERP URL", "systems"),
    ("vpn_portal_url", "VPN Portal URL", "systems"),
    ("helpdesk_url", "Helpdesk URL", "systems"),
    ("helpdesk_email", "Helpdesk Email", "systems"),
    ("helpdesk_phone", "Helpdesk Phone", "systems"),
    ("internal_wiki_url", "Internal Wiki URL", "systems"),
    ("wifi_ssid", "WiFi SSID", "network"),
    ("wifi_password", "WiFi Password", "network"),
]


def seed_companies_and_settings() -> None:
    from .models import Company, OrganizationSetting

    # Seed companies (idempotent)
    company_names = ["Plant A", "Acme"]
    companies: dict[str, Company] = {}
    for name in company_names:
        existing = db.session.execute(
            select(Company).where(Company.name == name)
        ).scalar_one_or_none()
        if existing:
            companies[name] = existing
        else:
            company = Company(name=name)
            db.session.add(company)
            db.session.flush()
            companies[name] = company

    # Backfill any existing employees with NULL company_id → assign to Plant A
    plant_a = companies["Plant A"]
    from .models import Employee
    orphan_employees = db.session.execute(
        select(Employee).where(Employee.company_id.is_(None))
    ).scalars().all()
    for emp in orphan_employees:
        emp.company_id = plant_a.id

    # Backfill any existing settings rows with NULL company_id → assign to Plant A
    orphan_rows = db.session.execute(
        select(OrganizationSetting).where(
            OrganizationSetting.company_id.is_(None)
        )
    ).scalars().all()
    for row in orphan_rows:
        row.company_id = plant_a.id

    # Seed default settings for each company
    for company in companies.values():
        existing_keys = {
            row[0]
            for row in db.session.execute(
                select(OrganizationSetting.setting_key).where(
                    OrganizationSetting.company_id == company.id
                )
            ).all()
        }
        for key, label, category in _DEFAULT_SETTINGS:
            if key not in existing_keys:
                db.session.add(
                    OrganizationSetting(
                        setting_key=key,
                        setting_value="",
                        setting_label=label,
                        setting_category=category,
                        company_id=company.id,
                    )
                )

    db.session.commit()


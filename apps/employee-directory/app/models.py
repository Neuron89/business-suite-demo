from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Column, Enum, ForeignKey, Index, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import TimestampMixin, db


unifi_access_policy_doors = Table(
    "unifi_access_policy_doors",
    db.metadata,
    Column(
        "policy_id",
        Integer,
        ForeignKey("unifi_access_policies.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "door_id",
        Integer,
        ForeignKey("unifi_doors.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Company(TimestampMixin, db.Model):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(db.String(120), nullable=False, unique=True)

    settings: Mapped[list["OrganizationSetting"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Company {self.name}>"


class EmployeeStatus(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"
    PENDING = "pending"


class AssetStatus(enum.Enum):
    ASSIGNED = "assigned"
    AVAILABLE = "available"
    IN_REPAIR = "in_repair"
    RETIRED = "retired"


class SubscriptionStatus(enum.Enum):
    ASSIGNED = "assigned"
    AVAILABLE = "available"
    CANCELLED = "cancelled"


class DirectoryGroupSource(enum.Enum):
    LOCAL_AD = "local_ad"
    ENTRA_ID = "entra_id"
    MANUAL = "manual"


class LifecycleEventType(enum.Enum):
    ONBOARDING = "onboarding"
    OFFBOARDING = "offboarding"
    AUDIT = "audit"


class LifecycleStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LifecycleTaskStatus(enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class Employee(TimestampMixin, db.Model):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_email", "email", unique=True),
        Index("ix_employees_employee_number", "employee_number", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_number: Mapped[str | None] = mapped_column(db.String(64))
    first_name: Mapped[str] = mapped_column(db.String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(db.String(120), nullable=False)
    preferred_name: Mapped[str | None] = mapped_column(db.String(120))
    email: Mapped[str] = mapped_column(db.String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(db.String(120))
    title: Mapped[str | None] = mapped_column(db.String(120))
    status: Mapped[EmployeeStatus] = mapped_column(
        Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE, nullable=False
    )
    start_date: Mapped[date | None]
    termination_date: Mapped[date | None]
    birthday: Mapped[date | None]
    manager_email: Mapped[str | None] = mapped_column(db.String(255))
    account_type: Mapped[str | None] = mapped_column(db.String(32), default="domain")
    phone: Mapped[str | None] = mapped_column(db.String(64))
    mobile_phone: Mapped[str | None] = mapped_column(db.String(64))
    extension: Mapped[str | None] = mapped_column(db.String(32))
    office_location: Mapped[str | None] = mapped_column(db.String(120))
    alternate_emails: Mapped[list[str] | None] = mapped_column(db.JSON)
    has_scada_account: Mapped[bool] = mapped_column(db.Boolean, default=False)
    scada_checked_at: Mapped[datetime | None]
    last_synced_at: Mapped[datetime | None]
    directory_synced_at: Mapped[datetime | None]
    directory_sync_error: Mapped[str | None] = mapped_column(db.Text)
    initial_password: Mapped[str | None] = mapped_column(db.String(64))
    notes: Mapped[str | None] = mapped_column(db.Text)

    # Acme Industries portal: per-system access flags. True means the employee should
    # appear as an active user in that system. The portal home page renders
    # tiles only for systems the user has access to.
    has_moc_access: Mapped[bool] = mapped_column(db.Boolean, default=True, nullable=False)
    has_it_access: Mapped[bool] = mapped_column(db.Boolean, default=True, nullable=False)
    has_qc_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_sds_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_complaint_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_iqms_chat_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_employee_db_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_shipping_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    has_it_test_access: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    portal_role: Mapped[str] = mapped_column(db.String(32), default="employee", nullable=False)
    moc_role: Mapped[str | None] = mapped_column(db.String(32))

    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT")
    )
    company: Mapped[Company | None] = relationship(backref="employees")

    primary_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL")
    )
    primary_employee: Mapped["Employee | None"] = relationship(
        "Employee", remote_side="Employee.id", back_populates="linked_accounts"
    )
    linked_accounts: Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="primary_employee"
    )

    hardware_assets: Mapped[list["HardwareAsset"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    software_subscriptions: Mapped[list["SoftwareSubscription"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    m365_devices: Mapped[list["M365Device"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    license_assignments: Mapped[list["M365LicenseAssignment"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    lifecycle_events: Mapped[list["LifecycleEvent"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    directory_groups: Mapped[list["DirectoryGroupMembership"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    unifi_access_user: Mapped["UnifiAccessUser | None"] = relationship(
        back_populates="employee", cascade="all, delete-orphan", uselist=False,
    )

    def __repr__(self) -> str:
        return f"<Employee {self.email}>"

    @property
    def full_name(self) -> str:
        return " ".join([self.first_name, self.last_name]).strip()


class HardwareAsset(TimestampMixin, db.Model):
    __tablename__ = "hardware_assets"
    __table_args__ = (
        Index("ix_hardware_assets_serial", "serial_number", unique=True),
        Index("ix_hardware_assets_asset_tag", "asset_tag", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_type: Mapped[str] = mapped_column(db.String(120), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(db.String(120))
    model: Mapped[str | None] = mapped_column(db.String(120))
    serial_number: Mapped[str | None] = mapped_column(db.String(120))
    asset_tag: Mapped[str | None] = mapped_column(db.String(120))
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus), default=AssetStatus.ASSIGNED, nullable=False
    )
    purchase_date: Mapped[date | None]
    purchase_price: Mapped[float | None]
    assigned_date: Mapped[date | None]
    return_due_date: Mapped[date | None]
    notes: Mapped[str | None] = mapped_column(db.Text)

    employee_id: Mapped[int | None] = mapped_column(
        db.ForeignKey("employees.id", ondelete="SET NULL")
    )
    employee: Mapped[Employee | None] = relationship(back_populates="hardware_assets")


class SoftwareSubscription(TimestampMixin, db.Model):
    __tablename__ = "software_subscriptions"
    __table_args__ = (
        Index(
            "ix_software_subscriptions_license", "license_identifier", unique=True
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(db.String(180), nullable=False)
    vendor: Mapped[str | None] = mapped_column(db.String(120))
    license_identifier: Mapped[str | None] = mapped_column(db.String(180))
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.ASSIGNED, nullable=False
    )
    cost_center: Mapped[str | None] = mapped_column(db.String(120))
    billing_cycle: Mapped[str | None] = mapped_column(db.String(64))
    cost: Mapped[float | None] = mapped_column(db.Float)
    renewal_date: Mapped[date | None]
    assigned_date: Mapped[date | None]
    notes: Mapped[str | None] = mapped_column(db.Text)

    employee_id: Mapped[int | None] = mapped_column(
        db.ForeignKey("employees.id", ondelete="SET NULL")
    )
    employee: Mapped[Employee | None] = relationship(
        back_populates="software_subscriptions"
    )


class DirectoryGroupMembership(TimestampMixin, db.Model):
    __tablename__ = "directory_group_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_name: Mapped[str] = mapped_column(db.String(180), nullable=False)
    group_scope: Mapped[str | None] = mapped_column(db.String(120))
    group_type: Mapped[str | None] = mapped_column(db.String(120))
    description: Mapped[str | None] = mapped_column(db.Text)
    source: Mapped[DirectoryGroupSource] = mapped_column(
        Enum(DirectoryGroupSource),
        default=DirectoryGroupSource.MANUAL,
        nullable=False,
    )

    employee_id: Mapped[int] = mapped_column(
        db.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    employee: Mapped[Employee] = relationship(back_populates="directory_groups")


class M365Device(TimestampMixin, db.Model):
    __tablename__ = "m365_devices"
    __table_args__ = (
        Index("ix_m365_devices_device_id", "device_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(db.String(120), nullable=False)
    display_name: Mapped[str | None] = mapped_column(db.String(255))
    operating_system: Mapped[str | None] = mapped_column(db.String(120))
    compliance_state: Mapped[str | None] = mapped_column(db.String(120))
    last_sync_time: Mapped[datetime | None]
    managed_by: Mapped[str | None] = mapped_column(db.String(120))

    employee_id: Mapped[int | None] = mapped_column(
        db.ForeignKey("employees.id", ondelete="SET NULL")
    )
    employee: Mapped[Employee | None] = relationship(back_populates="m365_devices")


class M365LicenseAssignment(TimestampMixin, db.Model):
    __tablename__ = "m365_license_assignments"
    __table_args__ = (
        Index("ix_m365_license_assignments_sku", "sku_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku_id: Mapped[str] = mapped_column(db.String(120), nullable=False)
    sku_part_number: Mapped[str | None] = mapped_column(db.String(120))
    sku_name: Mapped[str | None] = mapped_column(db.String(255))
    assigned_date: Mapped[datetime | None]

    employee_id: Mapped[int] = mapped_column(
        db.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    employee: Mapped[Employee] = relationship(back_populates="license_assignments")


class LifecycleEvent(TimestampMixin, db.Model):
    __tablename__ = "lifecycle_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[LifecycleEventType] = mapped_column(
        Enum(LifecycleEventType), nullable=False
    )
    status: Mapped[LifecycleStatus] = mapped_column(
        Enum(LifecycleStatus), default=LifecycleStatus.PENDING, nullable=False
    )
    initiated_by: Mapped[str | None] = mapped_column(db.String(120))
    scheduled_for: Mapped[date | None]
    completed_at: Mapped[datetime | None]
    notes: Mapped[str | None] = mapped_column(db.Text)

    urgency: Mapped[str | None] = mapped_column(db.String(32))
    it_signoff_name: Mapped[str | None] = mapped_column(db.String(120))
    it_signoff_date: Mapped[datetime | None]
    manager_signoff_name: Mapped[str | None] = mapped_column(db.String(120))
    manager_signoff_date: Mapped[datetime | None]
    delegate_email: Mapped[str | None] = mapped_column(db.String(255))

    employee_id: Mapped[int] = mapped_column(
        db.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    employee: Mapped[Employee] = relationship(back_populates="lifecycle_events")

    tasks: Mapped[list["LifecycleTask"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class OrganizationSetting(TimestampMixin, db.Model):
    __tablename__ = "organization_settings"
    __table_args__ = (
        Index(
            "ix_organization_settings_key_company",
            "setting_key",
            "company_id",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    setting_key: Mapped[str] = mapped_column(db.String(120), nullable=False)
    setting_value: Mapped[str | None] = mapped_column(db.Text)
    setting_label: Mapped[str] = mapped_column(db.String(180), nullable=False)
    setting_category: Mapped[str] = mapped_column(db.String(64), nullable=False)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE")
    )
    company: Mapped[Company | None] = relationship(back_populates="settings")


class LifecycleTask(TimestampMixin, db.Model):
    __tablename__ = "lifecycle_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(db.String(255), nullable=False)
    task_type: Mapped[str | None] = mapped_column(db.String(120))
    status: Mapped[LifecycleTaskStatus] = mapped_column(
        Enum(LifecycleTaskStatus), default=LifecycleTaskStatus.PENDING, nullable=False
    )
    due_date: Mapped[date | None]
    completed_at: Mapped[datetime | None]
    notes: Mapped[str | None] = mapped_column(db.Text)

    category: Mapped[str | None] = mapped_column(db.String(64))
    automatable: Mapped[bool | None] = mapped_column(db.Boolean, default=False)
    automation_key: Mapped[str | None] = mapped_column(db.String(64))
    requires_confirmation: Mapped[bool | None] = mapped_column(db.Boolean, default=False)
    completed_by: Mapped[str | None] = mapped_column(db.String(120))
    assignee_data: Mapped[str | None] = mapped_column(db.Text)

    event_id: Mapped[int] = mapped_column(
        db.ForeignKey("lifecycle_events.id", ondelete="CASCADE"), nullable=False
    )
    event: Mapped[LifecycleEvent] = relationship(back_populates="tasks")


class UnifiAccessUser(TimestampMixin, db.Model):
    __tablename__ = "unifi_access_users"
    __table_args__ = (
        Index("ix_unifi_access_users_unifi_id", "unifi_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unifi_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    status: Mapped[str] = mapped_column(db.String(32), nullable=False)
    employee_number: Mapped[str | None] = mapped_column(db.String(64))
    avatar_relative_path: Mapped[str | None] = mapped_column(db.String(255))
    phone: Mapped[str | None] = mapped_column(db.String(64))

    employee_id: Mapped[int | None] = mapped_column(
        db.ForeignKey("employees.id", ondelete="SET NULL"), unique=True,
    )
    employee: Mapped[Employee | None] = relationship(back_populates="unifi_access_user")

    nfc_cards: Mapped[list["UnifiNfcCard"]] = relationship(
        back_populates="access_user", cascade="all, delete-orphan",
    )
    access_policies: Mapped[list["UnifiAccessPolicyAssignment"]] = relationship(
        back_populates="access_user", cascade="all, delete-orphan",
    )


class UnifiNfcCard(db.Model):
    __tablename__ = "unifi_nfc_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    card_type: Mapped[str | None] = mapped_column(db.String(32))
    token: Mapped[str | None] = mapped_column(db.String(255))

    access_user_id: Mapped[int] = mapped_column(
        db.ForeignKey("unifi_access_users.id", ondelete="CASCADE"), nullable=False,
    )
    access_user: Mapped[UnifiAccessUser] = relationship(back_populates="nfc_cards")


class UnifiAccessPolicyAssignment(db.Model):
    __tablename__ = "unifi_access_policy_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    policy_name: Mapped[str] = mapped_column(db.String(180), nullable=False)

    access_user_id: Mapped[int] = mapped_column(
        db.ForeignKey("unifi_access_users.id", ondelete="CASCADE"), nullable=False,
    )
    access_user: Mapped[UnifiAccessUser] = relationship(back_populates="access_policies")


class UnifiDoor(db.Model):
    __tablename__ = "unifi_doors"
    __table_args__ = (
        Index("ix_unifi_doors_unifi_id", "unifi_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unifi_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    name: Mapped[str] = mapped_column(db.String(180), nullable=False)
    full_name: Mapped[str | None] = mapped_column(db.String(255))
    floor: Mapped[str | None] = mapped_column(db.String(120))

    policies: Mapped[list["UnifiAccessPolicy"]] = relationship(
        secondary=unifi_access_policy_doors,
        back_populates="doors",
    )


class UnifiSchedule(db.Model):
    __tablename__ = "unifi_schedules"
    __table_args__ = (
        Index("ix_unifi_schedules_unifi_id", "unifi_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unifi_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    name: Mapped[str] = mapped_column(db.String(180), nullable=False)
    schedule_type: Mapped[str | None] = mapped_column(db.String(32))
    week_schedule_json: Mapped[str | None] = mapped_column(db.Text)
    holiday_schedule_json: Mapped[str | None] = mapped_column(db.Text)


class UnifiAccessPolicy(db.Model):
    __tablename__ = "unifi_access_policies"
    __table_args__ = (
        Index("ix_unifi_access_policies_unifi_id", "unifi_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unifi_id: Mapped[str] = mapped_column(db.String(64), nullable=False)
    name: Mapped[str] = mapped_column(db.String(180), nullable=False)
    schedule_id: Mapped[str | None] = mapped_column(db.String(64))

    doors: Mapped[list["UnifiDoor"]] = relationship(
        secondary=unifi_access_policy_doors,
        back_populates="policies",
    )


class DistributionGroupType(enum.Enum):
    M365_UNIFIED = "m365_unified"
    DISTRIBUTION = "distribution"
    MAIL_ENABLED_SECURITY = "mail_enabled_security"


class DistributionGroupMemberRole(enum.Enum):
    MEMBER = "member"
    OWNER = "owner"


class DistributionGroup(TimestampMixin, db.Model):
    __tablename__ = "distribution_groups"
    __table_args__ = (
        Index("ix_distribution_groups_m365_id", "m365_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    m365_id: Mapped[str] = mapped_column(db.String(120), nullable=False)
    display_name: Mapped[str] = mapped_column(db.String(255), nullable=False)
    mail: Mapped[str | None] = mapped_column(db.String(255))
    group_type: Mapped[DistributionGroupType] = mapped_column(
        Enum(DistributionGroupType), nullable=False
    )
    description: Mapped[str | None] = mapped_column(db.Text)
    visibility: Mapped[str | None] = mapped_column(db.String(64))
    hidden_from_gal: Mapped[bool] = mapped_column(db.Boolean, default=False)
    synced_at: Mapped[datetime | None]

    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL")
    )
    company: Mapped["Company | None"] = relationship()

    memberships: Mapped[list["DistributionGroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    send_permissions: Mapped[list["DistributionGroupSendPermission"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class DistributionGroupMember(TimestampMixin, db.Model):
    __tablename__ = "distribution_group_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("distribution_groups.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL")
    )
    external_email: Mapped[str | None] = mapped_column(db.String(255))
    external_display_name: Mapped[str | None] = mapped_column(db.String(255))
    role: Mapped[DistributionGroupMemberRole] = mapped_column(
        Enum(DistributionGroupMemberRole), nullable=False
    )

    group: Mapped[DistributionGroup] = relationship(back_populates="memberships")
    employee: Mapped["Employee | None"] = relationship()


class SuppressedEmail(TimestampMixin, db.Model):
    """Emails that should never be auto-created by directory syncs.

    When a user is purged from the app (but left in Graph / local AD),
    their address goes here so the next sync run doesn't re-import them.
    """
    __tablename__ = "suppressed_emails"
    __table_args__ = (
        Index("ix_suppressed_emails_email", "email", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(db.String(255), nullable=False)
    reason: Mapped[str | None] = mapped_column(db.String(255))
    added_by: Mapped[str | None] = mapped_column(db.String(120))


class ProvisioningJobKind(enum.Enum):
    ONBOARD_DEFAULTS = "onboard_defaults"
    DISABLE_DEFAULTS = "disable_defaults"


class ProvisioningJobStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    PARTIAL = "partial"


class ProvisioningJob(TimestampMixin, db.Model):
    """Queued provisioning work (onboarding defaults, disable cleanup)."""

    __tablename__ = "provisioning_jobs"
    __table_args__ = (
        Index("ix_provisioning_jobs_status_next", "status", "next_run_at"),
        Index("ix_provisioning_jobs_employee", "employee_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL")
    )
    employee_email: Mapped[str | None] = mapped_column(db.String(255))
    employee_name: Mapped[str | None] = mapped_column(db.String(255))
    kind: Mapped[ProvisioningJobKind] = mapped_column(
        Enum(ProvisioningJobKind, name="provisioningjobkind", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
    )
    status: Mapped[ProvisioningJobStatus] = mapped_column(
        Enum(ProvisioningJobStatus, name="provisioningjobstatus", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
        default=ProvisioningJobStatus.PENDING,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    payload_json: Mapped[str | None] = mapped_column(db.Text)
    result_json: Mapped[str | None] = mapped_column(db.Text)
    error: Mapped[str | None] = mapped_column(db.Text)
    next_run_at: Mapped[datetime | None] = mapped_column(db.DateTime)
    started_at: Mapped[datetime | None] = mapped_column(db.DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(db.DateTime)
    triggered_by: Mapped[str | None] = mapped_column(db.String(120))

    employee: Mapped["Employee | None"] = relationship()


class DistributionGroupSendPermission(TimestampMixin, db.Model):
    __tablename__ = "distribution_group_send_permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("distribution_groups.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL")
    )
    external_email: Mapped[str | None] = mapped_column(db.String(255))
    external_display_name: Mapped[str | None] = mapped_column(db.String(255))
    permission_type: Mapped[str] = mapped_column(db.String(32), nullable=False)

    group: Mapped[DistributionGroup] = relationship(back_populates="send_permissions")
    employee: Mapped["Employee | None"] = relationship()


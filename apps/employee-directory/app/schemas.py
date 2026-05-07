from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from . import models


class EmployeeBaseSchema(BaseModel):
    employee_number: str | None = Field(default=None, max_length=64)
    preferred_name: str | None = Field(default=None, max_length=120)
    account_type: (
        Literal["domain", "admin", "service", "shared_mailbox", "third_party"] | None
    ) = None
    department: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=120)
    start_date: date | None = None
    termination_date: date | None = None
    birthday: date | None = None
    manager_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    mobile_phone: str | None = Field(default=None, max_length=64)
    extension: str | None = Field(default=None, max_length=32)
    office_location: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class EmployeeCreateSchema(EmployeeBaseSchema):
    first_name: str = Field(max_length=120)
    last_name: str = Field(max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    email: EmailStr
    status: models.EmployeeStatus = Field(default=models.EmployeeStatus.ACTIVE)


class EmployeeProvisionSchema(EmployeeBaseSchema):
    first_name: str = Field(max_length=120)
    last_name: str = Field(max_length=120)
    email: EmailStr
    password: str | None = None
    force_password_reset: bool = True
    sam_account_name: str | None = Field(default=None, max_length=20)
    status: models.EmployeeStatus = Field(default=models.EmployeeStatus.ACTIVE)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value and len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value

    @field_validator("sam_account_name", mode="before")
    @classmethod
    def normalize_sam(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class EmployeePasswordResetSchema(BaseModel):
    password: str | None = None
    generate: bool = False
    force_password_reset: bool = True
    enable_local_ad: bool = False
    enable_m365: bool = False

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if trimmed and len(trimmed) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return trimmed or None

    @model_validator(mode="after")
    def ensure_password_or_generate(self):
        if not self.password and not self.generate:
            raise ValueError("Provide a password or enable automatic generation.")
        return self


class EmployeeUpdateSchema(EmployeeCreateSchema):
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    status: models.EmployeeStatus | None = None
    has_moc_access: bool | None = None
    has_it_access: bool | None = None
    has_qc_access: bool | None = None
    has_sds_access: bool | None = None
    has_complaint_access: bool | None = None
    has_iqms_chat_access: bool | None = None
    has_employee_db_access: bool | None = None
    has_shipping_access: bool | None = None
    has_it_test_access: bool | None = None
    portal_role: Literal["employee", "manager", "hr", "admin"] | None = None
    moc_role: str | None = Field(default=None, max_length=32)


class EmployeeAccessUpdateSchema(BaseModel):
    """Lightweight schema used by the Access tab to flip per-system flags."""
    has_moc_access: bool | None = None
    has_it_access: bool | None = None
    has_qc_access: bool | None = None
    has_sds_access: bool | None = None
    has_complaint_access: bool | None = None
    has_iqms_chat_access: bool | None = None
    has_employee_db_access: bool | None = None
    has_shipping_access: bool | None = None
    has_it_test_access: bool | None = None
    portal_role: Literal["employee", "manager", "hr", "admin"] | None = None
    moc_role: str | None = Field(default=None, max_length=32)


class HardwareAssetCreateSchema(BaseModel):
    asset_type: str = Field(max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    asset_tag: str | None = Field(default=None, max_length=120)
    status: models.AssetStatus = Field(default=models.AssetStatus.ASSIGNED)
    purchase_date: date | None = None
    purchase_price: float | None = None
    assigned_date: date | None = None
    return_due_date: date | None = None
    notes: str | None = None
    employee_id: int | None = None


class HardwareAssetUpdateSchema(HardwareAssetCreateSchema):
    status: models.AssetStatus | None = None


class SoftwareSubscriptionCreateSchema(BaseModel):
    name: str = Field(max_length=180)
    vendor: str | None = Field(default=None, max_length=120)
    license_identifier: str | None = Field(default=None, max_length=180)
    status: models.SubscriptionStatus = Field(
        default=models.SubscriptionStatus.ASSIGNED
    )
    cost_center: str | None = Field(default=None, max_length=120)
    billing_cycle: str | None = Field(default=None, max_length=64)
    cost: float | None = None
    renewal_date: date | None = None
    assigned_date: date | None = None
    notes: str | None = None
    employee_id: int | None = None


class SoftwareSubscriptionUpdateSchema(SoftwareSubscriptionCreateSchema):
    status: models.SubscriptionStatus | None = None


class DirectoryGroupCreateSchema(BaseModel):
    group_name: str = Field(max_length=180)
    group_scope: str | None = Field(default=None, max_length=120)
    group_type: str | None = Field(default=None, max_length=120)
    description: str | None = None
    source: models.DirectoryGroupSource = Field(
        default=models.DirectoryGroupSource.MANUAL
    )
    employee_id: int

    @field_validator("source", mode="before")
    @classmethod
    def normalize_source(cls, value):
        if isinstance(value, models.DirectoryGroupSource):
            return value
        if isinstance(value, str):
            return models.DirectoryGroupSource(value.lower())
        return value


class DirectoryGroupUpdateSchema(DirectoryGroupCreateSchema):
    group_name: str | None = Field(default=None, max_length=180)
    employee_id: int | None = None


class LifecycleEventCreateSchema(BaseModel):
    event_type: Literal["onboarding", "offboarding", "audit"]
    initiated_by: str | None = Field(default=None, max_length=120)
    scheduled_for: date | None = None
    notes: str | None = None

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_event_type(cls, value: str) -> str:
        return value.lower()


class LifecycleTaskUpdateSchema(BaseModel):
    status: models.LifecycleTaskStatus
    notes: str | None = None
    completed_at: datetime | None = None


class OrganizationSettingItem(BaseModel):
    setting_key: str
    setting_value: str


class OrganizationSettingsBulkUpdateSchema(BaseModel):
    settings: list[OrganizationSettingItem]


from __future__ import annotations

import json
from datetime import date, datetime
from typing import Iterable

from ..database import db
from ..models import (
    Employee,
    HardwareAsset,
    LifecycleEvent,
    LifecycleEventType,
    LifecycleStatus,
    LifecycleTask,
    LifecycleTaskStatus,
)

DEFAULT_ONBOARDING_TASKS: tuple[tuple[str, str], ...] = (
    ("accounts", "Create Microsoft 365 account and assign baseline license"),
    ("hardware", "Prepare primary workstation and accessories"),
    ("software", "Assign required software subscriptions"),
    ("security", "Enroll device in endpoint protection"),
    ("orientation", "Send welcome email with first day details"),
)

DEFAULT_OFFBOARDING_TASKS: tuple[tuple[str, str], ...] = (
    ("accounts", "Disable Microsoft 365 account"),
    ("hardware", "Collect all company-issued hardware"),
    ("software", "Remove software subscriptions and reassign licenses"),
    ("security", "Rotate shared credentials, revoke VPN access"),
    ("hr", "Notify HR of access removal completion"),
)

# ── Full onboarding task catalog ───────────────────────────────────────
# Each entry: (category, description, automation_key | None, risk)
# risk: "auto" = low-risk auto-execute, "confirm" = needs IT approval,
#        "manual" = human-only step

ONBOARDING_TASK_CATALOG: list[tuple[str, str, str | None, str]] = [
    # account_setup
    ("account_setup", "Add to standard AD groups", "add_ad_groups", "auto"),
    ("account_setup", "Add to standard distribution lists", "add_distribution_lists", "auto"),
    ("account_setup", "Assign M365 licenses", "assign_m365_licenses", "confirm"),
    ("account_setup", "Enable M365 sign-in", "enable_m365_signin", "auto"),
    # network_storage
    ("network_storage", "Create home network drive folder", "create_home_drive", "confirm"),
    ("network_storage", "Set NTFS permissions on home drive", "set_home_drive_permissions", "confirm"),
    ("network_storage", "Generate GPO drive-mapping script", "generate_gpo_script", "auto"),
    # manual_setup
    ("manual_setup", "Prepare primary workstation", None, "manual"),
    ("manual_setup", "Install required software", None, "manual"),
    ("manual_setup", "Enroll device in endpoint protection", None, "manual"),
    ("manual_setup", "Configure email signature", None, "manual"),
    # communication
    ("communication", "Send welcome email with first-day details", None, "manual"),
    ("communication", "Schedule IT orientation session", None, "manual"),
    # sign_off
    ("sign_off", "IT technician sign-off", None, "manual"),
    ("sign_off", "Manager sign-off", None, "manual"),
]


# ── Full offboarding task catalog ──────────────────────────────────────
# Each entry: (category, description, automation_key | None, risk)
# risk: "auto" = low-risk auto-execute, "confirm" = needs IT approval,
#        "manual" = human-only step

OFFBOARDING_TASK_CATALOG: list[tuple[str, str, str | None, str]] = [
    # account_access
    ("account_access", "Disable AD account", "disable_ad", "auto"),
    ("account_access", "Move to Offboarded Users OU", "move_ad_ou", "auto"),
    ("account_access", "Reset AD password", "reset_ad_password", "auto"),
    ("account_access", "Remove AD group memberships", "remove_ad_groups", "auto"),
    ("account_access", "Disable VPN access", None, "manual"),
    ("account_access", "Block M365/Entra sign-in", "block_m365_signin", "auto"),
    ("account_access", "Remove MFA methods", "remove_mfa", "auto"),
    ("account_access", "Revoke active sessions/tokens", "revoke_sessions", "auto"),
    ("account_access", "Remove/reassign M365 licenses", "remove_m365_licenses", "confirm"),
    # application_access
    ("application_access", "Remove ERP/Delmia/IQMS access", None, "manual"),
    ("application_access", "Remove VPN/RDP/SCADA access", None, "manual"),
    ("application_access", "Remove internal software access", None, "manual"),
    ("application_access", "Remove from distribution lists", "remove_distribution_lists", "auto"),
    ("application_access", "Remove cloud/SaaS access", None, "manual"),
    ("application_access", "Disable API keys/shared credentials", None, "manual"),
    # network_physical
    ("network_physical", "Remove door badge credentials", None, "manual"),
    ("network_physical", "Disable shared system credentials", None, "manual"),
    # data_transfer
    ("data_transfer", "Transfer SharePoint/Teams ownership", None, "manual"),
    ("data_transfer", "Export mailbox (PST) if needed", None, "manual"),
    ("data_transfer", "Transfer file server home directory", None, "manual"),
    ("data_transfer", "Review and archive critical emails", None, "manual"),
    # record_retention
    ("record_retention", "Retain disabled account for policy duration", None, "manual"),
    ("record_retention", "Archive account after retention", None, "manual"),
    ("record_retention", "Preserve security logs", None, "manual"),
    # sign_off
    ("sign_off", "IT technician sign-off", None, "manual"),
    ("sign_off", "Manager sign-off", None, "manual"),
]

# Conditional tasks: added only when specific options are set
CONDITIONAL_TASKS: dict[str, list[tuple[str, str, str | None, str]]] = {
    "convert_shared_mailbox": [
        ("account_access", "Convert mailbox to shared", "convert_shared_mailbox", "confirm"),
        ("account_access", "Grant shared mailbox access to delegate", "grant_mailbox_access", "confirm"),
    ],
    "litigation_hold": [
        ("account_access", "Enable litigation hold", "enable_litigation_hold", "confirm"),
    ],
    "transfer_onedrive": [
        ("data_transfer", "Transfer OneDrive to delegate", "transfer_onedrive", "confirm"),
    ],
}


def _make_task(
    category: str,
    description: str,
    automation_key: str | None,
    risk: str,
    assignee_data: dict | None = None,
) -> LifecycleTask:
    automatable = risk in ("auto", "confirm")
    requires_confirmation = risk == "confirm"
    return LifecycleTask(
        description=description,
        task_type=category,
        category=category,
        status=LifecycleTaskStatus.PENDING,
        automatable=automatable,
        automation_key=automation_key,
        requires_confirmation=requires_confirmation,
        assignee_data=json.dumps(assignee_data) if assignee_data else None,
    )


def _build_asset_recovery_tasks(employee: Employee) -> list[LifecycleTask]:
    """Generate asset return tasks from the employee's actual hardware."""
    tasks: list[LifecycleTask] = []
    assets = HardwareAsset.query.filter_by(employee_id=employee.id).all()
    if not assets:
        return tasks

    for asset in assets:
        descriptor = " / ".join(
            filter(None, [asset.asset_type, asset.manufacturer, asset.model])
        )
        identifier = asset.serial_number or asset.asset_tag or ""
        label = f"Return: {descriptor}"
        if identifier:
            label += f" ({identifier})"
        tasks.append(
            _make_task(
                "asset_recovery",
                label,
                None,
                "manual",
                assignee_data={"hardware_asset_id": asset.id},
            )
        )

    # Always add these generic asset_recovery tasks
    tasks.append(_make_task("asset_recovery", "Document equipment condition", None, "manual"))
    tasks.append(_make_task("asset_recovery", "Reimage/wipe devices", None, "manual"))
    tasks.append(_make_task("asset_recovery", "Update asset tracking system", None, "manual"))
    return tasks


def _add_tasks(event: LifecycleEvent, tasks: Iterable[tuple[str, str]]) -> None:
    for task_type, description in tasks:
        event.tasks.append(
            LifecycleTask(
                description=description,
                task_type=task_type,
                status=LifecycleTaskStatus.PENDING,
            )
        )


def build_offboarding_tasks(
    employee: Employee,
    *,
    convert_shared_mailbox: bool = False,
    litigation_hold: bool = False,
    delegate_email: str | None = None,
) -> list[LifecycleTask]:
    """Build the full offboarding task list for an employee."""
    tasks: list[LifecycleTask] = []

    # Standard catalog tasks
    for category, description, automation_key, risk in OFFBOARDING_TASK_CATALOG:
        tasks.append(_make_task(category, description, automation_key, risk))

    # Conditional tasks
    if convert_shared_mailbox:
        for entry in CONDITIONAL_TASKS["convert_shared_mailbox"]:
            data = {"delegate_email": delegate_email} if delegate_email else None
            tasks.append(_make_task(*entry, assignee_data=data))

    if litigation_hold:
        for entry in CONDITIONAL_TASKS["litigation_hold"]:
            tasks.append(_make_task(*entry))

    if delegate_email:
        for entry in CONDITIONAL_TASKS["transfer_onedrive"]:
            tasks.append(
                _make_task(*entry, assignee_data={"delegate_email": delegate_email})
            )

    # Smart asset recovery from actual hardware
    tasks.extend(_build_asset_recovery_tasks(employee))

    return tasks


def create_lifecycle_event(
    *,
    employee: Employee,
    event_type: LifecycleEventType,
    initiated_by: str | None = None,
    scheduled_for: date | None = None,
    notes: str | None = None,
) -> LifecycleEvent:
    event = LifecycleEvent(
        employee=employee,
        event_type=event_type,
        status=LifecycleStatus.PENDING,
        initiated_by=initiated_by,
        scheduled_for=scheduled_for,
        notes=notes,
    )

    if event_type == LifecycleEventType.ONBOARDING:
        _add_tasks(event, DEFAULT_ONBOARDING_TASKS)
    elif event_type == LifecycleEventType.OFFBOARDING:
        _add_tasks(event, DEFAULT_OFFBOARDING_TASKS)

    db.session.add(event)
    db.session.commit()
    return event


def create_offboarding_event(
    *,
    employee: Employee,
    initiated_by: str | None = None,
    scheduled_for: date | None = None,
    notes: str | None = None,
    urgency: str = "standard",
    delegate_email: str | None = None,
    convert_shared_mailbox: bool = False,
    litigation_hold: bool = False,
) -> LifecycleEvent:
    """Create an offboarding event with the full enhanced task catalog."""
    event = LifecycleEvent(
        employee=employee,
        event_type=LifecycleEventType.OFFBOARDING,
        status=LifecycleStatus.IN_PROGRESS,
        initiated_by=initiated_by,
        scheduled_for=scheduled_for,
        notes=notes,
        urgency=urgency,
        delegate_email=delegate_email,
    )

    tasks = build_offboarding_tasks(
        employee,
        convert_shared_mailbox=convert_shared_mailbox,
        litigation_hold=litigation_hold,
        delegate_email=delegate_email,
    )
    for task in tasks:
        event.tasks.append(task)

    db.session.add(event)
    db.session.commit()
    return event


def build_onboarding_tasks(employee: Employee) -> list[LifecycleTask]:
    """Build the full onboarding task list for an employee."""
    tasks: list[LifecycleTask] = []
    for category, description, automation_key, risk in ONBOARDING_TASK_CATALOG:
        tasks.append(_make_task(category, description, automation_key, risk))
    return tasks


def create_onboarding_event(
    *,
    employee: Employee,
    initiated_by: str | None = None,
    scheduled_for: date | None = None,
    notes: str | None = None,
) -> LifecycleEvent:
    """Create an onboarding event with the full enhanced task catalog."""
    event = LifecycleEvent(
        employee=employee,
        event_type=LifecycleEventType.ONBOARDING,
        status=LifecycleStatus.IN_PROGRESS,
        initiated_by=initiated_by,
        scheduled_for=scheduled_for,
        notes=notes,
    )

    tasks = build_onboarding_tasks(employee)
    for task in tasks:
        event.tasks.append(task)

    db.session.add(event)
    db.session.commit()
    return event


def complete_event_if_ready(event: LifecycleEvent) -> None:
    pending_tasks = [
        task for task in event.tasks if task.status == LifecycleTaskStatus.PENDING
    ]
    if not pending_tasks and event.status != LifecycleStatus.COMPLETED:
        event.status = LifecycleStatus.COMPLETED
        event.completed_at = datetime.utcnow()
        db.session.commit()

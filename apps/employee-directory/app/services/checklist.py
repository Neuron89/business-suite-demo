from __future__ import annotations

from datetime import datetime

from ..models import (
    DirectoryGroupMembership,
    Employee,
    LifecycleEvent,
    LifecycleEventType,
    LifecycleTask,
    LifecycleTaskStatus,
)
from ..database import db


def _group_has_other_members(group: DirectoryGroupMembership, employee_id: int) -> bool:
    query = DirectoryGroupMembership.query.filter(
        DirectoryGroupMembership.group_name == group.group_name,
        DirectoryGroupMembership.employee_id != employee_id,
    )
    if group.group_scope is not None:
        query = query.filter(DirectoryGroupMembership.group_scope == group.group_scope)
    else:
        query = query.filter(DirectoryGroupMembership.group_scope.is_(None))

    if group.group_type is not None:
        query = query.filter(DirectoryGroupMembership.group_type == group.group_type)
    else:
        query = query.filter(DirectoryGroupMembership.group_type.is_(None))

    return db.session.query(query.exists()).scalar()  # type: ignore[arg-type]


CATEGORY_LABELS = {
    "account_access": "Account & Access",
    "application_access": "Application Access",
    "network_physical": "Network & Physical",
    "data_transfer": "Data Transfer",
    "asset_recovery": "Asset Recovery",
    "record_retention": "Record Retention",
    "sign_off": "Sign-Off",
}

CATEGORY_ORDER = [
    "account_access",
    "application_access",
    "network_physical",
    "data_transfer",
    "asset_recovery",
    "record_retention",
    "sign_off",
]


def _format_task_status(task: LifecycleTask) -> str:
    if task.status == LifecycleTaskStatus.COMPLETED:
        return "[X]"
    if task.status == LifecycleTaskStatus.SKIPPED:
        return "[-]"
    return "[ ]"


def build_enhanced_offboarding_checklist(
    employee: Employee, event: LifecycleEvent
) -> str:
    """Generate a detailed offboarding checklist from actual task data."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    lines.append("=" * 70)
    lines.append(f"OFFBOARDING CHECKLIST — {employee.full_name}")
    lines.append("=" * 70)
    lines.append(f"Employee:  {employee.full_name} ({employee.email})")
    lines.append(f"Department: {employee.department or '—'}")
    lines.append(f"Title:      {employee.title or '—'}")
    lines.append(f"Urgency:    {event.urgency or 'standard'}")
    lines.append(f"Delegate:   {event.delegate_email or 'None'}")
    lines.append(f"Generated:  {timestamp}")
    lines.append(f"Status:     {event.status.value}")
    lines.append("")

    # Group tasks by category
    categories: dict[str, list[LifecycleTask]] = {}
    for task in event.tasks:
        cat = task.category or task.task_type or "other"
        categories.setdefault(cat, []).append(task)

    # Sort categories by defined order
    sorted_cats = [c for c in CATEGORY_ORDER if c in categories]
    for c in categories:
        if c not in sorted_cats:
            sorted_cats.append(c)

    total_tasks = len(event.tasks)
    completed_tasks = sum(
        1 for t in event.tasks
        if t.status in (LifecycleTaskStatus.COMPLETED, LifecycleTaskStatus.SKIPPED)
    )
    lines.append(f"Progress: {completed_tasks}/{total_tasks} tasks completed")
    lines.append("")

    section_num = 0
    for cat in sorted_cats:
        tasks = categories[cat]
        section_num += 1
        label = CATEGORY_LABELS.get(cat, cat.replace("_", " ").title())
        cat_completed = sum(
            1 for t in tasks
            if t.status in (LifecycleTaskStatus.COMPLETED, LifecycleTaskStatus.SKIPPED)
        )
        lines.append("-" * 50)
        lines.append(f"{section_num}. {label} ({cat_completed}/{len(tasks)})")
        lines.append("-" * 50)

        for task in tasks:
            status = _format_task_status(task)
            lines.append(f"   {status} {task.description}")
            details: list[str] = []
            if task.completed_by:
                details.append(f"Completed by: {task.completed_by}")
            if task.completed_at:
                ts = task.completed_at
                if isinstance(ts, datetime):
                    details.append(f"At: {ts.strftime('%Y-%m-%d %H:%M')}")
            if task.notes and not task.notes.startswith("FAILED:"):
                details.append(f"Note: {task.notes}")
            if task.notes and task.notes.startswith("FAILED:"):
                details.append(f"Error: {task.notes}")
            for d in details:
                lines.append(f"       {d}")
        lines.append("")

    # Sign-off section
    lines.append("=" * 50)
    lines.append("SIGN-OFF")
    lines.append("=" * 50)
    if event.it_signoff_name:
        ts = event.it_signoff_date.strftime("%Y-%m-%d %H:%M") if event.it_signoff_date else "—"
        lines.append(f"   IT Technician:  {event.it_signoff_name} ({ts})")
    else:
        lines.append("   IT Technician:  PENDING")
    if event.manager_signoff_name:
        ts = event.manager_signoff_date.strftime("%Y-%m-%d %H:%M") if event.manager_signoff_date else "—"
        lines.append(f"   Manager:        {event.manager_signoff_name} ({ts})")
    else:
        lines.append("   Manager:        PENDING")
    lines.append("")

    # Employee notes
    if employee.notes:
        lines.append("ADDITIONAL NOTES")
        lines.append(f"   {employee.notes}")
        lines.append("")

    lines.append("=" * 70)
    lines.append("END OF CHECKLIST")

    return "\n".join(lines)


def build_offboarding_checklist(employee: Employee) -> str:
    """Generate offboarding checklist. Uses enhanced format if an offboarding event exists."""
    # Check if there's an active offboarding event with the enhanced task catalog
    offboarding_events = [
        e for e in employee.lifecycle_events
        if e.event_type == LifecycleEventType.OFFBOARDING and e.tasks
    ]

    # Use enhanced format if we have an offboarding event with categories
    for event in offboarding_events:
        has_categories = any(t.category for t in event.tasks)
        if has_categories:
            return build_enhanced_offboarding_checklist(employee, event)

    # Fallback to legacy format
    return _build_legacy_checklist(employee)


def _build_legacy_checklist(employee: Employee) -> str:
    """Original checklist format for backward compatibility."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d")
    lines: list[str] = []
    lines.append(f"Offboarding Checklist for {employee.full_name} ({employee.email})")
    lines.append(f"Generated on {timestamp}")
    lines.append("")
    lines.append("1. Accounts")
    lines.append("   - Disable Microsoft 365 / Entra ID account")
    lines.append("   - Remove from distribution lists and shared mailboxes")
    lines.append("   - Revoke VPN and remote access credentials")
    lines.append("")

    lines.append("2. Shared Drives & Folder Permissions")
    orphan_groups: list[DirectoryGroupMembership] = []
    if employee.directory_groups:
        for group in employee.directory_groups:
            descriptor = " - ".join(
                filter(
                    None,
                    [group.group_name, group.group_scope, group.group_type],
                )
            )
            lines.append(f"   - Remove from {descriptor or group.group_name}")
            if not _group_has_other_members(group, employee.id):
                orphan_groups.append(group)
                lines.append(
                    "       ! WARNING: No other members remain. Assign a successor to retain access."
                )
    else:
        lines.append("   - No directory groups recorded")
    lines.append("")

    if orphan_groups:
        lines.append("   * AUTOMATION RECOMMENDED: Provision or reassign ownership for the orphaned groups above to keep shares accessible.")
        lines.append("")

    lines.append("3. Hardware to Collect")
    if employee.hardware_assets:
        for asset in employee.hardware_assets:
            descriptor = " / ".join(
                filter(
                    None,
                    [
                        asset.asset_type,
                        asset.manufacturer,
                        asset.model,
                        asset.serial_number,
                        asset.asset_tag,
                    ],
                )
            )
            lines.append(f"   - {descriptor or 'Unspecified asset'}")
    else:
        lines.append("   - No company hardware recorded")
    lines.append("")

    lines.append("4. Software & Subscriptions to Revoke")
    if employee.software_subscriptions:
        for subscription in employee.software_subscriptions:
            extra = []
            if subscription.license_identifier:
                extra.append(subscription.license_identifier)
            if subscription.billing_cycle:
                extra.append(subscription.billing_cycle)
            if subscription.cost:
                extra.append(f"${subscription.cost:,.2f}")
            descriptor = " • ".join(extra)
            suffix = f" ({descriptor})" if descriptor else ""
            lines.append(f"   - {subscription.name}{suffix}")
    else:
        lines.append("   - No manual subscriptions recorded")
    lines.append("")

    lines.append("5. Microsoft 365 Assets")
    if employee.m365_devices:
        for device in employee.m365_devices:
            lines.append(
                f"   - Device: {device.display_name or device.device_id} "
                f"({device.operating_system or 'Unknown OS'})"
            )
    else:
        lines.append("   - No Intune/Entra devices recorded")

    if employee.license_assignments:
        lines.append("   - Licenses to remove:")
        for assignment in employee.license_assignments:
            lines.append(
                f"       • {assignment.sku_name or assignment.sku_part_number or assignment.sku_id}"
            )
    else:
        lines.append("   - No Microsoft 365 licenses recorded")
    lines.append("")

    lines.append("6. Additional Notes")
    lines.append(f"   - {employee.notes or 'No additional notes'}")

    return "\n".join(lines)

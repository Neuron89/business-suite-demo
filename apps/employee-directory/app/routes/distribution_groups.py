from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..models import (
    DistributionGroup,
    DistributionGroupMember,
    DistributionGroupMemberRole,
    DistributionGroupSendPermission,
    Employee,
    EmployeeStatus,
)

distribution_groups_bp = Blueprint("distribution_groups", __name__)


def _serialize_actor(
    *,
    employee: Employee | None,
    external_email: str | None,
    external_display_name: str | None,
) -> dict:
    if employee is not None:
        return {
            "employee_id": employee.id,
            "display_name": employee.full_name,
            "email": employee.email,
            "status": employee.status.value,
            "external": False,
        }
    return {
        "employee_id": None,
        "display_name": external_display_name or external_email,
        "email": external_email,
        "status": None,
        "external": True,
    }


def _serialize_summary(group: DistributionGroup) -> dict:
    members = [m for m in group.memberships if m.role == DistributionGroupMemberRole.MEMBER]
    owners = [m for m in group.memberships if m.role == DistributionGroupMemberRole.OWNER]
    terminated = sum(
        1
        for m in members
        if m.employee is not None and m.employee.status == EmployeeStatus.TERMINATED
    )
    external = sum(1 for m in members if m.employee is None)
    flags: list[str] = []
    if len(members) == 0:
        flags.append("empty")
    if members and terminated == len(members):
        flags.append("all_terminated")
    if terminated:
        flags.append("has_terminated")
    if external:
        flags.append("has_external")
    return {
        "id": group.id,
        "m365_id": group.m365_id,
        "display_name": group.display_name,
        "mail": group.mail,
        "group_type": group.group_type.value,
        "description": group.description,
        "hidden_from_gal": group.hidden_from_gal,
        "member_count": len(members),
        "owner_count": len(owners),
        "terminated_count": terminated,
        "external_count": external,
        "send_on_behalf_count": len(group.send_permissions),
        "synced_at": group.synced_at.isoformat() if group.synced_at else None,
        "flags": flags,
    }


def _serialize_detail(group: DistributionGroup) -> dict:
    summary = _serialize_summary(group)
    members = sorted(
        [
            _serialize_actor(
                employee=m.employee,
                external_email=m.external_email,
                external_display_name=m.external_display_name,
            )
            for m in group.memberships
            if m.role == DistributionGroupMemberRole.MEMBER
        ],
        key=lambda a: (a["display_name"] or "").lower(),
    )
    owners = sorted(
        [
            _serialize_actor(
                employee=m.employee,
                external_email=m.external_email,
                external_display_name=m.external_display_name,
            )
            for m in group.memberships
            if m.role == DistributionGroupMemberRole.OWNER
        ],
        key=lambda a: (a["display_name"] or "").lower(),
    )
    send_on_behalf = sorted(
        [
            _serialize_actor(
                employee=p.employee,
                external_email=p.external_email,
                external_display_name=p.external_display_name,
            )
            for p in group.send_permissions
            if p.permission_type == "send_on_behalf"
        ],
        key=lambda a: (a["display_name"] or "").lower(),
    )
    return {
        **summary,
        "members": members,
        "owners": owners,
        "send_on_behalf": send_on_behalf,
        "send_as_note": (
            "Send-As permissions for classic distribution lists are not exposed via "
            "Microsoft Graph. Wire up Exchange Online PowerShell to populate them."
        ),
    }


@distribution_groups_bp.route("/", methods=["GET"])
def list_groups():
    query = DistributionGroup.query
    company_id = request.args.get("company_id", type=int)
    if company_id is not None:
        query = query.filter(DistributionGroup.company_id == company_id)
    groups = query.order_by(DistributionGroup.display_name).all()
    return jsonify({"distribution_groups": [_serialize_summary(g) for g in groups]})


@distribution_groups_bp.route("/<int:group_id>", methods=["GET"])
def get_group(group_id: int):
    group = DistributionGroup.query.get_or_404(group_id)
    return jsonify({"distribution_group": _serialize_detail(group)})

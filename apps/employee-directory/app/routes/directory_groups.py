from __future__ import annotations

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from ..database import db
from ..models import DirectoryGroupMembership
from ..schemas import DirectoryGroupCreateSchema, DirectoryGroupUpdateSchema

directory_groups_bp = Blueprint("directory_groups", __name__)


def serialize_group(group: DirectoryGroupMembership) -> dict:
    return {
        "id": group.id,
        "group_name": group.group_name,
        "group_scope": group.group_scope,
        "group_type": group.group_type,
        "description": group.description,
        "source": group.source.value,
        "employee_id": group.employee_id,
    }


@directory_groups_bp.route("/", methods=["GET"])
def list_groups():
    query = DirectoryGroupMembership.query
    employee_id = request.args.get("employee_id", type=int)
    if employee_id:
        query = query.filter(DirectoryGroupMembership.employee_id == employee_id)

    groups = query.order_by(DirectoryGroupMembership.group_name).all()
    return jsonify({"directory_groups": [serialize_group(group) for group in groups]})


@directory_groups_bp.route("/", methods=["POST"])
def create_group():
    payload = request.get_json() or {}
    try:
        data = DirectoryGroupCreateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    group = DirectoryGroupMembership(**data.model_dump())
    db.session.add(group)
    db.session.commit()
    return jsonify({"directory_group": serialize_group(group)}), 201


@directory_groups_bp.route("/<int:group_id>", methods=["PATCH"])
def update_group(group_id: int):
    group = DirectoryGroupMembership.query.get_or_404(group_id)
    payload = request.get_json() or {}
    try:
        data = DirectoryGroupUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)

    db.session.commit()
    return jsonify({"directory_group": serialize_group(group)})


@directory_groups_bp.route("/<int:group_id>", methods=["DELETE"])
def delete_group(group_id: int):
    group = DirectoryGroupMembership.query.get_or_404(group_id)
    db.session.delete(group)
    db.session.commit()
    return jsonify({"status": "deleted"})


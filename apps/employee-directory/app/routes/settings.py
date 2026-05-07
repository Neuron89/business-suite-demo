from __future__ import annotations

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from ..database import db
from ..models import Company, OrganizationSetting
from ..schemas import OrganizationSettingsBulkUpdateSchema

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/companies", methods=["GET"])
def list_companies():
    rows = Company.query.order_by(Company.id).all()
    return jsonify([{"id": c.id, "name": c.name} for c in rows])


@settings_bp.route("/", methods=["GET"])
def list_settings():
    company_id = request.args.get("company_id", type=int)
    if not company_id:
        return jsonify({"error": "company_id query parameter is required"}), 400

    rows = (
        OrganizationSetting.query
        .filter_by(company_id=company_id)
        .order_by(
            OrganizationSetting.setting_category,
            OrganizationSetting.id,
        )
        .all()
    )

    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row.setting_category, []).append(
            {
                "setting_key": row.setting_key,
                "setting_value": row.setting_value or "",
                "setting_label": row.setting_label,
                "setting_category": row.setting_category,
            }
        )

    return jsonify({"settings": grouped})


@settings_bp.route("/", methods=["PUT"])
def bulk_update_settings():
    company_id = request.args.get("company_id", type=int)
    if not company_id:
        return jsonify({"error": "company_id query parameter is required"}), 400

    payload = request.get_json() or {}
    try:
        data = OrganizationSettingsBulkUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    updated = 0
    for item in data.settings:
        row = OrganizationSetting.query.filter_by(
            setting_key=item.setting_key,
            company_id=company_id,
        ).first()
        if row:
            row.setting_value = item.setting_value
            updated += 1

    db.session.commit()
    return jsonify({"status": "ok", "updated": updated})

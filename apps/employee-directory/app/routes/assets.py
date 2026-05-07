from __future__ import annotations

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from ..database import db
from ..models import AssetStatus, HardwareAsset
from ..schemas import HardwareAssetCreateSchema, HardwareAssetUpdateSchema

assets_bp = Blueprint("hardware_assets", __name__)


def serialize_asset(asset: HardwareAsset) -> dict:
    return {
        "id": asset.id,
        "asset_type": asset.asset_type,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "asset_tag": asset.asset_tag,
        "status": asset.status.value,
        "purchase_date": asset.purchase_date.isoformat()
        if asset.purchase_date
        else None,
        "purchase_price": asset.purchase_price,
        "assigned_date": asset.assigned_date.isoformat()
        if asset.assigned_date
        else None,
        "return_due_date": asset.return_due_date.isoformat()
        if asset.return_due_date
        else None,
        "employee_id": asset.employee_id,
        "notes": asset.notes,
    }


@assets_bp.route("/", methods=["GET"])
def list_assets():
    query = HardwareAsset.query

    status = request.args.get("status")
    if status:
        try:
            status_enum = AssetStatus(status)
        except ValueError:
            return (
                jsonify(
                    {
                        "errors": [
                            {
                                "type": "invalid_status",
                                "msg": f"'{status}' is not a valid hardware status",
                            }
                        ]
                    }
                ),
                400,
            )
        query = query.filter(HardwareAsset.status == status_enum)

    employee_id = request.args.get("employee_id", type=int)
    if employee_id:
        query = query.filter(HardwareAsset.employee_id == employee_id)

    assets = query.order_by(HardwareAsset.asset_type).all()
    return jsonify({"hardware_assets": [serialize_asset(asset) for asset in assets]})


@assets_bp.route("/", methods=["POST"])
def create_asset():
    payload = request.get_json() or {}
    try:
        data = HardwareAssetCreateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    asset = HardwareAsset(**data.model_dump())
    db.session.add(asset)
    db.session.commit()
    return jsonify({"hardware_asset": serialize_asset(asset)}), 201


@assets_bp.route("/<int:asset_id>", methods=["PATCH"])
def update_asset(asset_id: int):
    asset = HardwareAsset.query.get_or_404(asset_id)
    payload = request.get_json() or {}
    try:
        data = HardwareAssetUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

    db.session.commit()
    return jsonify({"hardware_asset": serialize_asset(asset)})


@assets_bp.route("/<int:asset_id>", methods=["DELETE"])
def delete_asset(asset_id: int):
    asset = HardwareAsset.query.get_or_404(asset_id)
    db.session.delete(asset)
    db.session.commit()
    return jsonify({"status": "deleted"})


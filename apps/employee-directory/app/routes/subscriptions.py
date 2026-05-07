from __future__ import annotations

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from ..database import db
from ..models import SoftwareSubscription, SubscriptionStatus
from ..schemas import (
    SoftwareSubscriptionCreateSchema,
    SoftwareSubscriptionUpdateSchema,
)

subscriptions_bp = Blueprint("software_subscriptions", __name__)


def serialize_subscription(subscription: SoftwareSubscription) -> dict:
    return {
        "id": subscription.id,
        "name": subscription.name,
        "vendor": subscription.vendor,
        "license_identifier": subscription.license_identifier,
        "status": subscription.status.value,
        "cost_center": subscription.cost_center,
        "billing_cycle": subscription.billing_cycle,
        "cost": subscription.cost,
        "renewal_date": subscription.renewal_date.isoformat()
        if subscription.renewal_date
        else None,
        "assigned_date": subscription.assigned_date.isoformat()
        if subscription.assigned_date
        else None,
        "employee_id": subscription.employee_id,
        "notes": subscription.notes,
    }


@subscriptions_bp.route("/", methods=["GET"])
def list_subscriptions():
    query = SoftwareSubscription.query

    status = request.args.get("status")
    if status:
        try:
            status_enum = SubscriptionStatus(status)
        except ValueError:
            return (
                jsonify(
                    {
                        "errors": [
                            {
                                "type": "invalid_status",
                                "msg": f"'{status}' is not a valid subscription status",
                            }
                        ]
                    }
                ),
                400,
            )
        query = query.filter(SoftwareSubscription.status == status_enum)

    employee_id = request.args.get("employee_id", type=int)
    if employee_id:
        query = query.filter(SoftwareSubscription.employee_id == employee_id)

    subscriptions = query.order_by(SoftwareSubscription.name).all()
    return jsonify(
        {"software_subscriptions": [serialize_subscription(sub) for sub in subscriptions]}
    )


@subscriptions_bp.route("/", methods=["POST"])
def create_subscription():
    payload = request.get_json() or {}
    try:
        data = SoftwareSubscriptionCreateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    subscription = SoftwareSubscription(**data.model_dump())
    db.session.add(subscription)
    db.session.commit()
    return jsonify({"software_subscription": serialize_subscription(subscription)}), 201


@subscriptions_bp.route("/<int:subscription_id>", methods=["PATCH"])
def update_subscription(subscription_id: int):
    subscription = SoftwareSubscription.query.get_or_404(subscription_id)
    payload = request.get_json() or {}
    try:
        data = SoftwareSubscriptionUpdateSchema.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"errors": exc.errors()}), 400

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(subscription, field, value)

    db.session.commit()
    return jsonify({"software_subscription": serialize_subscription(subscription)})


@subscriptions_bp.route("/<int:subscription_id>", methods=["DELETE"])
def delete_subscription(subscription_id: int):
    subscription = SoftwareSubscription.query.get_or_404(subscription_id)
    db.session.delete(subscription)
    db.session.commit()
    return jsonify({"status": "deleted"})


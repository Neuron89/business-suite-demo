from __future__ import annotations

from typing import Iterable, Set

from flask import current_app

from ..database import db
from ..models import Employee


def prune_employees(active_emails: Iterable[str]) -> dict[str, int]:
    """
    Remove employees whose email is no longer present in the active directories.
    """
    normalized: Set[str] = {email.lower() for email in active_emails if email}
    if not normalized:
        current_app.logger.info(
            "Skipping pruning: no active directory emails were provided."
        )
        return {"removed": 0}

    removed = 0
    for employee in Employee.query.all():
        if employee.email.lower() not in normalized:
            current_app.logger.info(
                "Pruning employee %s (email no longer present in directories)",
                employee.email,
            )
            db.session.delete(employee)
            removed += 1

    if removed:
        db.session.commit()

    return {"removed": removed}


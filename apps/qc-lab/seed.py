"""QC Lab demo seed.

Idempotent: runs db.create_all() then inserts demo users + items + lots only
if the users table is empty. Re-running on container restart is a no-op.
"""
import os
from datetime import date, datetime, timedelta
import random

# Ensure DATABASE_URL points somewhere writable in the container
os.environ.setdefault("DATABASE_URL", "sqlite:////app/data/qc_lab.db")

from app import app  # noqa: E402
from models import (  # noqa: E402
    db, User, Item, TestParameter, Lot, SampleSet, TestResult, Supervisor,
)


DEMO_USERS = [
    ("demo.it",       "Ivy Tanaka",      "admin",    True),
    ("demo.hr",       "Hana Reyes",      "operator", True),
    ("demo.manager",  "Marco Goldberg",  "operator", True),
    ("demo.employee", "Eli Park",        "viewer",   False),
]

ITEMS = [
    ("RES-A-200", "Polymer Resin A",   "PA66 base resin, 200 mesh"),
    ("RES-B-150", "Polymer Resin B",   "PA66 with carbon black, 150 mesh"),
    ("CAT-B-12",  "Catalyst B-12",     "Polymerization catalyst, batch lot"),
    ("SOL-C",     "Solvent C",         "Industrial solvent, 99.5% purity"),
    ("ADD-X-04",  "Additive X-04",     "Heat stabilizer additive"),
    ("PLT-Y-7",   "Pellet Y-7",        "Compounded pellet for extrusion"),
]

# Per-item test parameters: (name, unit, min, max)
PARAMS_BY_SKU = {
    "RES-A-200": [
        ("Viscosity",   "cP",   3200, 3600),
        ("Moisture",    "%",    0,    0.25),
        ("Density",     "g/cc", 1.13, 1.16),
        ("Color (L*)",  "",     86,   100),
    ],
    "RES-B-150": [
        ("Viscosity",   "cP",   2800, 3200),
        ("Moisture",    "%",    0,    0.20),
        ("Tensile",     "MPa",  60,   90),
    ],
    "CAT-B-12": [
        ("Active mass", "%",    98,   100),
        ("Water",       "ppm",  0,    100),
    ],
    "SOL-C": [
        ("Purity",      "%",    99,   100),
        ("Acid number", "mg KOH/g", 0, 0.5),
    ],
    "ADD-X-04": [
        ("Melting pt",  "°C",   140,  150),
        ("Ash content", "%",    0,    0.1),
    ],
    "PLT-Y-7": [
        ("Bulk dens.",  "g/cc", 0.55, 0.62),
        ("Pellet sz",   "mm",   2.8,  3.2),
        ("Moisture",    "%",    0,    0.30),
    ],
}


def main():
    with app.app_context():
        db.create_all()

        if User.query.count() > 0:
            print(f"[qc-lab seed] {User.query.count()} users already exist, skipping.")
            return

        print("[qc-lab seed] inserting demo data")

        # Users
        users_by_name = {}
        for username, full_name, role, can_approve in DEMO_USERS:
            u = User(
                username=username, full_name=full_name, role=role,
                can_approve_edits=can_approve, is_active_user=True,
            )
            u.set_password("demo")
            db.session.add(u)
            users_by_name[username] = u
        db.session.flush()

        # Supervisors
        for name in ("Marco Goldberg", "Ivy Tanaka"):
            db.session.add(Supervisor(name=name, is_active=True))

        # Items + their parameters
        items_by_sku = {}
        for sku, name, desc in ITEMS:
            it = Item(item_number=sku, item_name=name, description=desc)
            db.session.add(it)
            items_by_sku[sku] = it
        db.session.flush()

        for sku, params in PARAMS_BY_SKU.items():
            for pname, unit, mn, mx in params:
                db.session.add(TestParameter(
                    item_id=items_by_sku[sku].id,
                    parameter_name=pname, unit=unit,
                    min_value=mn, max_value=mx, is_required=True,
                ))
        db.session.flush()

        # Lots — spread across last ~30 days, varying status
        lot_specs = [
            ("L-2026-0418-A", "RES-A-200", "completed",   18),
            ("L-2026-0420-A", "RES-A-200", "in_progress",  16),
            ("L-2026-0421-B", "RES-B-150", "completed",   15),
            ("L-2026-0423-C", "CAT-B-12",  "flagged",     13),
            ("L-2026-0425-S", "SOL-C",     "completed",   11),
            ("L-2026-0427-X", "ADD-X-04",  "pending",      9),
            ("L-2026-0429-A", "RES-A-200", "completed",    7),
            ("L-2026-0501-Y", "PLT-Y-7",   "in_progress",  5),
            ("L-2026-0503-A", "RES-A-200", "pending",      3),
            ("L-2026-0505-B", "RES-B-150", "in_progress",  1),
        ]

        random.seed(42)
        creator_id = users_by_name["demo.manager"].id
        operator_id = users_by_name["demo.hr"].id

        for lot_no, sku, status, days_ago in lot_specs:
            lot = Lot(
                lot_number=lot_no,
                item_id=items_by_sku[sku].id,
                date_received=date.today() - timedelta(days=days_ago),
                status=status,
                machine=random.choice(["M1", "M2", "M3", None]),
                created_by=creator_id,
                created_at=datetime.now() - timedelta(days=days_ago),
            )
            db.session.add(lot)
            db.session.flush()

            # one default sample set
            ss = SampleSet(lot_id=lot.id, label="A", created_by=creator_id)
            db.session.add(ss)
            db.session.flush()

            # results — randomly within / outside spec, mostly passing
            for pname, unit, mn, mx in PARAMS_BY_SKU[sku]:
                # 85% chance to be in-spec, otherwise just outside
                if random.random() < 0.85:
                    val = round(random.uniform(mn + (mx - mn) * 0.15, mn + (mx - mn) * 0.85), 3)
                    passing = True
                else:
                    val = round(mx + (mx - mn) * 0.05, 3)
                    passing = False
                tr = TestResult(
                    lot_id=lot.id,
                    sample_set_id=ss.id,
                    parameter_name=pname,
                    value=str(val),
                    numeric_value=val,
                    unit=unit,
                    min_spec=mn,
                    max_spec=mx,
                    is_passing=passing,
                    entered_by=operator_id,
                )
                db.session.add(tr)

        db.session.commit()

        print(f"[qc-lab seed] inserted {len(DEMO_USERS)} users, "
              f"{len(ITEMS)} items, {len(lot_specs)} lots, "
              f"{TestResult.query.count()} test results")


if __name__ == "__main__":
    main()

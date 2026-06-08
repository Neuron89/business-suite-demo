"""SDS Portal demo seed.

Idempotent: runs init_db() (creates schema + applies column upgrades) then
inserts the 4 standard demo users + a set of fake SDS product records only if
the users table is empty. Re-running on container restart is a no-op.

The app uses raw sqlite3 (not SQLAlchemy), so we seed via the same db helper.
"""
import os

# Ensure DATABASE_URL points somewhere writable in the container before config
# is imported (config resolves the path at import time).
os.environ.setdefault("DATABASE_URL", "sqlite:////app/data/sds_portal.db")

from werkzeug.security import generate_password_hash  # noqa: E402

import config  # noqa: E402
from db import get_db, init_db  # noqa: E402


# (username/email, full_name, role)
DEMO_USERS = [
    ("demo.it@acme.demo",       "Ivy Tanaka",     "admin"),
    ("demo.hr@acme.demo",       "Hana Reyes",     "admin"),
    ("demo.manager@acme.demo",  "Marco Goldberg", "admin"),
    ("demo.employee@acme.demo", "Eli Park",       "viewer"),
]

# (product_code, product_name, manufacturer, revision_date, hazard_class)
PRODUCTS = [
    ("SDS-NAOH-01", "Sodium Hydroxide 50% Solution", "Olin Chemicals",      "2025-11-04", "Corrosive (GHS05)"),
    ("SDS-ACET-02", "Acetone, Technical Grade",       "Brenntag North America", "2026-01-18", "Flammable Liquid (GHS02)"),
    ("SDS-H2SO4-03","Sulfuric Acid 98%",              "Univar Solutions",    "2025-09-30", "Corrosive (GHS05)"),
    ("SDS-CPL-04",  "Caprolactam, Molten",            "AdvanSix",            "2026-02-12", "Harmful / Irritant (GHS07)"),
    ("SDS-NY6-05",  "Nylon 6 Resin Pellets",          "BASF SE",             "2025-12-01", "Not Classified"),
    ("SDS-TOL-06",  "Toluene, ACS Reagent",           "Honeywell",           "2026-03-05", "Flammable Liquid (GHS02)"),
    ("SDS-IPA-07",  "Isopropyl Alcohol 99%",          "Shell Chemicals",     "2025-10-22", "Flammable Liquid (GHS02)"),
    ("SDS-HCL-08",  "Hydrochloric Acid 37%",          "Olin Chemicals",      "2026-01-09", "Corrosive (GHS05)"),
    ("SDS-MEK-09",  "Methyl Ethyl Ketone",            "ExxonMobil Chemical", "2025-11-27", "Flammable Liquid (GHS02)"),
    ("SDS-NH3-10",  "Ammonia, Anhydrous",             "Nutrien",             "2026-02-28", "Toxic Gas (GHS06)"),
    ("SDS-H2O2-11", "Hydrogen Peroxide 35%",          "Evonik Industries",   "2025-12-15", "Oxidizer (GHS03)"),
    ("SDS-ADP-12",  "Adipic Acid, Flake",             "Ascend Performance",  "2026-03-19", "Irritant (GHS07)"),
    ("SDS-GLY-13",  "Glycerin, USP Grade",            "Cargill",             "2025-08-14", "Not Classified"),
    ("SDS-XYL-14",  "Xylene, Mixed Isomers",          "Chevron Phillips",    "2026-01-31", "Flammable Liquid (GHS02)"),
]


def main():
    init_db()

    db = get_db()
    try:
        count = db.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
        if count > 0:
            print(f"[sds-portal seed] {count} users already exist, skipping.")
            return

        print("[sds-portal seed] inserting demo data")

        for username, full_name, role in DEMO_USERS:
            db.execute(
                'INSERT INTO users (username, password_hash, full_name, role) '
                'VALUES (?, ?, ?, ?)',
                (username, generate_password_hash('demo'), full_name, role)
            )

        for code, name, mfr, rev, hazard in PRODUCTS:
            db.execute(
                'INSERT INTO products (product_code, product_name, manufacturer, '
                'revision_date, hazard_class) VALUES (?, ?, ?, ?, ?)',
                (code, name, mfr, rev, hazard)
            )

        db.commit()
        print(f"[sds-portal seed] inserted {len(DEMO_USERS)} users, "
              f"{len(PRODUCTS)} SDS products")
    finally:
        db.close()


if __name__ == '__main__':
    main()

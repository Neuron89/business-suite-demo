"""Employee Directory demo seed.

Idempotent: runs db.create_all() then inserts demo employees + assets +
subscriptions only if the employees table is empty. Safe to re-run.
"""
import os
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite:////app/data/employee_assets.db")

from app import create_app  # noqa: E402
from app.models import (  # noqa: E402
    db, Company, Employee, EmployeeStatus, Asset, AssetStatus,
    Subscription, SubscriptionStatus,
)


DEMO_USERS = [
    {
        "email": "demo.it@acme.demo", "first": "Ivy", "last": "Tanaka",
        "title": "IT Administrator", "dept": "Information Technology",
        "portal_role": "admin", "company": "Acme — Plant A",
    },
    {
        "email": "demo.hr@acme.demo", "first": "Hana", "last": "Reyes",
        "title": "HR Lead", "dept": "Human Resources",
        "portal_role": "admin", "company": "Acme — Plant A",
    },
    {
        "email": "demo.manager@acme.demo", "first": "Marco", "last": "Goldberg",
        "title": "Plant Manager", "dept": "Operations",
        "portal_role": "manager", "company": "Acme — Plant A",
    },
    {
        "email": "demo.employee@acme.demo", "first": "Eli", "last": "Park",
        "title": "Operator", "dept": "Production",
        "portal_role": "employee", "company": "Acme — Plant A",
        "manager_email": "demo.manager@acme.demo",
    },
]

EXTRA_EMPLOYEES = [
    ("Avery",   "Chen",      "Process Engineer",   "Engineering",          "Acme — Plant A"),
    ("Bailey",  "Mendez",    "Quality Tech",       "QC Lab",               "Acme — Plant A"),
    ("Cameron", "Iqbal",     "Maintenance Lead",   "Maintenance",          "Acme — Plant A"),
    ("Dylan",   "Okonkwo",   "Production Operator", "Production",          "Acme — Plant A"),
    ("Elena",   "Brewer",    "Lab Technician",     "QC Lab",               "Acme — Plant A"),
    ("Finn",    "Saito",     "Logistics Coordinator", "Logistics",         "Acme — Plant A"),
    ("Greta",   "Vasquez",   "Safety Officer",     "EHS",                  "Acme — Plant A"),
    ("Hassan",  "Lewis",     "Production Supervisor", "Production",        "Acme — Plant B"),
    ("Iris",    "Donovan",   "QC Manager",         "QC Lab",               "Acme — Plant B"),
    ("Joaquin", "Petersen",  "Maintenance Tech",   "Maintenance",          "Acme — Plant B"),
    ("Kira",    "Nakamura",  "Process Operator",   "Production",           "Acme — Plant B"),
    ("Luca",    "Brennan",   "EHS Coordinator",    "EHS",                  "Acme — Plant B"),
]

ASSETS = [
    ("LT-DEMO-001", "Laptop",        "ThinkPad T14",     AssetStatus.ASSIGNED, "demo.it@acme.demo"),
    ("LT-DEMO-002", "Laptop",        "ThinkPad T14",     AssetStatus.ASSIGNED, "demo.hr@acme.demo"),
    ("LT-DEMO-003", "Laptop",        "ThinkPad T14",     AssetStatus.ASSIGNED, "demo.manager@acme.demo"),
    ("PH-DEMO-014", "Phone",         "iPhone 15",        AssetStatus.ASSIGNED, "demo.manager@acme.demo"),
    ("MN-DEMO-021", "Monitor",       "Dell U2723QE",     AssetStatus.ASSIGNED, "demo.it@acme.demo"),
    ("LT-DEMO-099", "Laptop",        "Spare ThinkPad",   AssetStatus.AVAILABLE, None),
    ("PH-DEMO-099", "Phone",         "Spare iPhone",     AssetStatus.AVAILABLE, None),
    ("PR-DEMO-002", "Printer",       "HP LaserJet Pro",  AssetStatus.IN_REPAIR, None),
]

SUBSCRIPTIONS = [
    ("M365 Business Premium", "Microsoft", 5, SubscriptionStatus.ASSIGNED),
    ("Salesforce Standard",   "Salesforce", 3, SubscriptionStatus.ASSIGNED),
    ("Adobe Creative Cloud",  "Adobe",      1, SubscriptionStatus.ASSIGNED),
    ("Slack Pro",             "Slack",     12, SubscriptionStatus.ASSIGNED),
    ("Zoom Pro",              "Zoom",       4, SubscriptionStatus.AVAILABLE),
]


def main():
    app = create_app()
    with app.app_context():
        if Employee.query.count() > 0:
            print(f"[edir seed] {Employee.query.count()} employees exist, skipping.")
            return

        # Companies (seed_companies_and_settings creates the legacy ones,
        # so add ours and ignore conflicts on name)
        company_by_name = {c.name: c for c in Company.query.all()}
        for cname in ("Acme — Plant A", "Acme — Plant B"):
            if cname not in company_by_name:
                co = Company(name=cname)
                db.session.add(co)
                db.session.flush()
                company_by_name[cname] = co

        def add_employee(first, last, title, dept, company_name, email=None, portal_role="employee", manager_email=None):
            e = Employee(
                first_name=first,
                last_name=last,
                email=email or f"{first.lower()}.{last.lower()}@acme.demo",
                title=title,
                department=dept,
                status=EmployeeStatus.ACTIVE,
                start_date=date(2024, 6, 1),
                portal_role=portal_role,
                manager_email=manager_email,
                has_moc_access=True,
                has_it_access=True,
                has_qc_access=True,
                has_shipping_access=True,
                has_iqms_chat_access=True,
                has_employee_db_access=True,
                company_id=company_by_name[company_name].id,
            )
            db.session.add(e)
            return e

        # Demo users
        for u in DEMO_USERS:
            add_employee(
                u["first"], u["last"], u["title"], u["dept"], u["company"],
                email=u["email"], portal_role=u["portal_role"],
                manager_email=u.get("manager_email"),
            )

        # Extra employees
        for first, last, title, dept, company in EXTRA_EMPLOYEES:
            add_employee(first, last, title, dept, company,
                         manager_email="demo.manager@acme.demo")

        db.session.flush()

        # Assets
        for asset_tag, kind, model, status, assigned_email in ASSETS:
            assigned_to = None
            if assigned_email:
                emp = Employee.query.filter_by(email=assigned_email).first()
                assigned_to = emp.id if emp else None
            db.session.add(Asset(
                asset_tag=asset_tag,
                category=kind,
                model=model,
                status=status,
                assigned_to_id=assigned_to,
            ))

        # Subscriptions
        for name, vendor, seats, status in SUBSCRIPTIONS:
            db.session.add(Subscription(
                name=name,
                vendor=vendor,
                seat_count=seats,
                status=status,
            ))

        db.session.commit()
        print(f"[edir seed] inserted {Employee.query.count()} employees, "
              f"{Asset.query.count()} assets, "
              f"{Subscription.query.count()} subscriptions")


if __name__ == "__main__":
    main()

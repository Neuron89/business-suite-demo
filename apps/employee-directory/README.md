# Employee Directory

IT's system of record for people and the equipment assigned to them: employees,
hardware assets, software subscriptions, directory and distribution groups, and
onboarding/offboarding checklists. Part of the
[Acme Industries Business Suite demo](../../README.md).

## What it does

- Employee records with profile editing, org/company assignment, and status.
- Hardware asset and software subscription tracking per employee.
- Onboarding and offboarding wizards that generate task checklists.
- Directory groups and distribution groups views.
- Exports: Excel inventory snapshot, user list, and a phone directory (PDF and Excel).
- Directory API consumed by the Portal and the Onboarding app (`/api/directory/...`).
- Portal single sign-on via `GET /sso` (verifies the portal-issued JWT).

The production version also syncs with on-prem Active Directory, Microsoft 365
(Microsoft Graph) and a door-access system, and can provision accounts. That
code is still in `app/services/`, but in the demo no credentials are configured
and the background sync scheduler is disabled (`DEMO_MODE=true`), so the app
works purely from seeded data.

## Stack

| Layer | Technology |
|---|---|
| API | Flask, SQLAlchemy, Pydantic, served by Waitress on port 5065 |
| Database | SQLite (`/app/data/employee_assets.db` in the container) |
| Frontend | React + TypeScript, built with Vite and served by Flask |
| Reports | openpyxl (Excel), ReportLab (PDF) |

## Layout

```
employee-directory/
├── app/
│   ├── routes/      REST endpoints (employees, assets, subscriptions, groups, auth, ...)
│   ├── services/    reporting, lifecycle checklists, and the stubbed sync/provisioning code
│   ├── models.py    SQLAlchemy models
│   └── config.py    environment-driven settings
├── frontend/        React/Vite single-page app
├── seed.py          idempotent demo seed (fictional employees, assets, subscriptions)
├── run.py           production entry point (Waitress)
└── Dockerfile       two-stage build: Vite frontend, then Python runtime
```

## Running

The app is built and started by the suite's `docker-compose.yml`; see the
top-level README. On container start it runs `seed.py` (a no-op once seeded)
and then `run.py`.

To run it on its own:

```bash
pip install -r requirements.txt
(cd frontend && npm install && npx vite build)
DATABASE_URL=sqlite:///employee_assets.db python seed.py
DATABASE_URL=sqlite:///employee_assets.db python run.py     # http://localhost:5065
```

## Configuration

| Variable | Purpose | Demo value |
|---|---|---|
| `SECRET_KEY` | Flask session signing key | set in compose |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:////app/data/employee_assets.db` |
| `APP_ADMIN_USERS` | `user:password` pairs allowed to sign in directly | `demo:demo` |
| `PORTAL_SSO_SECRET` | Shared secret used to verify portal SSO tokens | shared with the portal |
| `DEMO_MODE` | Disables the background sync scheduler | `true` |
| `SESSION_COOKIE_SECURE` | Set `false` when served over plain HTTP | `false` |

# Management of Change (MOC)

Manages the full lifecycle of Management of Change requests in a chemical
manufacturing plant, built around process-safety (PSM) requirements. Part of
the [Acme Industries Business Suite demo](../../README.md).

## Features

- **Lifecycle workflow**: draft → submitted → risk assessment → under review →
  approved → implementing → PSSR pending → PSSR complete → closed.
- **5x5 risk matrix** with before/after-controls scoring, plus a risk sandbox.
- **Multi-department review**: required approvers sign off before a request advances.
- **PSSR checklists**: Pre-Startup Safety Review templates and sign-off.
- **Action items, EHS incidents and request templates.**
- **Public dashboard**: a no-login stats page with open MOCs, risk distribution and workflow funnel.
- **Audit trail**: every action logged with JSONB change diffs.
- **Full-text search** across titles, descriptions and justifications (PostgreSQL `tsvector`).
- **Attachments, in-app notifications, reports and CSV export.**
- **Admin panel** for users, roles and templates.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Recharts (port 3000) |
| Backend | Express + TypeScript (port 4000) |
| Database | PostgreSQL with Knex migrations |
| Auth | JWT access + refresh tokens, role-based access control, portal SSO |
| Validation | Zod schemas shared between client and server |
| Monorepo | npm workspaces (`packages/shared`, `server`, `client`) |

## Layout

```
moc/
├── packages/shared/   shared types, Zod schemas, constants
├── server/src/
│   ├── middleware/    auth, RBAC, audit, validation
│   ├── routes/        moc, risk, review, workflow, pssr, dashboard, users, audit, ...
│   ├── services/      workflow engine, notifications, email
│   └── db/            Knex migrations and the demo seed
└── client/src/
    ├── app/           pages: /, /login, /sso, /dashboard, /moc, /audit, /admin, /reports, ...
    ├── components/
    └── lib/           API client, auth context
```

## Running

Built and started by the suite's `docker-compose.yml` (migrations and the demo
seed run on container start). To run it on its own you need Node.js 20 and
PostgreSQL:

```bash
npm install
createdb moc_db
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET in the environment
npm run migrate
npm run seed
npm run dev        # API on :4000, client on :3000
```

In the demo, users arrive from the portal already signed in. The seeded demo
accounts (`demo.it@acme.demo`, `demo.manager@acme.demo`, `demo.employee@acme.demo`,
...) can also sign in directly when `ALLOW_PASSWORD_LOGIN=true`.

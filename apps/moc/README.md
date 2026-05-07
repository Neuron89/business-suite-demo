# Management of Change (MOC) — Nylon Manufacturing Facility

A full-stack web application for managing the complete lifecycle of Management of Change (MOC) requests in a nylon-from-base-chemicals manufacturing environment. Inspired by VelocityEHS, tailored for chemical manufacturing with PSM compliance.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + Recharts |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL with Knex.js migrations |
| Auth | JWT (access + refresh tokens) with role-based access control |
| Validation | Zod (shared between client & server) |
| Monorepo | npm workspaces |

## Features

- **Full MOC Lifecycle Workflow**: draft → submitted → risk assessment → under review → approved → implementing → PSSR pending → PSSR complete → closed
- **5x5 Risk Matrix**: Chemical-manufacturing-specific severity/likelihood scales with before/after controls
- **3-Role Approval System**: EHS, Operations, and QC must all approve before advancement
- **PSSR Checklists**: Pre-Startup Safety Review with nylon-manufacturing-specific templates (44 items across 10 categories)
- **Public Dashboard**: No-login stats page with charts showing open MOCs, risk distribution, and workflow funnel
- **Audit Trail**: Immutable log of every action with JSONB change diffs
- **Full-Text Search**: PostgreSQL tsvector-based search across MOC titles, descriptions, and justifications
- **File Attachments**: Upload/download support for PDF, Word, Excel, CSV, and images
- **In-App Notifications**: Role-based notifications for workflow transitions
- **Reports**: Charts and CSV export for PSM compliance reporting
- **User Management**: Admin panel for creating users, changing roles, and deactivating accounts

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: user management, all workflow transitions, audit log |
| **EHS** | Risk assessments, reviews, PSSR management, audit log, workflow transitions |
| **Operations** | MOC creation, reviews, implementation management, PSSR |
| **QC** | MOC creation, reviews, quality-related approvals |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# Clone and install
git clone https://github.com/Neuron89/managment_of_change.git
cd managment_of_change
npm install

# Build shared package
npm run build -w packages/shared

# Configure database
cp server/.env.example server/.env
# Edit server/.env with your PostgreSQL credentials

# Create database
createdb moc_db

# Run migrations and seed demo data
npm run migrate
npm run seed

# Start development servers (API :4000, Client :3000)
npm run dev
```

### Demo Accounts

All accounts use password: `admin123!`

| Email | Role |
|-------|------|
| admin@facility.local | Admin |
| ehs@facility.local | EHS |
| ops@facility.local | Operations |
| qc@facility.local | QC |

### Demo MOC Requests

The seed includes 8 realistic MOCs at various workflow stages:

| # | Title | Status | Risk |
|---|-------|--------|------|
| 1 | Replace Polymerization Reactor Heat Exchanger | Closed | High |
| 2 | Modify Caprolactam Feed Rate Control Logic | Under Review | Medium |
| 3 | Add Titanium Dioxide Slurry Mixing Tank | Risk Assessment | -- |
| 4 | Upgrade Spinning Area Emergency Shower System | Implementing | Medium |
| 5 | Change Nylon 6,6 Salt Solution Concentration | Draft | -- |
| 6 | Bypass Cooling Water Treatment System | Rejected | High |
| 7 | Emergency Repair of HMD Storage Tank Level Transmitter | Submitted | -- |
| 8 | Install Automated Polymer Viscosity Analyzer | PSSR Pending | Low |

## Project Structure

```
managment_of_change/
├── packages/shared/          # Shared types, Zod schemas, constants
├── server/                   # Express API (:4000)
│   └── src/
│       ├── middleware/        # auth, rbac, audit, validation
│       ├── routes/            # auth, moc, risk, review, workflow, pssr, dashboard, users, audit, notifications, attachments
│       ├── services/          # workflow engine, notifications, risk-level
│       └── db/                # Knex migrations (9) and seeds
├── client/                   # Next.js frontend (:3000)
│   └── src/
│       ├── app/              # Pages: /, /login, /dashboard, /moc, /audit, /admin, /reports
│       ├── components/       # layout, dashboard, moc, risk, review, pssr, shared
│       └── lib/              # API client, auth context
└── deploy/                   # nginx config, systemd services, backup script
```

## Deployment

```
[Facility Network] → [Nginx :80/:443] → Next.js :3000 + Express :4000 → PostgreSQL :5432
                                                                              ↓
                                                                    pg_dump → Cloud Backup
```

See `deploy/` directory for nginx config, systemd service files, and automated backup script.

## Database

9 migration files creating 10 tables: `users`, `moc_requests`, `risk_assessments`, `reviews`, `workflow_history`, `pssr_checklists`, `pssr_items`, `attachments`, `audit_log`, `notifications`.

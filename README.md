# Acme Industries Business Suite — Demo

A self-contained, public demo of an internal business suite: a portal that ties
together six purpose-built tools (MOC, IT Tickets, Shipping, QC Lab, AI ERP
chat, Employee Directory) under a single sign-on.

> **Demo data only.** All names, emails, and records are fictional. The portal
> uses a 4-user dropdown instead of real SSO. The IQMS Chat and Employee
> Directory have their external integrations stubbed.

---

## Install

Self-hosted behind a Caddy reverse proxy + a Cloudflare tunnel — one subdomain
per app under `${DEMO_DOMAIN}`. Requires **Docker** + **Docker Compose v2**.

```bash
git clone https://github.com/Neuron89/business-suite-demo.git
cd business-suite-demo
bash install.sh        # writes .env, then stops
nano .env              # set DEMO_DOMAIN + CLOUDFLARE_TUNNEL_TOKEN
bash install.sh        # builds + starts (add the tunnel automatically)
```

Full home-server walkthrough + Cloudflare DNS/tunnel setup: **[deploy/DEPLOY-HOME.md](deploy/DEPLOY-HOME.md)**.

When it's up (default domain shown):

| App                | URL                                  |
|--------------------|--------------------------------------|
| Portal             | https://demo.haydennester.com        |
| MOC                | https://moc.demo.haydennester.com    |
| IT Request         | https://it.demo.haydennester.com     |
| Shipping           | https://ship.demo.haydennester.com   |
| QC Lab             | https://qc.demo.haydennester.com     |
| IQMS Chat          | https://chat.demo.haydennester.com   |
| Employee Directory | https://dir.demo.haydennester.com    |
| Complaint Tracker  | https://complaints.demo.haydennester.com |
| SDS Portal         | https://sds.demo.haydennester.com    |
| Onboarding         | https://onboarding.demo.haydennester.com |

No DNS yet? Smoke-test locally: `curl -H 'Host: moc.demo.haydennester.com' http://localhost:8080/api/health`.

Open the portal, pick one of the four roles below from the dropdown, and click
any tile to land in that app already signed in. Data resets nightly.

---

## Demo users

| Role     | What they can do                                                       |
|----------|------------------------------------------------------------------------|
| IT       | Full admin everywhere; assigned to IT tickets; manages employee dir    |
| HR       | Onboarding-focused; admin in MOC + Employee Directory                  |
| Manager  | Approves MOCs and tickets; views shipping + QC dashboards              |
| Employee | Submits MOCs and IT tickets; read-only on most modules                 |

---

## What's in the suite

- **Portal** — landing page, SSO bridge, announcements, task aggregation across
  all apps. Next.js + Express + Postgres.
- **MOC** (Management of Change) — change request workflow with risk
  assessment, multi-stage review, dept routing. Next.js + Express + Postgres.
- **IT Request** — ticketing system: hardware/software/access/onboarding.
  Manager review → IT review → resolution. Next.js + Express + Postgres.
- **Shipping** — freight cost dashboard. Carriers, rate book, lane history.
  Next.js + Express + Postgres. (In production, syncs from an Oracle ERP — the
  sync is disabled in the demo.)
- **QC Lab** — quality control: items, lots, sample sets, parameter tests.
  Flask + SQLite.
- **IQMS Chat** — natural-language chat against an ERP. (In production, the
  backend spawns Claude with MCP tools that query Oracle. **The demo stubs the
  backend with canned responses** — try asking about "production", "lots",
  "shipments", "inventory".) Flask.
- **Employee Directory** — IT asset tracking, onboarding/offboarding
  workflows, AD/M365 integration. (In production, syncs with multiple Entra
  tenants and an on-prem AD. **Sync is stubbed in the demo.**) Flask + Vite.

---

## Architecture sketch

```
                ┌─────────────────────────┐
                │       Postgres 16        │
                │ portal / moc / it / ship │
                └────────────┬─────────────┘
                             │
   ┌───────┬─────────────┬───┴────┬──────────┬──────────┬─────────────┐
   │portal │     moc     │   it   │ shipping │  qc-lab  │ iqms-chat   │
   │ Next  │     Next    │  Next  │   Next   │  Flask   │   Flask     │
   │+Express│   +Express │+Express│ +Express │ +SQLite  │ (stubbed)   │
   └───┬───┴─────────────┴────────┴──────────┴──────────┴─────────────┘
       │ mints SSO JWT (HS256, shared secret) on tile click
       │
       └─→ each downstream app exchanges the JWT for its own session,
           auto-creating the user on first login
```

The portal mints a 5-minute SSO token signed with `PORTAL_SSO_SECRET`. Every
downstream app verifies that signature and accepts the user. No cross-app
cookies; each app has its own session storage.

---

## Project layout

```
business-suite-demo/
├── install.sh              one-line installer
├── docker-compose.yml      brings up the whole suite
├── docker/postgres/        init script that creates per-app databases
├── apps/
│   ├── portal/             Next.js + Express
│   ├── moc/                Next.js + Express
│   ├── it-request/         Next.js + Express
│   ├── shipping/           Next.js + Express
│   ├── qc-lab/             Flask + SQLite
│   ├── iqms-chat/          Flask (frontend stubbed)
│   └── employee-directory/ Flask + Vite (services stubbed)
└── docs/screenshots/       README assets
```

---

## What's stubbed out

To keep the demo self-contained:

- **Microsoft / Entra OAuth** — login is a 4-user dropdown instead.
- **Outlook SMTP** — email-sending services log to stdout.
- **Oracle / IQMS ERP sync** — the shipping app reads from a seeded
  `shipments` table; sync_iqms job is disabled.
- **IQMS Chat backend** — the `subprocess(claude …)` + MCP-server pipeline is
  replaced with canned responses keyed off keywords in your question.
- **AD / M365 / UniFi services** in Employee Directory — all return
  `{status: "demo_mode"}` placeholders. CRUD on the seeded data still works.

The original code paths are kept in the repo (with feature flags) so you can
see how they're structured.

---

## Tear down

```bash
docker compose -f ~/business-suite-demo/docker-compose.yml down       # stop
docker compose -f ~/business-suite-demo/docker-compose.yml down -v    # stop + wipe data
```

---

## License

MIT — see [LICENSE](LICENSE).

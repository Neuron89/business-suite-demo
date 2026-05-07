# Shipping Command

Head-of-shipping operations dashboard for Acme Industries. Replaces `Freight Cost.xlsx`.

## What it does

- **Nightly IQMS sync** pulls shipments, BOLs, freight, and inventory into Postgres so he arrives to a pre-populated dashboard.
- **Rate book** (carriers, lanes, effective dates) drives auto-cost defaults on new shipments.
- **Weekly FSC** (fuel surcharge) fed from EIA diesel retail price.
- **Routing distance/time** from Acme Industries + Lowell to each ship-to, cached (OSRM).
- **Dashboards**: today's shipments, cost × customer/state/carrier, per-lb, MMR monthly, inventory (Acme Industries vs Lowell).

## Stack

- Next.js 15 + Express 4 + PostgreSQL (Knex) + OracleDB (read-only IQMS).
- Ports: client :3030, server :4030.
- DB: `shipping_db` (user `demo`).

## Scope

- **Acme Industries only** (EPLANT_ID = 2). Lowell warehouse = `LOCATIONS.ID 29713`.
- Head of shipping uses daily; read-only IQMS (no writes back).

## Dev

```bash
npm install
# create DB + run migrations
createdb shipping_db
npm run migrate
npm run seed
npm run dev
```

## Env files

- `server/.env` — DB + JWT + IQMS + EIA keys (see `.env.example`)
- `client/.env.local` — `NEXT_PUBLIC_API_URL`

## Nightly sync

Systemd timer runs `npm run sync:iqms` at 05:00. See `deploy/shipping-command-sync.{service,timer}`.

## Access

Shipping Command has its own `users` table in `shipping_db` — it does **not** share auth with MOC or any other app. Seeded accounts (change passwords on first login):

| Email | Role | Initial password |
|---|---|---|
| `rpereira@acme.demo` | shipping_head | `ShipCmd!change` |
| `demo.it@acme.demo` | admin | `ShipCmd!change` |

Add more users from **Settings → Users** (admin only).

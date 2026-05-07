# Portal (Acme Demo)

Internal landing page that ties the suite together. Serves SSO, task
aggregation, announcements, suggestion box.

In the demo, login is a 4-user dropdown (see top-level README). In the original
deployment this app integrates with Microsoft Entra ID OAuth — that code is
left in `server/src/routes/microsoft_auth.ts` for reference but is gated on
`AZURE_CLIENT_ID` being set.

Stack: Next.js 15 + Express 4 + Postgres + Knex.

- Server: `server/src/index.ts` (port 4070)
- Client: `client/` (port 3070)
- Migrations: `server/src/db/migrations/`
- Seeds: `server/src/db/seeds/` (`001_demo_users.ts` for the demo)

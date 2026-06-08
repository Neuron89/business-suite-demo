# IT-View Cleanups + Ping Notifications — Design & Plan

**Date:** 2026-06-01 · **App:** `/home/hnester/onboarding-system` (Express :4080 + Next :3080, db `onboarding_db`)
**Mode:** Autonomous (user requested no input). Decisions documented below.

## Requirements (from user)
1. IT Close-Out: remove the **Deny** button (keep Approve & Provision).
2. Remove **Resolution Notes** (use comments instead).
3. **Merge comments + history** into one feed; make comment/note text **larger & easier to read**.
4. **Ping** feature: IT can ping **manager / HR / EHS** for info (e.g., "desk area ready?"); the ping shows up on the recipient's portal so they know they need to act.
5. Remove the **Ticket Management** card — **keep the code but hide it**.

## Decisions (no-input judgment calls)
- **Ping target = role** (`manager` | `hr` | `ehs`). Recipients are users with that role (matches the role-based test users; per-user targeting can come later).
- **Surfacing = `/onboarding` list page** (the de-facto home; `/dashboard` just redirects there). An "Action needed" banner lists the current user's open pings with a deep link + "Mark done". Each ping create/resolve also writes a `ticket_history` row, so it appears in the unified activity feed automatically.
- **Who pings:** `it_admin` (scoped to the request; endpoint/UI extensible later).
- **Resolution Notes removed** from UI; the `resolution_notes` column stays in the DB (harmless), just unused.
- **Deny endpoint stays** server-side (`it-close` still accepts `denied`); only the UI button is removed.
- **Ticket Management** hidden behind a `const SHOW_TICKET_MANAGEMENT = false` flag (code kept).

## Data model — migration `007_pings.ts`
`pings`: `id` (incr), `ticket_id` (FK tickets, cascade), `from_user_id` (FK users), `to_role` (string), `message` (text), `status` (string default `'open'`), `created_at` (default now), `resolved_at` (nullable), `resolved_by` (FK users nullable). Index on `(to_role, status)`.

## Shared schema (`packages/shared/src/schemas.ts`)
```ts
export const pingCreateSchema = z.object({
  ticket_id: z.number().int(),
  to_role: z.enum(['manager', 'hr', 'ehs']),
  message: z.string().min(1, 'A message is required'),
});
```

## API — new `server/src/routes/pings.ts`, mounted `/api/pings`
- `POST /api/pings` — `authorize('it_admin')`, body `pingCreateSchema`. Insert ping; insert a `ticket_history` row on `ticket_id` (`from=to=ticket.status`, comment `Pinged {to_role}: {message}`). 201 + ping.
- `GET /api/pings/mine` — `authenticate`. Open pings where `to_role = req.user.role`, joined to tickets (`request_number`, `title`). Newest first.
- `POST /api/pings/:id/resolve` — `authenticate`. Allowed if `req.user.role === ping.to_role || req.user.role === 'it_admin'`. Set `status='done'`, `resolved_at=now`, `resolved_by`; history row `Ping resolved by {name}`.
Register in `server/src/index.ts` (`pingsRoutes` → `/api/pings`).

## Client
- `lib/api.ts`: `createPing(token,{ticket_id,to_role,message})`, `getMyPings(token)`, `resolvePing(token,id)`.
- `onboarding/page.tsx` (list/home): a `PingsBanner` at top — fetches `getMyPings`, lists open pings (message + ticket link + from + time) with a **Mark done** button (`resolvePing` → refetch). Hidden when none.
- `onboarding/[id]/page.tsx`:
  - **Remove** the IT Close-Out **Deny** button (keep Approve & Provision; keep `handleItClose`).
  - **Remove** the Resolution Notes editable card and the read-only resolution display.
  - **Hide** Ticket Management behind `const SHOW_TICKET_MANAGEMENT = false;` (render gated; code kept).
  - **Merge** Comments + History into one **Activity** card: build a single array tagging each item `kind:'comment'|'event'`, sort by `created_at` asc; render events as the status-dot line, comments as larger bubbles (`text-base`, more padding/leading); comment input stays at the bottom. Remove the separate History card.
  - Add a **Ping for info** card for `it_admin`: role select (Manager/HR/EHS) + message textarea + Send (`createPing` → reload).

## Testing / validation
No JS test framework — `tsc`/build + API curl. After `knex migrate:latest`: as it_admin, `POST /api/pings` for a ticket → 201; as that role, `GET /api/pings/mine` shows it; `POST /api/pings/:id/resolve` → done; confirm a ticket_history row was written on create. Typecheck the three client files. Clean up test rows.

## Out of scope
Per-user (vs role) ping targeting; cross-app NYCOA-portal surfacing; removing the `resolution_notes` column; pings for non-onboarding tickets.

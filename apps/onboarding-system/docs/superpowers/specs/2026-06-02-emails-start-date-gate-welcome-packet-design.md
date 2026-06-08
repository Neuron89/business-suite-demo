# Email Flow + Manager Start-Date Gate + Welcome Packet + Reminders — Design & Plan

**Date:** 2026-06-02 · **App:** `/home/hnester/onboarding-system` (Express :4080 + Next :3080, db `onboarding_db`) + Employee Tech Doc (`:5065`)
**Mode:** Autonomous build (user reviews at the end). Decisions documented; validate via the test sandbox.

## Requirements
1. **Email on activity:** every submission and every comment/note emails `it@nycoa.com`, the ticket's hiring manager, and `hiring@nycoa.com`.
2. **New manager start-date gate:** manager submits → HR + IT notified → HR confirms receipt → HR submits employee info **with a request to the manager for the start date** → **manager sets the start date** → IT final approval → completed.
3. **Welcome packet:** on IT approval, after credentials land in the employee DB, the ETD onboarding welcome packet is auto-emailed to HR + hiring manager.
4. **Start-date reminders:** the manager-set start date drives automated reminder emails at multiple offsets ("starting in 3 days", "…tomorrow").

## Decisions (no-input judgment calls)
- **Recipients** are a reusable "core set" = unique(`IT_NOTIFY_EMAIL` [default `it@nycoa.com`], ticket manager email, `HIRING_NOTIFY_EMAIL` [default `hiring@nycoa.com`]). Configurable via `server/.env`.
- **Test-safe:** the email service **log-only (no real send)** when the ticket's requester is a test user (`is_test`), so the test sandbox can be validated without spamming real inboxes. (Also already no-ops if SMTP unconfigured.)
- **Welcome packet:** ETD gains a **service-token** endpoint returning the packet HTML by email; onboarding fetches it and sends via its own (already-graceful) email service. Avoids wiring SMTP into ETD.
- **Reminders:** a dependency-free in-process daily scheduler (`setInterval`) in the onboarding server; offsets from `REMINDER_OFFSETS` (default `7,3,1`); dedup via `onboarding_details.reminders_sent`.
- **Start date** lives in `onboarding_details.start_date` (set by the manager step; consumed by directory sync + packet + reminders). HR's step no longer collects it.

## Workflow (new gate)
```
manager submit (v2)        → hr_fill          [email: core set — HR+IT+manager notified]
HR confirm receipt         → hr_searching     (existing)
HR submit identity + start_date_request → manager_start_date   [NEW status; email: manager set-start]
manager sets start_date    → it_close         [email: IT for final approval]
IT approve                 → completed:
   - directory sync (existing) → credentials in employee DB
   - fetch ETD welcome packet → email to HR + hiring manager
   - schedule start-date reminders
reminder scheduler         → emails at REMINDER_OFFSETS days before start_date
```
- New status **`manager_start_date`** ("Manager — Start Date", color `#f97316`). Migration `008` extends `tickets_status_check`; constants add label/color/kanban-open.
- **`hr-fill` change:** `start_date` no longer required; add optional `start_date_request` (text note to the manager). Transition `hr_searching → manager_start_date` (was `→ it_close`).
- **New endpoint `POST /tickets/:id/set-start-date`** (`authorize('manager','it_admin')`, body `{ start_date }`): requires `flow_version===2 && status==='manager_start_date'`; merges `start_date` into `onboarding_details`; transition `→ it_close`; history + email IT.

## Backend pieces

### Shared (`packages/shared/src/schemas.ts`)
- `hrFillSchema`: change `start_date` from required to **removed**; add `start_date_request: z.string().optional()`. (Keep other fields.)
- Add `setStartDateSchema = z.object({ start_date: z.string().min(1, 'Start date is required') })`.

### Migration `008_manager_start_date.ts`
Extend `tickets_status_check` to add `'manager_start_date'` (full list: draft, submitted, manager_review, it_review, hr_fill, hr_searching, manager_start_date, it_close, approved, denied, in_progress, waiting, completed, cancelled). `down` reverts to the 006 list.

### constants.ts
`REQUEST_STATUSES` add `'manager_start_date'` after `hr_searching`; `STATUS_LABELS.manager_start_date='Manager — Start Date'`; `STATUS_COLORS.manager_start_date='#f97316'`; add to `KANBAN_COLUMNS` `open` statuses.

### email.ts (extend)
- Helper `coreRecipients(ticket)` → the core set (env + manager email from `onboarding_details.manager_email` or `manager_id`).
- Test guard: `sendBulk` (or a wrapper) skips real send + logs when `ticket`'s requester `is_test` is true; expose a `notify(ticketId, subject, html)` that loads the ticket+requester to decide. Simplest: add `isTestRequester(ticket)` and have each notify fn pass through.
- `notifyOnboardingCreated`: recipients → core set (was manager+it_admins).
- New `notifyActivity(ticket, actorName, body, kind)` — fired on comment/note; subject `[Onboarding] New {kind} — {request_number}`, core set.
- New `notifyManagerSetStartDate(ticket)` — fired when ticket enters `manager_start_date`; to the manager (+core), "Please set the start date".
- New `notifyReadyForItClose(ticket)` — fired when ticket enters `it_close`; core set.
- New `sendWelcomePacket(ticket, html)` — to HR (requester) + manager, subject `[Onboarding] Welcome packet — {name}`, body = the ETD packet HTML.
- New `notifyStartReminder(ticket, daysOut)` — core set, "New employee {name} starting {in N days|tomorrow|today}".

### tickets.ts
- Create handler: keep `notifyOnboardingCreated` (now core set).
- `hr-fill`: transition to `manager_start_date` (not it_close); history `hr_searching→manager_start_date`; fire `notifyManagerSetStartDate`.
- New `set-start-date` route (above); fire `notifyReadyForItClose`.
- `it-close` approve path (after status=completed + directory sync): fetch welcome packet (new `directory.ts` fn `fetchWelcomePacket(ticket)`) → `sendWelcomePacket`; also `notifyOnboardingCompleted` (existing, optional). Scheduling is automatic (scheduler scans completed tickets), no per-call wiring needed.
- Comments route (`POST /:id/comments`): after insert, fire `notifyActivity`.

### directory.ts (onboarding)
- New exported `fetchWelcomePacket(ticket)`: derive work email (reuse `deriveWorkEmail`), GET `{DIRECTORY_BASE_URL}/api/directory/employees/{email}/welcome-packet` with `X-Service-Token`; return `{ ok, html }`. Best-effort.

### ETD (`app/routes/directory.py`)
- New `@require_service_token` route `GET /employees/<email>/welcome-packet`: look up employee by email (case-insensitive), 404 if missing; `from ..services.welcome_packet import build_welcome_packet_html`; return `{ "html": build_welcome_packet_html(emp, emp.company_id) }`. (Mirrors existing `get_directory_employee` lookup.)

### Reminder scheduler (`server/src/services/reminders.ts`, started in `index.ts`)
- `startReminderScheduler()`: run `tick()` on boot and every 6h.
- `tick()`: load completed onboarding tickets with `onboarding_details.start_date` in the future; for each offset in `REMINDER_OFFSETS` (default `[7,3,1]`), if `daysUntil(start) === offset` and offset not in `reminders_sent`, call `notifyStartReminder(ticket, offset)` and append offset to `onboarding_details.reminders_sent` (persist). Dedup prevents re-send within a day's multiple ticks.

## Client
- `lib/api.ts`: `setStartDate(token,id,{start_date})`.
- `onboarding/[id]/page.tsx`:
  - `HrFillForm`: remove the **start date** input; add an optional **"Requested start date / note to manager"** textarea (`start_date_request`). Submit no longer sends `start_date`.
  - Add gating `canSetStartDate = flow_version===2 && status==='manager_start_date' && (isManager || isAdmin)` and a **"Set start date"** card (date input + submit → `setStartDate`). Show the HR `start_date_request` note in that card for context.
  - The Role/Identity rendering already shows `start_date` once set.
- `onboarding/new` + list: no change (statuses come from shared constants; the list "open" filter already includes open statuses via kanban — `manager_start_date` will appear under open).

## Env (`server/.env`)
```
IT_NOTIFY_EMAIL=it@nycoa.com
HIRING_NOTIFY_EMAIL=hiring@nycoa.com
REMINDER_OFFSETS=7,3,1
```
(`SMTP_PASS` to be set by Hayden with the new mailbox account.)

## Testing / validation (test sandbox)
After `knex migrate:latest`: API walkthrough with test users — manager submit → `hr_fill`; HR confirm → `hr_searching`; HR `hr-fill` (with `start_date_request`, no start_date) → `manager_start_date`; manager `set-start-date` → `it_close`; IT approve → `completed`. Verify: emails are **logged** (test requester → no real send) at submit, comment, each transition, and packet; welcome-packet fetch returns HTML (ETD reachable); reminder `tick()` selects a completed ticket with an upcoming start date and logs the reminder + records `reminders_sent`. Typecheck all. Clean up test rows.

## Out of scope / needs Hayden
- **SMTP creds** (`SMTP_PASS`) for the new mailbox — emails log-only until set.
- Real cron/timer hardening (in-process interval is fine for now).
- Per-recipient unsubscribe; HTML email theming polish.

# Onboarding Intake Form Changes — Design

**Date:** 2026-06-01
**App:** `/home/hnester/onboarding-system` (Express :4080 + Next.js :3080, db `onboarding_db`)
**Related app:** Employee Tech Doc (`/home/hnester/employee_tech_documentation`, Flask :5065) — canonical owner of the department/job-title catalog and the M365-synced distribution-group mirror.

## Goal

Validate the v2 manager-first onboarding intake flow and make a focused set of
changes to the new-hire requisition form (`client/src/app/(authenticated)/onboarding/new/page.tsx`):

1. Office/building examples → NYCOA (Factory / Office).
2. Trim the Accounts & Access section.
3. Distribution lists → live multi-select from the M365 mirror.
4. Let a manager add a job title that isn't in the catalog, persisted only after HR accepts.

## Context (current state)

- The intake form is the **v2 manager-first** flow: a manager submits the role +
  IT requirements; the ticket lands at `hr_fill`; HR adds the hire's identity
  (`POST /tickets/:id/hr-fill`, `hr_fill → it_close`); IT closes it
  (`POST /tickets/:id/it-close`, `it_close → completed`), which fires the ETD
  directory sync.
- Job titles + departments are fetched read-only from ETD via the onboarding
  proxy `server/src/routes/lookups.ts` (`/api/lookups/departments`,
  `/api/lookups/job-titles`), which forwards to ETD's `lookups_bp`.
- The title field is a `<select>` grouped by department; the department field
  free-text auto-fills from the chosen title.
- `managerOnboardingDetailsSchema` (`packages/shared/src/schemas.ts`) is
  permissive; `onboarding_details` is a JSONB blob.
- The directory sync (`server/src/services/directory.ts`, `deriveWorkEmail`)
  already falls back to the `firstinitial+lastname@nycoa.com` convention when
  `email_alias_preference` is absent.
- ETD already maintains an M365-synced `DistributionGroup` mirror and exposes
  `GET /api/distribution-groups/` (returns `display_name`, `mail`, `company_id`,
  member counts, etc.), refreshed by `app/services/m365_sync.py`.
- ETD's lookups endpoints are **read-only** today; the file notes "a future
  admin UI" for curation.

## Changes

### 1. Office / building → NYCOA

Field stays **free-text**. NYCOA has two locations: **Factory** and **Office**.
The factory has 5 floors, kept as free text (not hardcoded as options).

- `new/page.tsx` `OFFICES` test-data array → `['NYCOA Office', 'NYCOA Factory – 1st floor', 'NYCOA Factory – 2nd floor', 'NYCOA Factory – 3rd floor', 'NYCOA Factory – 4th floor', 'NYCOA Factory – 5th floor']`.
- Office field placeholder → `e.g., NYCOA Office, or NYCOA Factory – 3rd floor`.

### 2. Accounts & Access section trim (form-only)

Remove three fields from the "Accounts & access" `<Section>` in `new/page.tsx`:

- **Email alias preference** — drop the field and stop sending
  `email_alias_preference`. Safe: `deriveWorkEmail` already falls back to the
  `firstinitial+lastname` convention.
- **Security groups** — remove the field; stop sending `security_groups`
  (derived from department + role downstream).
- **Network drives** — remove the field; stop sending `network_drives`.

The corresponding Zod fields in `managerOnboardingDetailsSchema` **remain**
(permissive, harmless) so no downstream consumer (directory push, IT view)
needs to change yet. The form simply omits them from the submit payload, and
the related `useState` hooks + `splitList` calls are removed.

### 3. Distribution lists → live multi-select dropdown

Replace the free-text comma field with a **multi-select** populated from the
M365-synced mirror.

- **New onboarding proxy route** `GET /api/lookups/distribution-groups` in
  `server/src/routes/lookups.ts`, forwarding to ETD
  `GET /api/distribution-groups/` (same `forward()` pattern). Filtered to
  NYCOA's company (pass ETD's NYCOA `company_id`).
- The dropdown displays the friendly `display_name`; the submitted
  `distribution_lists` array stores the real `mail` address.
- **`all@nycoa.com` is auto-applied to every hire** — not shown as a
  selectable option; always included in the submitted `distribution_lists`.
- Tradeoff (accepted): the list is an M365 *mirror* refreshed by ETD's sync
  job, not a real-time Graph call. "Live" to within the sync cadence; reuses
  ETD's existing Graph credentials and avoids duplicating the integration.
- If the proxy is unreachable, the dropdown is empty but `all@nycoa.com` is
  still applied; submission is not blocked.

### 4. Manager can add a new role (persisted only after HR accepts)

- Add an **"+ Role not listed"** entry to the title `<select>`. Selecting it
  reveals a text input for the new title label. The new role is tied to the
  **department** the manager selects. Departments stay prebuilt — only the
  title can be new.
- On submit, `onboarding_details` carries the typed `job_title`, a
  `job_title_is_new: true` flag, and the `department`. (`job_title_is_new` is
  added to `managerOnboardingDetailsSchema` / `onboardingDetailsSchema` as an
  optional boolean.)
- **Deferred persistence:** in `POST /tickets/:id/hr-fill` (the HR-accept
  step), after the status transition, if `job_title_is_new` is set and the
  title still isn't in the catalog, the server calls a **new ETD endpoint**
  `POST /api/lookups/job-titles` with `{ label, key (derived slug),
  department_id (resolved from department name), sort_order, active }`.
- **New ETD write endpoint** `POST /api/lookups/job-titles` in
  `app/routes/lookups.py`: validates the department exists, derives a `key`
  slug from the label, inserts a `JobTitle`, returns the created row.
  Idempotent on `label` (unique) — if it already exists, return the existing
  row rather than erroring.
- The call from onboarding is **best-effort and non-blocking** (logged on
  failure, same pattern as the directory sync) so a catalog hiccup never locks
  a ticket. The role still lives on the ticket regardless.

## Components touched

| Layer | File | Change |
|---|---|---|
| Onboarding client | `client/src/app/(authenticated)/onboarding/new/page.tsx` | Office examples; remove 3 fields; DL multi-select; "+ Role not listed" UI + new-role state |
| Onboarding client | `client/src/lib/api.ts` | `getDistributionGroups()` client fn + types |
| Onboarding server | `server/src/routes/lookups.ts` | New `GET /distribution-groups` proxy |
| Onboarding server | `server/src/routes/tickets.ts` | In `hr-fill`, persist new role to ETD (best-effort) |
| Shared | `packages/shared/src/schemas.ts` | Add optional `job_title_is_new` |
| ETD server | `app/routes/lookups.py` | New `POST /job-titles` write endpoint |

No onboarding DB migration required (new flag lives in the existing
`onboarding_details` JSONB).

## Error handling

- DL proxy down → empty dropdown, `all@nycoa.com` still applied, submit works.
- ETD job-title create fails at HR-accept → logged, ticket still advances to
  `it_close`; role remains on the ticket.
- Duplicate label on `POST /job-titles` → returns existing row (idempotent).

## Testing / validation

- **Pre-change:** walk the v2 manager-first path end-to-end (submit →
  `hr_fill` → hr-fill → `it_close` → it-close → `completed`), confirming
  prebuilt departments/roles load in the dropdown. Use the app's test-mode
  (`is_test` autofill) and the `test-app` recipe if one exists for onboarding,
  else manual.
- **Post-change:** new role added by manager appears in ETD catalog only after
  the hr-fill step; DL dropdown lists NYCOA groups by friendly name and submits
  real addresses with `all@nycoa.com` always present; the three removed fields
  are gone from the form and absent from the submitted payload; office
  placeholder/test data reflect NYCOA.

## Out of scope

- Removing the retained schema fields (`email_alias_preference`,
  `security_groups`, `network_drives`) from the backend/downstream consumers.
- A general admin UI for catalog curation in ETD.
- Department creation by managers (departments stay prebuilt).
- Real-time (non-mirrored) Graph distribution-group lookups.

# HR-Focused View + Confirm/Search Workflow — Design

**Date:** 2026-06-01
**App:** `/home/hnester/onboarding-system` (Express :4080 + Next.js :3080, db `onboarding_db`)

## Goal

Make the onboarding ticket easier for HR to act on: (1) show HR a recruiting-focused view that hides the IT/tech requirements, prominently surfacing who requested it, the role, the job needs, and the desired candidate profile; (2) add an explicit HR "confirm receipt" step with a note, followed by an editable employee-search status they update while recruiting, before they fill the hire's identity.

## Workflow (one new status)

```
manager submits (v2) → hr_fill ("Awaiting HR")
  → HR confirm receipt (+required note)   → hr_searching ("HR — Searching")   [NEW]
       → HR edits employee-search status   (stays hr_searching)
       → HR fills hire identity            → it_close
            → IT close & provision         → completed
```

- The identity-fill form now appears **only in `hr_searching`** (after confirm), matching "confirm → search → fill". One extra click for HR before identity entry.
- `hr_fill` relabels "Needs HR" → **"Awaiting HR"**; new `hr_searching` → **"HR — Searching"**, color `#14b8a6`, in the kanban "Open" column.
- Backward-compatible: in-flight `hr_fill` tickets simply gain the confirm step; v1 flow and closed tickets are untouched.

## Data model

- **Manager requisition**: new `desired_candidate_profile` (string, optional) in `onboarding_details`, captured on the requisition form's "The role" section. The existing `manager_notes` ("Anything else for HR/IT") stays.
- **New status `hr_searching`**: migration `006` extends the `tickets_status_check` CHECK constraint to include it (see migration 005 for the existing list). Added to shared constants.
- **HR acknowledgment**: new ticket column `hr_ack_at` (timestamptz, nullable) via migration `006` — symmetry with existing `hr_fill_at`/`it_close_at`. The confirm note is recorded in `ticket_history`.
- **Employee-search status**: `employee_search_status` (string) + `employee_search_updated_at` (ISO string) stored in `onboarding_details` JSONB (no migration).

## Field grouping for the detail view

**Role & Requisition card (shown to everyone):**
`manager_name`/requester, `job_title`, `department`, `employment_type`, `work_location`, `office_location`, `target_start_date`, ticket `urgency`, **`desired_candidate_profile`** (prominent), `manager_notes`; plus hire identity once filled: `full_name`, `preferred_name`, `employee_number`, `badge_number`, `start_date`, `personal_email`, `phone`, `hr_notes`.

**IT Requirements card (hidden when role === 'hr'; shown to it_admin/manager):**
`needs_laptop`, `laptop_preference`, `needs_monitor`, `monitor_count`, `needs_phone`, `needs_headset`, `other_equipment`, `needs_m365`, `needs_vpn`, `software_needed`, `shared_mailboxes`, `distribution_lists`, `security_groups`, `network_drives`, `similar_to_employee_email`, `email_alias_preference`.

**Neither card (internal/derived):** `job_title_is_new`, `employee_search_status`, `employee_search_updated_at` — the search status renders in the HR status line instead; `job_title_is_new` is hidden.

**HR status line (shown to all roles):** "HR acknowledged ✓ {hr_ack_at}" when set, and "Search status: {employee_search_status} (updated {employee_search_updated_at})" when present — so managers/IT can see HR progress.

## API (server/src/routes/tickets.ts)

- `POST /tickets/:id/hr-confirm` — `authorize('hr','it_admin')`, body `hrConfirmSchema {note}` (note required). Requires `flow_version===2 && status==='hr_fill'`. Sets `status='hr_searching'`, `hr_ack_at=now`; history `hr_fill→hr_searching`, comment `HR confirmed receipt: <note>`.
- `POST /tickets/:id/hr-search-update` — `authorize('hr','it_admin')`, body `hrSearchUpdateSchema {search_status}`. Requires `flow_version===2 && status==='hr_searching'`. Merges `employee_search_status` + `employee_search_updated_at=now` into `onboarding_details`; history row (`hr_searching→hr_searching`) comment `HR search update: <search_status>`. No status change.
- `POST /tickets/:id/hr-fill` (modify) — required status changes from `hr_fill` to `hr_searching`; history `from_status` becomes `hr_searching`.

## Shared (packages/shared/src)

- `schemas.ts`: add `desired_candidate_profile: z.string().optional()` to `managerOnboardingDetailsSchema`; add `hrConfirmSchema = z.object({ note: z.string().min(1, 'A note is required') })` and `hrSearchUpdateSchema = z.object({ search_status: z.string().min(1, 'Search status is required') })`; export both from `index.ts`.
- `constants.ts`: insert `'hr_searching'` into `REQUEST_STATUSES` after `'hr_fill'`; `STATUS_LABELS.hr_fill='Awaiting HR'`, add `hr_searching:'HR — Searching'`; `STATUS_COLORS.hr_searching='#14b8a6'`; add `'hr_searching'` to the `open` `KANBAN_COLUMNS` entry's `statuses`.

## Client

- `lib/api.ts`: `hrConfirm(token,id,{note})`, `hrSearchUpdate(token,id,{search_status})`.
- `onboarding/new/page.tsx`: add `desiredCandidateProfile` state, a textarea in the "The role" section, and `desired_candidate_profile` in the submit payload.
- `onboarding/[id]/page.tsx`:
  - Replace the generic `DetailsCard title="New Hire Information"` (for onboarding tickets) with a **Role & Requisition** card (recruiting fields, labeled, with desired profile emphasized) + an **IT Requirements** card gated on `!isHR`. Non-onboarding detail cards (hardware/software/etc.) keep the generic `DetailsCard`.
  - Add the **HR status line** (ack + search status), visible to all.
  - Add **Confirm receipt** card: `status==='hr_fill' && (isHR||isAdmin)` — required notes textarea + button → `hrConfirm`.
  - Add **Employee Search** card: `status==='hr_searching' && (isHR||isAdmin)` — editable field prefilled from `employee_search_status`, "Save update" → `hrSearchUpdate`, shows last-updated.
  - Change `HrFillForm` gating from `status==='hr_fill'` to `status==='hr_searching'`.
  - Add `handleHrConfirm` / `handleHrSearchUpdate` handlers (pattern of existing `handleItClose`).

## Error handling / edge cases

- Confirm and search-update both require non-empty body (Zod `min(1)`).
- `hr-fill` returns 400 if called before `hr_searching` (UI gates this; defense at API).
- `hr-confirm` rejects if not `hr_fill`; `hr-search-update` rejects if not `hr_searching` — clear 400 messages.
- HR-acknowledged / search-status render read-only for manager/IT.

## Testing / validation

No JS test framework (verify via tsc/build + API). After `knex migrate:latest`:
API walkthrough as test users — manager submit (with `desired_candidate_profile`) → `hr_fill`; HR `hr-confirm` (note) → `hr_searching` + `hr_ack_at` set; HR `hr-search-update` → `employee_search_status` persisted; HR `hr-fill` → `it_close`. Negative checks: `hr-confirm` with empty note → 400; `hr-fill` at `hr_fill` (pre-confirm) → 400. Confirm the detail page hides the IT card for HR and shows the Role/profile card. Clean up the test ticket.

## Out of scope

- Append-only search-update history UI (single editable field chosen).
- Changing v1 (HR-first legacy) flow.
- Removing the retained trimmed schema fields.

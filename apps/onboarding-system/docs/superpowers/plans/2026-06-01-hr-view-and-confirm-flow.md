# HR-Focused View + Confirm/Search Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HR a recruiting-focused onboarding ticket view (IT requirements hidden), a required "confirm receipt" step that moves the ticket to a new visible `hr_searching` status, and an editable employee-search status field — before HR fills the hire's identity.

**Architecture:** New `hr_searching` status sits between `hr_fill` and `it_close`. HR confirms receipt (→ `hr_searching`), updates an `employee_search_status` (stored in `onboarding_details` JSONB), then fills identity (→ `it_close`). The detail page splits `onboarding_details` into a recruiting "Role & Requisition" card (everyone) and an "IT Requirements" card (hidden for the `hr` role). A new manager `desired_candidate_profile` field captures the wanted skills.

**Tech Stack:** TypeScript, Express, Knex/Postgres, Zod, Next.js 15 (React), npm workspaces.

---

## Testing note
The onboarding monorepo has **no JS test framework**. Verify via `tsc`/`next build` typecheck, `knex migrate`, and API `curl` against `localhost:4080` (use `POST /api/auth/test-login {role}` to mint manager/hr/it tokens). `onboarding-system` IS a git repo now (branch `main`) — commit per task. Server runs `tsx watch` (hot reload, currently launched detached via setsid); client runs `next dev` (hot reload).

**Pre-existing server `tsc` errors (do NOT touch, do NOT count as new):** `tickets.ts(258,...)` TS2339 `total`, and a TS2345 around line 532 (`string | string[]`).

## File structure
| File | Responsibility |
|---|---|
| `packages/shared/src/constants.ts` | `hr_searching` status + label/color/kanban; relabel `hr_fill` |
| `packages/shared/src/schemas.ts` | `desired_candidate_profile`; `hrConfirmSchema`; `hrSearchUpdateSchema` |
| `server/src/db/migrations/006_hr_search_flow.ts` | status constraint + `hr_ack_at` column |
| `server/src/routes/tickets.ts` | `hr-confirm`, `hr-search-update` routes; `hr-fill` status gate |
| `client/src/lib/api.ts` | `hrConfirm`, `hrSearchUpdate` |
| `client/src/app/(authenticated)/onboarding/new/page.tsx` | desired-candidate-profile field |
| `client/src/app/(authenticated)/onboarding/[id]/page.tsx` | HR view restructure + confirm/search/identity gating |

---

## Task 1: Shared constants + schemas

**Files:** Modify `packages/shared/src/constants.ts`, `packages/shared/src/schemas.ts`

- [ ] **Step 1: constants.ts — add the status everywhere it's enumerated**

In `REQUEST_STATUSES`, insert `'hr_searching'` immediately after `'hr_fill'`:
```typescript
export const REQUEST_STATUSES = ['draft', 'submitted', 'manager_review', 'it_review', 'hr_fill', 'hr_searching', 'it_close', 'approved', 'denied', 'in_progress', 'waiting', 'completed', 'cancelled'] as const;
```
In `STATUS_LABELS`, change the `hr_fill` line and add `hr_searching`:
```typescript
  hr_fill: 'Awaiting HR',
  hr_searching: 'HR — Searching',
```
In `STATUS_COLORS`, add after the `hr_fill` line:
```typescript
  hr_searching: '#14b8a6',
```
In `KANBAN_COLUMNS`, the `open` entry's `statuses` array — add `'hr_searching'` right after `'hr_fill'`:
```typescript
  { key: 'open',        label: 'Open',         statuses: ['submitted', 'manager_review', 'it_review', 'hr_fill', 'hr_searching', 'it_close', 'approved'], color: '#3b82f6' },
```

- [ ] **Step 2: schemas.ts — add the manager field**

In `managerOnboardingDetailsSchema`, add after the `job_title_is_new: z.boolean().optional(),` line:
```typescript
  // Skills/experience the hiring manager wants HR to recruit against.
  desired_candidate_profile: z.string().optional(),
```

- [ ] **Step 3: schemas.ts — add the two HR action schemas**

Add near the bottom of the file, after `hrFillSchema`:
```typescript
/** HR confirms receipt of a requisition. Note is required. */
export const hrConfirmSchema = z.object({
  note: z.string().min(1, 'A note is required'),
});

/** HR posts/updates the employee-search status while recruiting. */
export const hrSearchUpdateSchema = z.object({
  search_status: z.string().min(1, 'Search status is required'),
});
```
(`index.ts` already does `export * from './schemas'` and `'./constants'`, so no export edit needed.)

- [ ] **Step 4: Rebuild shared + verify**

Run: `cd /home/hnester/onboarding-system && npm run build -w packages/shared`
Expected: clean compile.
Run: `grep -c "hr_searching\|hrConfirmSchema\|hrSearchUpdateSchema\|desired_candidate_profile" packages/shared/dist/constants.js packages/shared/dist/schemas.js`
Expected: nonzero matches in both.

- [ ] **Step 5: Commit**
```bash
cd /home/hnester/onboarding-system
git add packages/shared/src packages/shared/dist
git commit -m "feat(shared): hr_searching status + desired_candidate_profile + HR action schemas"
```

---

## Task 2: Migration 006 — status constraint + hr_ack_at

**Files:** Create `server/src/db/migrations/006_hr_search_flow.ts`

- [ ] **Step 1: Write the migration**

Create `server/src/db/migrations/006_hr_search_flow.ts`:
```typescript
import type { Knex } from 'knex';

/**
 * v2 HR flow gains a visible "HR — Searching" state between hr_fill and
 * it_close, plus an hr_ack_at timestamp recording when HR confirmed receipt.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (t) => {
    t.timestamp('hr_ack_at', { useTz: true });
  });
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'hr_searching', 'it_close',
      'approved', 'denied',
      'in_progress', 'waiting',
      'completed', 'cancelled'
    ))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'it_close',
      'approved', 'denied',
      'in_progress', 'waiting',
      'completed', 'cancelled'
    ))
  `);
  await knex.schema.alterTable('tickets', (t) => {
    t.dropColumn('hr_ack_at');
  });
}
```

- [ ] **Step 2: Run the migration + verify**

Run: `cd /home/hnester/onboarding-system && npm run migrate -w server`
Expected: `Batch N run: 1 migrations` mentioning `006_hr_search_flow`.
Verify column + constraint:
```bash
PGPASSWORD=changeme psql -h localhost -U moc_user -d onboarding_db -c "\d tickets" | grep -E "hr_ack_at|tickets_status_check"
```
Expected: `hr_ack_at` column present and the check constraint lists `hr_searching`.

- [ ] **Step 3: Commit**
```bash
git add server/src/db/migrations/006_hr_search_flow.ts
git commit -m "feat(db): migration 006 — hr_searching status + hr_ack_at column"
```

---

## Task 3: Server endpoints (hr-confirm, hr-search-update) + hr-fill gate

**Files:** Modify `server/src/routes/tickets.ts`

- [ ] **Step 1: Import the new schemas**

The import on line 5 currently ends `... hrFillSchema } from '@onb/shared';`. Change it to include the two new schemas:
```typescript
import { createTicketSchema, reviewRequestSchema, updateTicketSchema, addCommentSchema, managerOnboardingDetailsSchema, managerIntakeSchema, hrFillSchema, hrConfirmSchema, hrSearchUpdateSchema } from '@onb/shared';
```

- [ ] **Step 2: Change the hr-fill status gate**

In the `POST /:id/hr-fill` handler (~line 411), find the status guard:
```typescript
    if (ticket.status !== 'hr_fill') {
      res.status(400).json({ message: `Ticket is not awaiting HR fill (status=${ticket.status})` });
      return;
    }
```
Change `'hr_fill'` to `'hr_searching'`:
```typescript
    if (ticket.status !== 'hr_searching') {
      res.status(400).json({ message: `Ticket is not in HR search (status=${ticket.status}). HR must confirm receipt first.` });
      return;
    }
```
And in that same handler's `ticket_history` insert, change `from_status: 'hr_fill',` to `from_status: 'hr_searching',`.

- [ ] **Step 3: Add the hr-confirm + hr-search-update routes**

Insert immediately BEFORE the `POST /:id/hr-fill` route definition (line ~411), so both new routes live with the HR flow:
```typescript
/**
 * v2 onboarding — HR confirms receipt of a requisition (with a note) and the
 * ticket moves hr_fill → hr_searching, recording hr_ack_at. HR then recruits.
 */
router.post('/:id/hr-confirm', authenticate, authorize('hr', 'it_admin'), validate(hrConfirmSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.flow_version !== 2) {
      res.status(400).json({ message: 'HR confirm is only for v2 (manager-first) tickets' });
      return;
    }
    if (ticket.status !== 'hr_fill') {
      res.status(400).json({ message: `Ticket is not awaiting HR (status=${ticket.status})` });
      return;
    }

    await db('tickets').where({ id: ticket.id }).update({
      status: 'hr_searching',
      hr_ack_at: new Date(),
    });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'hr_fill',
      to_status: 'hr_searching',
      changed_by: req.user!.id,
      comment: `HR confirmed receipt: ${req.body.note}`,
    });

    res.json({ message: 'Receipt confirmed — now searching', status: 'hr_searching' });
  } catch (err) {
    console.error('HR confirm error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * v2 onboarding — HR updates the employee-search status while recruiting.
 * Stored in onboarding_details; does not change ticket status.
 */
router.post('/:id/hr-search-update', authenticate, authorize('hr', 'it_admin'), validate(hrSearchUpdateSchema), async (req: Request, res: Response) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    if (ticket.status !== 'hr_searching') {
      res.status(400).json({ message: `Ticket is not in HR search (status=${ticket.status})` });
      return;
    }

    const existing = typeof ticket.onboarding_details === 'string'
      ? JSON.parse(ticket.onboarding_details)
      : (ticket.onboarding_details || {});
    const merged = {
      ...existing,
      employee_search_status: req.body.search_status,
      employee_search_updated_at: new Date().toISOString(),
    };

    await db('tickets').where({ id: ticket.id }).update({
      onboarding_details: JSON.stringify(merged),
    });
    await db('ticket_history').insert({
      ticket_id: ticket.id,
      from_status: 'hr_searching',
      to_status: 'hr_searching',
      changed_by: req.user!.id,
      comment: `HR search update: ${req.body.search_status}`,
    });

    res.json({ message: 'Search status updated', status: 'hr_searching' });
  } catch (err) {
    console.error('HR search update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

```

- [ ] **Step 4: Typecheck**

Run: `cd /home/hnester/onboarding-system && npm run build -w server`
Expected: ONLY the two pre-existing `tickets.ts` errors (TS2339 ~line 258, TS2345 ~line 532, line numbers may shift). No new errors.

- [ ] **Step 5: Commit**
```bash
git add server/src/routes/tickets.ts
git commit -m "feat(tickets): hr-confirm + hr-search-update endpoints; gate hr-fill behind hr_searching"
```

---

## Task 4: Client api functions

**Files:** Modify `client/src/lib/api.ts`

- [ ] **Step 1: Add the two functions**

After the `itClose` function (~line 124), add:
```typescript
export async function hrConfirm(token: string, id: number, data: { note: string }) {
  return fetchApi<any>(`/tickets/${id}/hr-confirm`, { method: 'POST', body: JSON.stringify(data), token });
}
export async function hrSearchUpdate(token: string, id: number, data: { search_status: string }) {
  return fetchApi<any>(`/tickets/${id}/hr-search-update`, { method: 'POST', body: JSON.stringify(data), token });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/hnester/onboarding-system && npx tsc --noEmit -p client/tsconfig.json 2>&1 | grep "lib/api.ts" || echo "api.ts clean"`
Expected: `api.ts clean`.

- [ ] **Step 3: Commit**
```bash
git add client/src/lib/api.ts
git commit -m "feat(client-api): hrConfirm + hrSearchUpdate"
```

---

## Task 5: Manager form — desired candidate profile field

**Files:** Modify `client/src/app/(authenticated)/onboarding/new/page.tsx`

- [ ] **Step 1: Add state**

Near the other org state (after `const [officeLocation, setOfficeLocation] = useState('');`), add:
```tsx
  const [desiredCandidateProfile, setDesiredCandidateProfile] = useState('');
```

- [ ] **Step 2: Add the field to "The role" section**

Inside the `<Section title="The role">`, after the `<Row>` containing Work location / Office, add a full-width field:
```tsx
          <Field label="Desired candidate profile (skills / experience HR should look for)">
            <textarea
              className="input-field"
              rows={3}
              value={desiredCandidateProfile}
              onChange={(e) => setDesiredCandidateProfile(e.target.value)}
              placeholder="e.g., 3+ yrs CNC machining, forklift cert, comfortable with ERP data entry, strong English + Spanish"
            />
          </Field>
```

- [ ] **Step 3: Include it in the submit payload**

In `handleSubmit`, inside `onboarding_details`, add after `manager_notes: managerNotes || undefined,`:
```tsx
        desired_candidate_profile: desiredCandidateProfile || undefined,
```

- [ ] **Step 4: Typecheck**

Run: `cd /home/hnester/onboarding-system && npx tsc --noEmit -p client/tsconfig.json 2>&1 | grep "onboarding/new/page.tsx" || echo "new/page clean"`
Expected: `new/page clean`.

- [ ] **Step 5: Commit**
```bash
git add "client/src/app/(authenticated)/onboarding/new/page.tsx"
git commit -m "feat(intake): manager desired_candidate_profile field"
```

---

## Task 6: Detail page — HR-focused view + confirm/search/identity

**Files:** Modify `client/src/app/(authenticated)/onboarding/[id]/page.tsx`

Read the whole file first. It has a default-exported `TicketDetailPage`, helper components `OnboardingManagerForm`, `HrFillForm`, `DetailsCard` at the bottom, and `isAdmin`/`isHR`/`isManager`/`canHrFill`/`canItClose` booleans (~lines 95–106).

- [ ] **Step 1: Import the new api functions**

The import block (lines 6–9) lists `... submitOnboardingDetails, hrFill, itClose,`. Add the two new ones:
```tsx
  getTicket, managerReview, itReview, updateTicket, cancelTicket, deleteTicket, addComment,
  getCategories, getAssignableUsers, submitOnboardingDetails, hrFill, itClose, hrConfirm, hrSearchUpdate,
```

- [ ] **Step 2: Add gating booleans + handlers**

After the existing `canItClose` line (~102), add:
```tsx
  const canHrConfirm = r.flow_version === 2 && r.status === 'hr_fill' && (isHR || isAdmin);
  const canHrSearch = r.flow_version === 2 && r.status === 'hr_searching' && (isHR || isAdmin);
```
Find `canHrFill` (~line 101) and change its status from `'hr_fill'` to `'hr_searching'`:
```tsx
  const canHrFill = r.flow_version === 2 && r.status === 'hr_searching' && (isHR || isAdmin);
```
Near the other handlers (after `handleItClose`, ~line 63), add:
```tsx
  async function handleHrConfirm(note: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await hrConfirm(token, parseInt(id as string), { note }); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleHrSearchUpdate(search_status: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await hrSearchUpdate(token, parseInt(id as string), { search_status }); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
```

- [ ] **Step 3: Add the onboarding details parse + replace the generic onboarding card**

Find this line (~178):
```tsx
      {r.onboarding_details && <DetailsCard title="New Hire Information" details={r.onboarding_details} highlight />}
```
Replace it with (parses once, renders Role card for all + IT card for non-HR + HR status line):
```tsx
      {r.onboarding_details && (() => {
        const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : r.onboarding_details;
        return (
          <>
            <RoleRequisitionCard od={od} ticket={r} />
            <HrProgressLine od={od} ackAt={r.hr_ack_at} />
            {!isHR && <FieldGroupCard title="IT Requirements" od={od} fields={IT_FIELDS} />}
          </>
        );
      })()}
```
(The non-onboarding `DetailsCard` lines for hardware/software/etc. stay as-is.)

- [ ] **Step 4: Add the field-group constants + helper components**

At the bottom of the file (next to `DetailsCard`), add:
```tsx
const ROLE_FIELDS: [string, string][] = [
  ['job_title', 'Job title'],
  ['department', 'Department'],
  ['employment_type', 'Employment type'],
  ['work_location', 'Work location'],
  ['office_location', 'Office / building'],
  ['target_start_date', 'Target start date'],
  ['manager_name', 'Hiring manager'],
  ['manager_email', 'Manager email'],
];
const IDENTITY_FIELDS: [string, string][] = [
  ['full_name', 'Full name'],
  ['preferred_name', 'Preferred name'],
  ['employee_number', 'Employee #'],
  ['badge_number', 'Badge #'],
  ['start_date', 'Confirmed start date'],
  ['personal_email', 'Personal email'],
  ['phone', 'Phone'],
];
const IT_FIELDS: [string, string][] = [
  ['needs_laptop', 'Laptop'],
  ['laptop_preference', 'Laptop preference'],
  ['needs_monitor', 'Monitor(s)'],
  ['monitor_count', 'Monitor count'],
  ['needs_phone', 'Desk phone'],
  ['needs_headset', 'Headset'],
  ['other_equipment', 'Other equipment'],
  ['needs_m365', 'Microsoft 365'],
  ['needs_vpn', 'VPN'],
  ['software_needed', 'Software'],
  ['shared_mailboxes', 'Shared mailboxes'],
  ['distribution_lists', 'Distribution lists'],
  ['security_groups', 'Security groups'],
  ['network_drives', 'Network drives'],
  ['similar_to_employee_email', 'Copy access from'],
  ['email_alias_preference', 'Email alias preference'],
];

function fmtVal(v: any): string | null {
  if (v === null || v === undefined || v === '' || v === false) return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (v === true) return 'Yes';
  return String(v);
}

function FieldRows({ od, fields }: { od: any; fields: [string, string][] }) {
  const rows = fields.map(([k, label]) => [label, fmtVal(od[k])]).filter(([, v]) => v !== null) as [string, string][];
  if (rows.length === 0) return <p className="text-sm text-theme-muted">None specified.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {rows.map(([label, v]) => (
        <div key={label}><span className="text-theme-muted">{label}:</span>{' '}<span className="font-semibold text-theme-primary capitalize">{v}</span></div>
      ))}
    </div>
  );
}

function FieldGroupCard({ title, od, fields }: { title: string; od: any; fields: [string, string][] }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-theme-primary mb-3">{title}</h2>
      <FieldRows od={od} fields={fields} />
    </div>
  );
}

function RoleRequisitionCard({ od, ticket }: { od: any; ticket: any }) {
  const hasIdentity = IDENTITY_FIELDS.some(([k]) => fmtVal(od[k]) !== null);
  return (
    <div className="card" style={{ borderLeft: '4px solid #22c55e' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-3">Role &amp; Requisition</h2>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div><span className="text-theme-muted">Requested by:</span>{' '}<span className="font-semibold text-theme-primary">{ticket.requester_name}</span></div>
        <div><span className="text-theme-muted">Urgency:</span>{' '}<span className="font-semibold text-theme-primary capitalize">{ticket.urgency}</span></div>
      </div>
      <FieldRows od={od} fields={ROLE_FIELDS} />
      {fmtVal(od.desired_candidate_profile) && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
          <p className="text-sm font-bold text-theme-secondary mb-1">Desired candidate profile</p>
          <p className="text-sm text-theme-primary whitespace-pre-wrap">{od.desired_candidate_profile}</p>
        </div>
      )}
      {fmtVal(od.manager_notes) && (
        <div className="mt-3">
          <p className="text-sm text-theme-muted mb-1">Manager notes:</p>
          <p className="text-sm text-theme-primary whitespace-pre-wrap">{od.manager_notes}</p>
        </div>
      )}
      {hasIdentity && (
        <div className="mt-4 pt-3 border-t border-theme">
          <p className="text-sm font-bold text-theme-secondary mb-2">New hire</p>
          <FieldRows od={od} fields={IDENTITY_FIELDS} />
          {fmtVal(od.hr_notes) && <p className="text-sm text-theme-primary whitespace-pre-wrap mt-2"><span className="text-theme-muted">HR notes:</span> {od.hr_notes}</p>}
        </div>
      )}
    </div>
  );
}

function HrProgressLine({ od, ackAt }: { od: any; ackAt?: string | null }) {
  const search = fmtVal(od.employee_search_status);
  if (!ackAt && !search) return null;
  return (
    <div className="card" style={{ borderLeft: '4px solid #14b8a6' }}>
      {ackAt && <p className="text-sm text-theme-primary">✓ HR confirmed receipt <span className="text-theme-muted">on {new Date(ackAt).toLocaleString()}</span></p>}
      {search && (
        <p className="text-sm text-theme-primary mt-1">
          <span className="text-theme-muted">Search status:</span> {search}
          {od.employee_search_updated_at && <span className="text-theme-muted"> (updated {new Date(od.employee_search_updated_at).toLocaleString()})</span>}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the Confirm-receipt card**

Find the `{canHrFill && (<HrFillForm .../>)}` block (~227). Immediately BEFORE it, add the confirm card and the search card:
```tsx
      {canHrConfirm && <HrConfirmCard onConfirm={handleHrConfirm} submitting={submitting} />}
      {canHrSearch && (
        <HrSearchCard
          current={(() => { const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : (r.onboarding_details || {}); return od.employee_search_status || ''; })()}
          onSave={handleHrSearchUpdate}
          submitting={submitting}
        />
      )}
```
(`canHrFill` is already changed to `hr_searching` in Step 2, so the identity form and the search card both appear in `hr_searching`.)

- [ ] **Step 6: Add the HrConfirmCard + HrSearchCard components**

At the bottom of the file (with the other helper components), add:
```tsx
function HrConfirmCard({ onConfirm, submitting }: { onConfirm: (note: string) => void; submitting: boolean }) {
  const [note, setNote] = useState('');
  return (
    <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Confirm receipt</h2>
      <p className="text-sm text-theme-muted mb-3">Acknowledge you&apos;ve received this requisition. Add a note (required) — then you can log the employee search and, once you&apos;ve found the hire, add their identity.</p>
      <textarea className="input-field mb-3" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Received — posting the role and screening candidates this week." />
      <button onClick={() => onConfirm(note)} disabled={submitting || !note.trim()} className="btn-accent">Confirm receipt</button>
    </div>
  );
}

function HrSearchCard({ current, onSave, submitting }: { current: string; onSave: (s: string) => void; submitting: boolean }) {
  const [val, setVal] = useState(current);
  return (
    <div className="card" style={{ borderLeft: '4px solid #14b8a6' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Employee search</h2>
      <p className="text-sm text-theme-muted mb-3">Keep this updated as you recruit. Visible to the hiring manager and IT.</p>
      <textarea className="input-field mb-3" rows={3} value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g., 2 candidates interviewing; offer expected by Friday." />
      <button onClick={() => onSave(val)} disabled={submitting || !val.trim()} className="btn-primary">Save update</button>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd /home/hnester/onboarding-system && npx tsc --noEmit -p client/tsconfig.json 2>&1 | grep "onboarding/\[id\]/page.tsx" || echo "[id]/page clean"`
Expected: `[id]/page clean`.

- [ ] **Step 8: Commit**
```bash
git add "client/src/app/(authenticated)/onboarding/[id]/page.tsx"
git commit -m "feat(ticket-detail): HR-focused role view, hide IT card from HR, confirm + search cards"
```

---

## Task 7: End-to-end validation

**No files.** Drive the API at `localhost:4080` with test-login tokens. (Migration already run in Task 2.)

- [ ] **Step 1: Manager submits with desired profile**
Mint a manager token (`POST /api/auth/test-login {"role":"manager"}` → `tokens.accessToken`). Create an onboarding ticket (`request_type:'onboarding'`, no `full_name`) with `onboarding_details` including `job_title`, `department` (a real ETD dept), `desired_candidate_profile:'QA test profile'`, `employment_type:'full_time'`, `work_location:'onsite'`, `needs_laptop:true`. Confirm response `status:'hr_fill'`. Save the ticket id.

- [ ] **Step 2: Pre-confirm hr-fill is rejected**
Mint an HR token. `POST /tickets/:id/hr-fill` with identity → expect **HTTP 400** ("HR must confirm receipt first").

- [ ] **Step 3: Empty-note confirm rejected, then valid confirm**
`POST /tickets/:id/hr-confirm {"note":""}` → expect **400**. Then `{"note":"Received, screening this week"}` → expect 200 `status:'hr_searching'`. GET the ticket → `status:hr_searching`, `hr_ack_at` set.

- [ ] **Step 4: Search update persists**
`POST /tickets/:id/hr-search-update {"search_status":"2 candidates interviewing"}` → 200. GET ticket → `onboarding_details.employee_search_status` == that string and `employee_search_updated_at` set.

- [ ] **Step 5: Identity fill now works**
`POST /tickets/:id/hr-fill` with `full_name:'ZZ Test Hire'`, `employee_number:'QA1'`, `badge_number:'QAB'`, `start_date:'2026-07-01'` → 200 `status:'it_close'`.

- [ ] **Step 6: HR view hides IT (spot check via API shape)**
Confirm the ticket's `onboarding_details` contains both role fields (`desired_candidate_profile`) and IT fields (`needs_laptop`) — the hide is a client concern; note that the UI gating (`!isHR`) is covered by the typecheck + code review. (Optional: if the public UI is reachable in a browser, eyeball that HR sees no IT card.)

- [ ] **Step 7: Clean up**
Delete the test ticket:
```bash
PGPASSWORD=changeme psql -h localhost -U moc_user -d onboarding_db -c "DELETE FROM ticket_history WHERE ticket_id=<ID>; DELETE FROM tickets WHERE id=<ID>;"
```
Report the walkthrough results (status codes + transitions).

---

## Task 8: Final commit / branch state
All per-task commits are on `main` in the onboarding repo. Confirm `git status` is clean and `git log --oneline -8` shows the feature commits. (No GitHub remote — local only.)

---

## Self-review (plan author)
- **Spec coverage:** workflow/status → Tasks 1,2,3; desired_candidate_profile → Tasks 1,5,6; HR view restructure + hide IT → Task 6; confirm step → Tasks 1,3,6; search field → Tasks 1,3,6; hr-fill gating → Tasks 3,6; HR status line → Task 6; validation → Task 7. Covered.
- **Placeholder scan:** none; all steps have concrete code/commands. `<ID>` in Task 7 is a runtime value from Step 1, explicitly described.
- **Type consistency:** `hrConfirm(token,id,{note})` / `hrSearchUpdate(token,id,{search_status})` signatures match across Task 4 (api) and Task 6 (handlers). `hrConfirmSchema {note}` / `hrSearchUpdateSchema {search_status}` (Task 1) match the route bodies (Task 3) and api calls. `hr_searching` status string consistent across constants, migration, routes, and detail-page gating. Field-group consts (`ROLE_FIELDS`/`IDENTITY_FIELDS`/`IT_FIELDS`) defined and used within Task 6.

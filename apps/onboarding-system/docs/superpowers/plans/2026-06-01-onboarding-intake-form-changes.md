# Onboarding Intake Form Changes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the v2 manager-first onboarding requisition form — NYCOA office examples, trim the Accounts & Access section, a live distribution-list multi-select, and a manager-added-role flow that persists to the canonical catalog only after HR accepts.

**Architecture:** Onboarding (Express :4080 + Next.js :3080) reads the department/job-title catalog and the M365-synced distribution-group mirror from the Employee Tech Doc (ETD) Flask app (:5065) via proxy routes. New roles are written back to ETD's catalog at the HR-accept (`hr-fill`) step through a new ETD write endpoint, best-effort and non-blocking. The three trimmed fields are removed from the form only; their permissive Zod schema fields stay.

**Tech Stack:** TypeScript, Express, Next.js 15 (App Router, React), Zod, Knex/Postgres (onboarding); Flask, SQLAlchemy, pytest (ETD).

---

## Testing note (read first)

The onboarding monorepo has **no JS test framework** (no jest/vitest, zero test files). Do **not** invent one. Verification for onboarding TypeScript changes is: `tsc`/`next build` typecheck, runtime `curl` against the running server, and a Playwright UI walkthrough. ETD **does** use pytest with pure-function unit tests (see `tests/test_m365_merge.py`) — the one true unit test in this plan is for the ETD slug helper; the endpoint itself is verified by curl.

Both apps are currently **running** (onboarding via `npm run dev`, ETD in Docker on :5065). Restart the onboarding dev server after server-side edits if it isn't watch-reloading.

---

## File structure

| Layer | File | Responsibility |
|---|---|---|
| ETD server | `app/routes/lookups.py` | Add `_slugify_key` helper + `POST /api/lookups/job-titles` write endpoint |
| ETD tests | `tests/test_lookups.py` | Unit-test `_slugify_key` |
| Onboarding server | `server/src/routes/lookups.ts` | New `GET /distribution-groups` proxy |
| Onboarding server | `server/src/services/directory.ts` | `persistNewRole()` helper (POST to ETD) |
| Onboarding server | `server/src/routes/tickets.ts` | Fire `persistNewRole` in `hr-fill` after status update |
| Onboarding server | `server/.env` | `ETD_NYCOA_COMPANY_ID` |
| Shared | `packages/shared/src/schemas.ts` | Add optional `job_title_is_new` |
| Onboarding client | `client/src/lib/api.ts` | `getDistributionGroups()` + type |
| Onboarding client | `client/src/app/(authenticated)/onboarding/new/page.tsx` | Office examples, field removal, DL multi-select, new-role UI |

---

## Task 1: ETD — slug helper + `POST /api/lookups/job-titles`

**Files:**
- Modify: `/home/hnester/employee_tech_documentation/app/routes/lookups.py`
- Test: `/home/hnester/employee_tech_documentation/tests/test_lookups.py`

- [ ] **Step 1: Write the failing test for the slug helper**

Create `tests/test_lookups.py`:

```python
"""Unit tests for the job-title key slug derivation used by the
manager-added-role write endpoint."""
from app.routes.lookups import _slugify_key


def test_basic_label():
    assert _slugify_key("Lab Technician A") == "lab-technician-a"


def test_strips_punctuation_and_collapses():
    assert _slugify_key("Sr. ERP Engineer / Lead") == "sr-erp-engineer-lead"


def test_trims_and_lowercases():
    assert _slugify_key("  Maintenance Foreman  ") == "maintenance-foreman"


def test_empty_falls_back():
    assert _slugify_key("   ") == "role"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/hnester/employee_tech_documentation && python -m pytest tests/test_lookups.py -v`
Expected: FAIL — `ImportError: cannot import name '_slugify_key'`.

- [ ] **Step 3: Add the helper + POST endpoint**

In `app/routes/lookups.py`, update the imports at the top:

```python
from __future__ import annotations

import re

from flask import Blueprint, jsonify, request
from sqlalchemy import func, select

from ..database import db
from ..models import Department, JobTitle
```

Then add the helper (above the route definitions) and the new route (below `list_job_titles`):

```python
def _slugify_key(label: str) -> str:
    """Derive a job_titles.key slug from a human label.
    Lowercase, non-alphanumerics collapsed to single hyphens, trimmed."""
    s = re.sub(r"[^a-z0-9]+", "-", label.strip().lower()).strip("-")
    return s or "role"


def _serialize_title(title: JobTitle, dept_name: str) -> dict:
    return {
        "id": title.id,
        "label": title.label,
        "key": title.key,
        "department_id": title.department_id,
        "department_name": dept_name,
        "sort_order": title.sort_order,
    }


@lookups_bp.route("/job-titles", methods=["POST"])
def create_job_title():
    """Create a job title in the canonical catalog. Called by the onboarding
    system after HR accepts a requisition that carried a manager-added role.
    Idempotent on label (unique): returns the existing row if present."""
    data = request.get_json(silent=True) or {}
    label = (data.get("label") or "").strip()
    if not label:
        return jsonify({"error": "label is required"}), 400

    # Resolve department by id or (case-insensitive) name.
    dept = None
    dept_id_raw = data.get("department_id")
    dept_name = (data.get("department") or "").strip()
    if dept_id_raw is not None:
        try:
            dept = db.session.get(Department, int(dept_id_raw))
        except (TypeError, ValueError):
            return jsonify({"error": "department_id must be an integer"}), 400
    elif dept_name:
        dept = db.session.execute(
            select(Department).where(func.lower(Department.name) == dept_name.lower())
        ).scalar_one_or_none()
    if dept is None:
        return jsonify({"error": "department not found"}), 400

    existing = db.session.execute(
        select(JobTitle).where(func.lower(JobTitle.label) == label.lower())
    ).scalar_one_or_none()
    if existing is not None:
        return jsonify({**_serialize_title(existing, dept.name), "created": False}), 200

    title = JobTitle(
        label=label,
        key=_slugify_key(label),
        department_id=dept.id,
        sort_order=999,
        active=True,
    )
    db.session.add(title)
    db.session.commit()
    return jsonify({**_serialize_title(title, dept.name), "created": True}), 201
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/hnester/employee_tech_documentation && python -m pytest tests/test_lookups.py -v`
Expected: 4 passed.

- [ ] **Step 5: Verify the endpoint at runtime (curl)**

ETD runs in Docker on :5065. First find a real department name:

Run: `curl -s http://localhost:5065/api/lookups/departments`
Pick a `name` from the output (e.g. `Production`), then:

Run:
```bash
curl -s -X POST http://localhost:5065/api/lookups/job-titles \
  -H 'Content-Type: application/json' \
  -d '{"label":"ZZ Plan Test Role","department":"Production"}'
```
Expected: `201` JSON with `"created": true`. Run the same command again → `200` with `"created": false` (idempotent).

Clean up the test row:
Run: `curl -s "http://localhost:5065/api/lookups/job-titles" | python -c "import sys,json;[print(t['id'],t['label']) for t in json.load(sys.stdin) if 'ZZ Plan Test' in t['label']]"`
Then delete it via the DB (psql/sqlite per ETD config) or leave it — it's harmless test data. Note which you did.

- [ ] **Step 6: Commit**

ETD is its own repo. From `/home/hnester/employee_tech_documentation`:
```bash
git add app/routes/lookups.py tests/test_lookups.py
git commit -m "feat(lookups): add POST /job-titles write endpoint for manager-added roles"
```

---

## Task 2: Onboarding — distribution-groups proxy route

**Files:**
- Modify: `server/src/routes/lookups.ts`
- Modify: `server/.env`

- [ ] **Step 1: Resolve NYCOA's company_id and set env**

Run: `curl -s http://localhost:5065/api/distribution-groups/ | python -c "import sys,json;d=json.load(sys.stdin);print({g.get('display_name'):g.get('company_id') for g in d['distribution_groups']})"`

Identify NYCOA's `company_id`. If groups lack `company_id` or there is only one tenant's data, you may leave the var unset (the proxy then forwards unfiltered). Add to `server/.env` (below `DIRECTORY_SERVICE_TOKEN`):

```
# ETD company_id for NYCOA — filters the distribution-group dropdown to NYCOA's tenant.
ETD_NYCOA_COMPANY_ID=
```
Set the value you found (leave blank to forward unfiltered).

- [ ] **Step 2: Add the proxy route**

In `server/src/routes/lookups.ts`, add below the `/job-titles` route (before `export default router;`):

```typescript
router.get('/distribution-groups', async (_req: Request, res: Response) => {
  const companyId = process.env.ETD_NYCOA_COMPANY_ID;
  const suffix = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  await forward(`/api/distribution-groups/${suffix}`, res);
});
```

- [ ] **Step 3: Typecheck the server build**

Run: `cd /home/hnester/onboarding-system && npm run build -w server`
Expected: compiles with no errors.

- [ ] **Step 4: Verify the proxy at runtime (curl)**

Restart the onboarding dev server if not watch-reloading. Get a token by logging in (or use a test-mode session). With a valid bearer token `$T`:

Run: `curl -s http://localhost:4080/api/lookups/distribution-groups -H "Authorization: Bearer $T"`
Expected: `{"distribution_groups":[...]}` mirroring ETD's payload. Without the proxy reachable, expect the `502 {"error":"Lookup catalog unavailable","items":[]}` shape from `forward()`.

- [ ] **Step 5: Commit** (see Task 8 — onboarding isn't a git repo yet; commits are batched there).

---

## Task 3: Shared — add `job_title_is_new` flag

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add the optional flag**

In `managerOnboardingDetailsSchema` (the object beginning `export const managerOnboardingDetailsSchema = z.object({`), add this line just after `similar_to_employee_email: z.string().optional(),`:

```typescript
  // True when the manager typed a role not in the catalog; the server
  // persists it to the ETD catalog at the HR-accept step.
  job_title_is_new: z.boolean().optional(),
```

- [ ] **Step 2: Rebuild the shared package**

Run: `cd /home/hnester/onboarding-system && npm run build -w packages/shared`
Expected: compiles, regenerates `dist/`.

- [ ] **Step 3: Verify the flag is exported**

Run: `grep -n "job_title_is_new" packages/shared/dist/schemas.js`
Expected: at least one match.

---

## Task 4: Onboarding server — persist new role at HR-accept

**Files:**
- Modify: `server/src/services/directory.ts`
- Modify: `server/src/routes/tickets.ts`

- [ ] **Step 1: Add `persistNewRole` to directory.ts**

In `server/src/services/directory.ts`, add this exported function (it can live just below the `directoryBase()` helper, which is in the same module):

```typescript
/**
 * Ensure a manager-added job title exists in the ETD canonical catalog.
 * Called from the HR-accept (hr-fill) step. Best-effort: the caller logs
 * and swallows failures so a catalog hiccup never blocks the ticket.
 */
export async function persistNewRole(label: string, department?: string): Promise<void> {
  const base = directoryBase();
  const resp = await fetch(`${base}/api/lookups/job-titles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, department }),
  });
  if (!resp.ok) {
    throw new Error(`ETD job-title create returned ${resp.status}`);
  }
  console.log(`[role-persist] ensured catalog role "${label}" (${department || 'no dept'})`);
}
```

- [ ] **Step 2: Import it in tickets.ts**

In `server/src/routes/tickets.ts`, update the directory import (currently `import { syncEmployeeToDirectory } from '../services/directory';`) to:

```typescript
import { syncEmployeeToDirectory, persistNewRole } from '../services/directory';
```

- [ ] **Step 3: Fire it after the hr-fill status update**

In the `POST /:id/hr-fill` handler, immediately after the `ticket_history` insert and before `res.json({ message: 'HR fill complete ...` (around line 444), add:

```typescript
    // Manager-added role: now that HR has accepted, persist it to the ETD
    // canonical catalog. Best-effort — never block the ticket on this.
    if (merged.job_title_is_new && merged.job_title) {
      persistNewRole(merged.job_title, merged.department).catch((e) =>
        console.error('[role-persist] failed:', e?.message || e)
      );
    }
```

- [ ] **Step 4: Typecheck**

Run: `cd /home/hnester/onboarding-system && npm run build -w server`
Expected: compiles with no errors.

- [ ] **Step 5: Runtime verify (deferred to Task 7 end-to-end)** — the persist path is exercised in the Task 7 walkthrough (submit a requisition with a new role, run hr-fill, confirm the role appears via `GET /api/lookups/job-titles`).

- [ ] **Step 6: Commit** (batched — see Task 8).

---

## Task 5: Onboarding client — api client function for distribution groups

**Files:**
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Add the type and fetch function**

In `client/src/lib/api.ts`, add near the other lookup exports (after `getLookupJobTitles`):

```typescript
export interface DistributionGroup {
  id: number;
  display_name: string;
  mail: string | null;
}
export async function getDistributionGroups(token: string): Promise<DistributionGroup[]> {
  const data = await fetchApi<{ distribution_groups: any[] }>('/lookups/distribution-groups', { token });
  return (data.distribution_groups || [])
    .map((g) => ({ id: g.id, display_name: g.display_name, mail: g.mail ?? null }))
    .filter((g: DistributionGroup) => !!g.mail);
}
```

- [ ] **Step 2: Typecheck the client build**

Run: `cd /home/hnester/onboarding-system && npm run build -w client`
Expected: compiles (Next may warn about unrelated pages; no type errors in api.ts).

---

## Task 6: Onboarding client — form changes

**Files:**
- Modify: `client/src/app/(authenticated)/onboarding/new/page.tsx`

All edits are in this one file. Apply each step exactly.

- [ ] **Step 1: NYCOA office examples**

Replace the `OFFICES` constant (line 17):

```typescript
const OFFICES = ['NYCOA Office', 'NYCOA Factory – 1st floor', 'NYCOA Factory – 2nd floor', 'NYCOA Factory – 3rd floor', 'NYCOA Factory – 4th floor', 'NYCOA Factory – 5th floor'];
```

Change the office field placeholder (the input under `<Field label="Office / building">`):

```tsx
<input className="input-field" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} placeholder="e.g., NYCOA Office, or NYCOA Factory – 3rd floor" />
```

- [ ] **Step 2: Update imports + add new state**

Update the api import block (lines 6–13) to add `getDistributionGroups` and its type:

```tsx
import {
  createTicket,
  getManagers,
  getLookupDepartments,
  getLookupJobTitles,
  getDistributionGroups,
  type LookupDepartment,
  type LookupJobTitle,
  type DistributionGroup,
} from '@/lib/api';
```

In the Accounts/access state block (lines ~125–134), **remove** these three lines:

```tsx
  const [emailAliasPreference, setEmailAliasPreference] = useState('');
  const [securityGroups, setSecurityGroups] = useState('');
  const [networkDrives, setNetworkDrives] = useState('');
```

Change the distribution lists state from a string to a string array (replace `const [distributionLists, setDistributionLists] = useState('');`):

```tsx
  const [distributionLists, setDistributionLists] = useState<string[]>([]);
  const [dlOptions, setDlOptions] = useState<DistributionGroup[]>([]);
```

In the title/new-role area near the other org state (after `const [jobTitle, setJobTitle] = useState('');`), add:

```tsx
  const [addingNewRole, setAddingNewRole] = useState(false);
  const [jobTitleIsNew, setJobTitleIsNew] = useState(false);
```

- [ ] **Step 3: Fetch distribution groups on mount**

After the existing managers `useEffect` (the one calling `getManagers`), add:

```tsx
  useEffect(() => {
    if (!token) return;
    getDistributionGroups(token)
      .then(setDlOptions)
      .catch((e) => console.warn('[onboarding] distribution-group fetch failed:', e?.message));
  }, [token]);
```

- [ ] **Step 4: Update the submit payload**

In `handleSubmit`, inside `onboarding_details`, make these changes:
- Remove the line `email_alias_preference: emailAliasPreference || undefined,`
- Remove the line `security_groups: splitList(securityGroups),`
- Remove the line `network_drives: splitList(networkDrives),`
- Replace `distribution_lists: splitList(distributionLists),` with:

```tsx
        distribution_lists: Array.from(new Set(['all@nycoa.com', ...distributionLists])),
        job_title_is_new: jobTitleIsNew || undefined,
```

- [ ] **Step 5: New-role UI in the title select**

Replace the entire `<Field label="Job title *" required>` block (lines ~263–284) with:

```tsx
            <Field label="Job title *" required>
              <select
                className="input-field"
                value={addingNewRole ? '__new__' : jobTitle}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__new__') {
                    setAddingNewRole(true);
                    setJobTitleIsNew(true);
                    setJobTitle('');
                    return;
                  }
                  setAddingNewRole(false);
                  setJobTitleIsNew(false);
                  setJobTitle(v);
                  const inferred = departmentForTitle(v);
                  if (inferred && !department.trim()) setDepartment(inferred);
                }}
                required={!addingNewRole}
              >
                <option value="">— Select a title —</option>
                {titleGroups.map((g) => (
                  <optgroup key={g.department} label={g.department}>
                    {g.titles.map((t) => (
                      <option key={t.key} value={t.label}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__new__">+ Role not listed…</option>
              </select>
              {addingNewRole && (
                <input
                  className="input-field mt-2"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  placeholder="New role title — added to the catalog once HR accepts"
                />
              )}
            </Field>
```

- [ ] **Step 6: Replace the Accounts & Access fields**

Replace the three `<Field>` blocks for "Email alias preference", "Distribution lists", "Security groups", and "Network drives" — i.e. remove Email alias preference, Security groups, Network drives entirely, and replace Distribution lists with a checkbox multi-select. The resulting "Accounts & access" `<Section>` body should read:

```tsx
        <Section title="Accounts & access">
          <CheckboxRow label="Microsoft 365 mailbox" checked={needsM365} onChange={setNeedsM365} />
          <CheckboxRow label="VPN access" checked={needsVpn} onChange={setNeedsVpn} />
          <Field label="Software needed (comma-separated)">
            <input className="input-field" value={softwareNeeded} onChange={(e) => setSoftwareNeeded(e.target.value)} placeholder={SOFTWARE_SUGGEST.join(', ')} />
          </Field>
          <Field label="Shared mailboxes">
            <input className="input-field" value={sharedMailboxes} onChange={(e) => setSharedMailboxes(e.target.value)} placeholder="comma-separated mailbox addresses" />
          </Field>
          <Field label="Distribution lists">
            <p className="text-xs text-theme-muted mb-2">
              Everyone is added to <strong>all@nycoa.com</strong> automatically. Select any additional lists below.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-theme p-2 space-y-1">
              {dlOptions.length === 0 && (
                <p className="text-xs text-theme-muted">No distribution lists available.</p>
              )}
              {dlOptions.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm text-theme-primary">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={distributionLists.includes(g.mail!)}
                    onChange={(e) =>
                      setDistributionLists((prev) =>
                        e.target.checked ? [...prev, g.mail!] : prev.filter((m) => m !== g.mail)
                      )
                    }
                  />
                  <span>{g.display_name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Copy access from existing employee">
            <input type="email" className="input-field" value={similarToEmployeeEmail} onChange={(e) => setSimilarToEmployeeEmail(e.target.value)} placeholder="someone@nycoa.com (we'll mirror their groups & access)" />
          </Field>
        </Section>
```

- [ ] **Step 7: Remove dead references in test-mode autofill**

`applyTestData` does not touch any removed field, so no change is needed there. Confirm `splitList` is still used (by `softwareNeeded`/`sharedMailboxes`) — it is, so leave it.

- [ ] **Step 8: Typecheck the client build**

Run: `cd /home/hnester/onboarding-system && npm run build -w client`
Expected: compiles with no type errors. Fix any unused-variable errors by confirming the three removed `useState`s and their JSX are fully gone.

- [ ] **Step 9: Commit** (batched — see Task 8).

---

## Task 7: End-to-end validation (the user's "make sure it works" ask)

**No files.** Use Playwright (MCP browser tools) against the running client at the appropriate base URL, or manual browser. If a `test-app` recipe exists for onboarding, prefer it; otherwise follow this script.

- [ ] **Step 1: Pre-flight — both services up**

Run: `ss -ltnp | grep -E ':4080|:3080'` (both listening) and `curl -s http://localhost:5065/api/lookups/departments | head -c 200` (ETD reachable).

- [ ] **Step 2: Manager submit — catalog role**

Log in as a manager (or test-mode user). Open `/onboarding/new`. Confirm:
- Job title dropdown is populated, grouped by department; selecting a title auto-fills department.
- Office placeholder reads the NYCOA example; Accounts & Access shows **no** email-alias / security-groups / network-drives fields.
- Distribution lists shows the `all@nycoa.com` note + a checkbox list of NYCOA groups.
Submit a requisition with a catalog title and 1–2 DLs checked. Expect redirect to `/onboarding`.

- [ ] **Step 3: Verify the submitted payload**

Inspect the created ticket (DB or ticket detail). Confirm `onboarding_details.distribution_lists` contains `all@nycoa.com` plus the checked addresses, and that `email_alias_preference`/`security_groups`/`network_drives` are absent.

- [ ] **Step 4: Manager submit — NEW role**

Submit a second requisition; in the title dropdown choose **"+ Role not listed…"**, type a unique role (e.g. `Plan Test Role 0601`), pick a department, submit. Confirm the ticket's `onboarding_details` has `job_title_is_new: true` and the typed `job_title`.

- [ ] **Step 5: HR accept → role persists**

Log in as HR (or a user authorized for hr-fill). Open the new-role ticket (status `hr_fill`), complete the HR fill form (name, employee#, badge#, start date), submit. Expect transition to `it_close`.
Run: `curl -s "http://localhost:5065/api/lookups/job-titles" | grep -i "Plan Test Role 0601"`
Expected: the role now exists in the catalog (persisted at HR-accept). Confirm the onboarding server log shows `[role-persist] ensured catalog role ...`.

- [ ] **Step 6: Walk the rest of the flow**

Log in as IT, open the ticket (status `it_close`), run IT close (approve). Expect `completed` and the directory-sync log line. Confirm no errors in the server console.

- [ ] **Step 7: Clean up test data**

Delete the `Plan Test Role 0601` catalog row and the test tickets, or note them as harmless test data. Record what you did.

---

## Task 8: Commit onboarding changes

Onboarding-system is **not** under version control (the root `Work-Proxmox-mini` repo ignores app subdirectories, and there is no per-app repo). Per the user's earlier decision, do **not** force changes into the root repo.

- [ ] **Step 1: Confirm the intended commit target with the user**

Ask whether to `git init` a dedicated repo for `onboarding-system` (matching how the other apps are tracked) before committing Tasks 2, 4, 5, 6. If yes:
```bash
cd /home/hnester/onboarding-system && git init && git add -A && git commit -m "feat: NYCOA office labels, trimmed access section, live distribution-list multi-select, manager-added roles"
```
If no, leave the working tree as-is and note that changes are uncommitted.

---

## Self-review (completed by plan author)

- **Spec coverage:** §1 office → Task 6.1; §2 trim → Task 6 (state, payload, JSX) + schema retained per spec (no removal task, by design); §3 DLs → Tasks 2, 5, 6.6; §4 new role → Tasks 1, 3, 4, 6.5; §5 validation → Task 7. ETD write endpoint → Task 1. All covered.
- **Placeholder scan:** No TBD/TODO; every code step has complete code. The one runtime-resolved value (`ETD_NYCOA_COMPANY_ID`) has an explicit resolution command in Task 2.1.
- **Type consistency:** `getDistributionGroups`/`DistributionGroup` (api.ts, Task 5) match usage in Task 6 (`dlOptions`, `g.mail!`, `g.display_name`). `persistNewRole(label, department)` signature (Task 4.1) matches its call site (Task 4.3). `job_title_is_new` defined in Task 3 matches use in Tasks 4.3 and 6.4. `_slugify_key`/`_serialize_title` defined and used within Task 1.

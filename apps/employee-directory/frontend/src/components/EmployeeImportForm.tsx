import { type FormEvent, useState } from "react";

import {
  createEmployee,
  lookupEmployeeFromGraph,
  type CreateEmployeePayload,
  type EmployeeLookupPrefill,
} from "../api/employees";
import { ACCOUNT_TYPE_LABEL, type AccountType } from "../api/types";

const ACCOUNT_TYPE_OPTIONS: AccountType[] = [
  "domain",
  "admin",
  "service",
  "shared_mailbox",
  "third_party",
];

type Props = {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

function EmployeeImportForm({ onClose, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<EmployeeLookupPrefill | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    full_name: string;
    initial_password: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setNotFound(false);
    setAlreadyExists(null);
    setPrefill(null);
    try {
      const result = await lookupEmployeeFromGraph(email.trim());
      if (result.exists && result.employee) {
        setAlreadyExists(result.employee.email);
        return;
      }
      if (!result.found_in_graph || !result.prefilled) {
        setNotFound(true);
        return;
      }
      setPrefill(result.prefilled);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const updatePrefill = <K extends keyof EmployeeLookupPrefill>(
    field: K,
    value: EmployeeLookupPrefill[K]
  ) => {
    setPrefill((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prefill) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: CreateEmployeePayload = {
        email: prefill.email,
        first_name: prefill.first_name,
        last_name: prefill.last_name,
        preferred_name: prefill.preferred_name,
        department: prefill.department,
        title: prefill.title,
        employee_number: prefill.employee_number,
        start_date: prefill.start_date,
        manager_email: prefill.manager_email,
        mobile_phone: prefill.mobile_phone,
        phone: prefill.phone,
        office_location: prefill.office_location,
        account_type: prefill.account_type,
      };
      const result = await createEmployee(payload);
      await onCreated();
      setCreated({
        email: result.employee.email,
        full_name: result.employee.full_name,
        initial_password: result.employee.initial_password,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!created?.initial_password) return;
    try {
      await navigator.clipboard.writeText(created.initial_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (created) {
    return (
      <div className="provision-form">
        <h3 style={{ marginTop: 0 }}>Employee created</h3>
        <p>
          <strong>{created.full_name}</strong> ({created.email}) was added to
          the directory.
        </p>
        {created.initial_password ? (
          <div
            style={{
              marginTop: 12,
              padding: 16,
              border: "1px solid #f59e0b",
              background: "#fffbeb",
              borderRadius: 6,
            }}
          >
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              Auto-generated password — add this to AD now:
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <code
                style={{
                  fontSize: 18,
                  padding: "6px 12px",
                  background: "#1f2937",
                  color: "#fbbf24",
                  borderRadius: 4,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
              >
                {created.initial_password}
              </code>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={handleCopyPassword}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ marginBottom: 0, fontSize: 13, color: "#78350f" }}>
              Stored on the employee record so it will print on the welcome
              packet. Change it in AD after the user signs in.
            </p>
          </div>
        ) : null}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!prefill) {
    return (
      <form className="provision-form" onSubmit={handleLookup}>
        <p>
          Enter an email address to look up the user in Microsoft 365 and
          pre-fill their profile. This does not create or modify the account
          in M365 — it only imports the record into this app.
        </p>
        {lookupError ? <div className="inline-error">{lookupError}</div> : null}
        {notFound ? (
          <div className="inline-error">
            No user found in Microsoft Graph for that email.
          </div>
        ) : null}
        {alreadyExists ? (
          <div className="inline-error">
            This employee already exists in the app: {alreadyExists}
          </div>
        ) : null}
        <div className="form-grid">
          <label>
            Email / UPN
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="someone@acme.demo"
              required
              autoFocus
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={onClose}
            disabled={lookupLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={lookupLoading || !email.trim()}
          >
            {lookupLoading ? "Looking up…" : "Look up"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="provision-form" onSubmit={handleSave}>
      <p>
        Review the details pulled from Microsoft 365, make any edits, then save
        to import this employee into the app.
      </p>
      {saveError ? <div className="inline-error">{saveError}</div> : null}
      <div className="form-grid">
        <label>
          Email / UPN
          <input type="email" value={prefill.email} readOnly disabled />
        </label>
        <label>
          First name
          <input
            type="text"
            value={prefill.first_name}
            onChange={(e) => updatePrefill("first_name", e.target.value)}
            required
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            value={prefill.last_name}
            onChange={(e) => updatePrefill("last_name", e.target.value)}
            required
          />
        </label>
        <label>
          Preferred name
          <input
            type="text"
            value={prefill.preferred_name ?? ""}
            onChange={(e) => updatePrefill("preferred_name", e.target.value || null)}
          />
        </label>
        <label>
          Department
          <input
            type="text"
            value={prefill.department ?? ""}
            onChange={(e) => updatePrefill("department", e.target.value || null)}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            value={prefill.title ?? ""}
            onChange={(e) => updatePrefill("title", e.target.value || null)}
          />
        </label>
        <label>
          Employee number
          <input
            type="text"
            value={prefill.employee_number ?? ""}
            onChange={(e) =>
              updatePrefill("employee_number", e.target.value || null)
            }
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={prefill.start_date ?? ""}
            onChange={(e) => updatePrefill("start_date", e.target.value || null)}
          />
        </label>
        <label>
          Manager email
          <input
            type="email"
            value={prefill.manager_email ?? ""}
            onChange={(e) =>
              updatePrefill("manager_email", e.target.value || null)
            }
          />
        </label>
        <label>
          Office phone
          <input
            type="tel"
            value={prefill.phone ?? ""}
            onChange={(e) => updatePrefill("phone", e.target.value || null)}
          />
        </label>
        <label>
          Cell phone
          <input
            type="tel"
            value={prefill.mobile_phone ?? ""}
            onChange={(e) =>
              updatePrefill("mobile_phone", e.target.value || null)
            }
          />
        </label>
        <label>
          Office location
          <input
            type="text"
            value={prefill.office_location ?? ""}
            onChange={(e) =>
              updatePrefill("office_location", e.target.value || null)
            }
          />
        </label>
        <label>
          Account type
          <select
            value={prefill.account_type}
            onChange={(e) =>
              updatePrefill("account_type", e.target.value as AccountType)
            }
          >
            {ACCOUNT_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {ACCOUNT_TYPE_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-tertiary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Import employee"}
        </button>
      </div>
    </form>
  );
}

export default EmployeeImportForm;

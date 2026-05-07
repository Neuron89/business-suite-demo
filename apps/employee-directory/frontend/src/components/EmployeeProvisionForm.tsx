import type { FormEvent } from "react";
import { useState } from "react";

import type { ProvisionEmployeePayload } from "../api/automation";
import { ACCOUNT_TYPE_LABEL, type AccountType } from "../api/types";

const ACCOUNT_TYPE_OPTIONS: AccountType[] = [
  "domain",
  "admin",
  "service",
  "shared_mailbox",
  "third_party",
];

type EmployeeProvisionFormProps = {
  onSubmit: (values: ProvisionEmployeePayload) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
};

export type EmployeeProvisionFormValues = ProvisionEmployeePayload;

function EmployeeProvisionForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
}: EmployeeProvisionFormProps) {
  const [formValues, setFormValues] = useState<EmployeeProvisionFormValues>({
    first_name: "",
    last_name: "",
    email: "",
        password: "",
    department: "",
    title: "",
    employee_number: "",
    sam_account_name: "",
    force_password_reset: true,
    account_type: "domain",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordValue = formValues.password ?? "";

  const updateField = <K extends keyof EmployeeProvisionFormValues>(
    field: K,
    value: EmployeeProvisionFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPassword = (formValues.password ?? "").trim();
    if (trimmedPassword || confirmPassword) {
      if (trimmedPassword.length < 8) {
        setValidationError("Password must be at least 8 characters long.");
        return;
      }
      if (trimmedPassword !== confirmPassword) {
        setValidationError("Passwords do not match.");
        return;
      }
    }

    setValidationError(null);
    const payload: ProvisionEmployeePayload = {
      ...formValues,
      password: trimmedPassword ? trimmedPassword : null,
      department: formValues.department || null,
      title: formValues.title || null,
      employee_number: formValues.employee_number || null,
      sam_account_name: formValues.sam_account_name || null,
      account_type: formValues.account_type ?? "domain",
    };
    await onSubmit(payload);
  };

  return (
    <form className="provision-form" onSubmit={handleSubmit}>
      <p>
        Provide the details below to create a new employee in local Active
        Directory and Microsoft 365.
      </p>
      {validationError ? (
        <div className="inline-error">{validationError}</div>
      ) : null}
      {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}
      <div className="form-grid">
        <label>
          First name
          <input
            type="text"
            value={formValues.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            required
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            value={formValues.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            required
          />
        </label>
        <label>
          Email / UPN
          <input
            type="email"
            value={formValues.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
          />
        </label>
        <label>
          Account type
          <select
            value={formValues.account_type ?? "domain"}
            onChange={(event) =>
              updateField("account_type", event.target.value as AccountType)
            }
          >
            {ACCOUNT_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Department
          <input
            type="text"
            value={formValues.department ?? ""}
            onChange={(event) => updateField("department", event.target.value)}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            value={formValues.title ?? ""}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </label>
        <label>
          Employee number
          <input
            type="text"
            value={formValues.employee_number ?? ""}
            onChange={(event) =>
              updateField("employee_number", event.target.value)
            }
          />
        </label>
        <label>
          sAM Account Name (optional)
          <input
            type="text"
            value={formValues.sam_account_name ?? ""}
            onChange={(event) =>
              updateField("sam_account_name", event.target.value)
            }
            maxLength={20}
            placeholder="Derived from email if omitted"
          />
        </label>
        <label>
          Initial password
          <input
            type="password"
            value={passwordValue}
            onChange={(event) => updateField("password", event.target.value)}
            autoComplete="new-password"
            placeholder="Leave blank to keep account disabled"
            minLength={passwordValue ? 8 : undefined}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat password if provided"
            minLength={passwordValue ? 8 : undefined}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={formValues.force_password_reset ?? true}
            onChange={(event) =>
              updateField("force_password_reset", event.target.checked)
            }
          />
          Require password change at next sign in
        </label>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-tertiary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Provisioning…" : "Add Employee"}
        </button>
      </div>
    </form>
  );
}

export default EmployeeProvisionForm;



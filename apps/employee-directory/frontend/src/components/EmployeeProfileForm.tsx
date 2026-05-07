import { type FormEvent, useEffect, useState } from "react";

import type { UpdateEmployeeProfilePayload } from "../api/employees";
import { ACCOUNT_TYPE_LABEL, type AccountType, type EmployeeRecord } from "../api/types";

const ACCOUNT_TYPE_OPTIONS: AccountType[] = [
  "domain",
  "admin",
  "service",
  "shared_mailbox",
  "third_party",
];

type EmployeeProfileFormProps = {
  employee: EmployeeRecord;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: UpdateEmployeeProfilePayload) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  first_name: string;
  last_name: string;
  preferred_name: string;
  department: string;
  title: string;
  employee_number: string;
  manager_email: string;
  start_date: string;
  termination_date: string;
  birthday: string;
  phone: string;
  mobile_phone: string;
  extension: string;
  office_location: string;
  notes: string;
  account_type: AccountType;
};

const toDateInput = (value: string | null): string =>
  value ? value.substring(0, 10) : "";

const toText = (value: string | null): string => value ?? "";

function EmployeeProfileForm({
  employee,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: EmployeeProfileFormProps) {
  const [formState, setFormState] = useState<FormState>({
    first_name: employee.first_name,
    last_name: employee.last_name,
    preferred_name: toText(employee.preferred_name),
    department: toText(employee.department),
    title: toText(employee.title),
    employee_number: toText(employee.employee_number),
    manager_email: toText(employee.manager_email),
    start_date: toDateInput(employee.start_date),
    termination_date: toDateInput(employee.termination_date),
    birthday: toDateInput(employee.birthday),
    phone: toText(employee.phone),
    mobile_phone: toText(employee.mobile_phone),
    extension: toText(employee.extension),
    office_location: toText(employee.office_location),
    notes: toText(employee.notes),
    account_type: (employee.account_type ?? "domain") as AccountType,
  });

  useEffect(() => {
    setFormState({
      first_name: employee.first_name,
      last_name: employee.last_name,
      preferred_name: toText(employee.preferred_name),
      department: toText(employee.department),
      title: toText(employee.title),
      employee_number: toText(employee.employee_number),
      manager_email: toText(employee.manager_email),
      start_date: toDateInput(employee.start_date),
      termination_date: toDateInput(employee.termination_date),
      birthday: toDateInput(employee.birthday),
      phone: toText(employee.phone),
      mobile_phone: toText(employee.mobile_phone),
      extension: toText(employee.extension),
      office_location: toText(employee.office_location),
      notes: toText(employee.notes),
      account_type: (employee.account_type ?? "domain") as AccountType,
    });
  }, [employee]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: UpdateEmployeeProfilePayload = {
      first_name: formState.first_name.trim(),
      last_name: formState.last_name.trim(),
      preferred_name: formState.preferred_name.trim() || null,
      department: formState.department.trim() || null,
      title: formState.title.trim() || null,
      employee_number: formState.employee_number.trim() || null,
      manager_email: formState.manager_email.trim() || null,
      start_date: formState.start_date || null,
      termination_date: formState.termination_date || null,
      birthday: formState.birthday || null,
      phone: formState.phone.trim() || null,
      mobile_phone: formState.mobile_phone.trim() || null,
      extension: formState.extension.trim() || null,
      office_location: formState.office_location.trim() || null,
      notes: formState.notes.trim() || null,
      account_type: formState.account_type,
    };
    await onSubmit(payload);
  };

  return (
    <form className="profile-edit-form" onSubmit={handleSubmit}>
      <p>
        Update the employee profile. Changes to name, department, title, or number will
        sync to local Active Directory and Microsoft 365 when configured.
      </p>
      {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}
      <div className="form-grid">
        <label>
          First name
          <input
            type="text"
            value={formState.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            required
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            value={formState.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            required
          />
        </label>
        <label>
          Preferred name
          <input
            type="text"
            value={formState.preferred_name}
            onChange={(event) => updateField("preferred_name", event.target.value)}
            placeholder="Optional display name"
          />
        </label>
        <label>
          Email / UPN
          <input type="email" value={employee.email} readOnly disabled />
        </label>
        <label>
          Department
          <input
            type="text"
            value={formState.department}
            onChange={(event) => updateField("department", event.target.value)}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            value={formState.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </label>
        <label>
          Employee number
          <input
            type="text"
            value={formState.employee_number}
            onChange={(event) => updateField("employee_number", event.target.value)}
          />
        </label>
        <label>
          Manager email
          <input
            type="email"
            value={formState.manager_email}
            onChange={(event) => updateField("manager_email", event.target.value)}
            placeholder="manager@example.com"
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={formState.start_date}
            onChange={(event) => updateField("start_date", event.target.value)}
          />
        </label>
        <label>
          Termination date
          <input
            type="date"
            value={formState.termination_date}
            onChange={(event) => updateField("termination_date", event.target.value)}
          />
        </label>
        <label>
          Birthday
          <input
            type="date"
            value={formState.birthday}
            onChange={(event) => updateField("birthday", event.target.value)}
          />
        </label>
        <label>
          Office phone
          <input
            type="tel"
            value={formState.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="603-555-0100"
          />
        </label>
        <label>
          Cell phone
          <input
            type="tel"
            value={formState.mobile_phone}
            onChange={(event) => updateField("mobile_phone", event.target.value)}
            placeholder="603-555-0100"
          />
        </label>
        <label>
          Extension
          <input
            type="text"
            value={formState.extension}
            onChange={(event) => updateField("extension", event.target.value)}
            placeholder="332"
          />
        </label>
        <label>
          Office location
          <input
            type="text"
            value={formState.office_location}
            onChange={(event) => updateField("office_location", event.target.value)}
            placeholder="Plant A Plant, Room 204"
          />
        </label>
        <label>
          Account type
          <select
            value={formState.account_type}
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
        <label className="profile-edit-form__notes">
          Notes
          <textarea
            value={formState.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={4}
          />
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
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default EmployeeProfileForm;



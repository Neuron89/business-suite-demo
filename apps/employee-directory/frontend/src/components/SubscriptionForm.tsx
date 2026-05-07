import { type ChangeEvent, type FormEvent, useState } from "react";
import type { SoftwareSubscription } from "../api/types";

export type SubscriptionFormSubmission = {
  name: string;
  vendor: string | null;
  license_identifier: string | null;
  cost_center: string | null;
  billing_cycle: string | null;
  cost: number | null;
  renewal_date: string | null;
  assigned_date: string | null;
  notes: string | null;
};

type SubscriptionFormValues = {
  name: string;
  vendor: string;
  licenseIdentifier: string;
  costCenter: string;
  billingCycle: string;
  cost: string;
  renewalDate: string;
  assignedDate: string;
  notes: string;
};

const defaultValues: SubscriptionFormValues = {
  name: "",
  vendor: "",
  licenseIdentifier: "",
  costCenter: "",
  billingCycle: "Monthly",
  cost: "",
  renewalDate: "",
  assignedDate: "",
  notes: "",
};

type SubscriptionFormProps = {
  onSubmit: (values: SubscriptionFormSubmission) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
  initialSubscription?: SoftwareSubscription | null;
  submitLabel?: string;
};

const BILLING_OPTIONS = ["Monthly", "Quarterly", "Yearly", "One-time", "Other"];

function fromSubscription(s: SoftwareSubscription): SubscriptionFormValues {
  return {
    name: s.name ?? "",
    vendor: s.vendor ?? "",
    licenseIdentifier: s.license_identifier ?? "",
    costCenter: s.cost_center ?? "",
    billingCycle: s.billing_cycle ?? "Monthly",
    cost: s.cost != null ? String(s.cost) : "",
    renewalDate: s.renewal_date ?? "",
    assignedDate: s.assigned_date ?? "",
    notes: s.notes ?? "",
  };
}

function SubscriptionForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
  initialSubscription,
  submitLabel,
}: SubscriptionFormProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(
    initialSubscription ? fromSubscription(initialSubscription) : defaultValues
  );

  const handleChange =
    (field: keyof SubscriptionFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: SubscriptionFormSubmission = {
      name: values.name.trim(),
      vendor: values.vendor.trim() || null,
      license_identifier: values.licenseIdentifier.trim() || null,
      cost_center: values.costCenter.trim() || null,
      billing_cycle: values.billingCycle.trim() || null,
      cost: values.cost ? Number.parseFloat(values.cost) : null,
      renewal_date: values.renewalDate || null,
      assigned_date: values.assignedDate || null,
      notes: values.notes.trim() || null,
    };

    if (!payload.name) {
      return;
    }

    if (Number.isNaN(payload.cost ?? 0)) {
      payload.cost = null;
    }

    await onSubmit(payload);
    if (!initialSubscription) {
      setValues(defaultValues);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="form-grid__full">
        Name<span className="required">*</span>
        <input
          type="text"
          required
          value={values.name}
          onChange={handleChange("name")}
          placeholder="e.g., Adobe Creative Cloud"
        />
      </label>
      <label>
        Vendor
        <input
          type="text"
          value={values.vendor}
          onChange={handleChange("vendor")}
          placeholder="e.g., Adobe"
        />
      </label>
      <label>
        License Identifier
        <input
          type="text"
          value={values.licenseIdentifier}
          onChange={handleChange("licenseIdentifier")}
          placeholder="e.g., License key, seat ID"
        />
      </label>
      <label>
        Billing Cycle
        <select
          value={values.billingCycle}
          onChange={handleChange("billingCycle")}
        >
          {BILLING_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cost (USD)
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.cost}
          onChange={handleChange("cost")}
          placeholder="e.g., 49.99"
        />
      </label>
      <label>
        Cost Center / Budget
        <input
          type="text"
          value={values.costCenter}
          onChange={handleChange("costCenter")}
          placeholder="e.g., Marketing"
        />
      </label>
      <label>
        Renewal Date
        <input
          type="date"
          value={values.renewalDate}
          onChange={handleChange("renewalDate")}
        />
      </label>
      <label>
        Assigned Date
        <input
          type="date"
          value={values.assignedDate}
          onChange={handleChange("assignedDate")}
        />
      </label>
      <label className="form-grid__full">
        Notes
        <textarea
          rows={3}
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Add usage details, approvers, or special steps to revoke access."
        />
      </label>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-tertiary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Saving…" : (submitLabel ?? "Save Subscription")}
        </button>
      </div>
    </form>
  );
}

export default SubscriptionForm;


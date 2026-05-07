import { type ChangeEvent, type FormEvent, useState } from "react";

export type DirectoryGroupFormSubmission = {
  group_name: string;
  group_scope: string | null;
  group_type: string | null;
  description: string | null;
  source: string;
};

type DirectoryGroupFormValues = {
  groupName: string;
  groupScope: string;
  groupType: string;
  description: string;
  source: string;
};

const defaultValues: DirectoryGroupFormValues = {
  groupName: "",
  groupScope: "",
  groupType: "",
  description: "",
  source: "manual",
};

type DirectoryGroupFormProps = {
  onSubmit: (values: DirectoryGroupFormSubmission) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
};

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "local_ad", label: "Local Active Directory" },
  { value: "entra_id", label: "Microsoft Entra ID" },
];

function DirectoryGroupForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
}: DirectoryGroupFormProps) {
  const [values, setValues] =
    useState<DirectoryGroupFormValues>(defaultValues);

  const handleChange =
    (field: keyof DirectoryGroupFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: DirectoryGroupFormSubmission = {
      group_name: values.groupName.trim(),
      group_scope: values.groupScope.trim() || null,
      group_type: values.groupType.trim() || null,
      description: values.description.trim() || null,
      source: values.source,
    };

    if (!payload.group_name) {
      return;
    }

    await onSubmit(payload);
    setValues(defaultValues);
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="form-grid__full">
        Group Name<span className="required">*</span>
        <input
          type="text"
          required
          value={values.groupName}
          onChange={handleChange("groupName")}
          placeholder="e.g., Finance Share Permissions"
        />
      </label>
      <label>
        Scope / OU
        <input
          type="text"
          value={values.groupScope}
          onChange={handleChange("groupScope")}
          placeholder="e.g., \\domain\\Departments\\Finance"
        />
      </label>
      <label>
        Group Type
        <input
          type="text"
          value={values.groupType}
          onChange={handleChange("groupType")}
          placeholder="e.g., Security, Distribution"
        />
      </label>
      <label>
        Source
        <select
          value={values.source}
          onChange={handleChange("source")}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-grid__full">
        Notes / Description
        <textarea
          rows={3}
          value={values.description}
          onChange={handleChange("description")}
          placeholder="Describe folder paths or special access this group grants."
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
          {submitting ? "Saving…" : "Save Group"}
        </button>
      </div>
    </form>
  );
}

export default DirectoryGroupForm;


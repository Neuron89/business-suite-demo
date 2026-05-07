import { type ChangeEvent, type FormEvent, useState } from "react";
import type { HardwareAsset } from "../api/types";

type HardwareFormValues = {
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  purchaseDate: string;
  purchasePrice: string;
  assignedDate: string;
  returnDueDate: string;
  notes: string;
};

export type HardwareFormSubmission = {
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  assigned_date: string | null;
  return_due_date: string | null;
  notes: string | null;
};

const defaultValues: HardwareFormValues = {
  assetType: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  assetTag: "",
  purchaseDate: "",
  purchasePrice: "",
  assignedDate: "",
  returnDueDate: "",
  notes: "",
};

type HardwareFormProps = {
  onSubmit: (values: HardwareFormSubmission) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
  initialAsset?: HardwareAsset | null;
  submitLabel?: string;
};

function fromAsset(a: HardwareAsset): HardwareFormValues {
  return {
    assetType: a.asset_type ?? "",
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    serialNumber: a.serial_number ?? "",
    assetTag: a.asset_tag ?? "",
    purchaseDate: a.purchase_date ?? "",
    purchasePrice: a.purchase_price != null ? String(a.purchase_price) : "",
    assignedDate: a.assigned_date ?? "",
    returnDueDate: a.return_due_date ?? "",
    notes: a.notes ?? "",
  };
}

function HardwareForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
  initialAsset,
  submitLabel,
}: HardwareFormProps) {
  const [values, setValues] = useState<HardwareFormValues>(
    initialAsset ? fromAsset(initialAsset) : defaultValues
  );

  const handleChange =
    (field: keyof HardwareFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: HardwareFormSubmission = {
      asset_type: values.assetType.trim(),
      manufacturer: values.manufacturer.trim() || null,
      model: values.model.trim() || null,
      serial_number: values.serialNumber.trim() || null,
      asset_tag: values.assetTag.trim() || null,
      purchase_date: values.purchaseDate || null,
      assigned_date: values.assignedDate || null,
      return_due_date: values.returnDueDate || null,
      notes: values.notes.trim() || null,
      purchase_price: values.purchasePrice
        ? Number.parseFloat(values.purchasePrice)
        : null,
    };

    if (Number.isNaN(payload.purchase_price ?? 0)) {
      payload.purchase_price = null;
    }

    await onSubmit(payload);
    if (!initialAsset) {
      setValues(defaultValues);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Asset Type<span className="required">*</span>
        <input
          type="text"
          required
          value={values.assetType}
          onChange={handleChange("assetType")}
          placeholder="e.g., Laptop"
        />
      </label>
      <label>
        Manufacturer
        <input
          type="text"
          value={values.manufacturer}
          onChange={handleChange("manufacturer")}
          placeholder="e.g., Dell"
        />
      </label>
      <label>
        Model
        <input
          type="text"
          value={values.model}
          onChange={handleChange("model")}
          placeholder="e.g., Latitude 7450"
        />
      </label>
      <label>
        Serial Number
        <input
          type="text"
          value={values.serialNumber}
          onChange={handleChange("serialNumber")}
        />
      </label>
      <label>
        Asset Tag
        <input
          type="text"
          value={values.assetTag}
          onChange={handleChange("assetTag")}
        />
      </label>
      <label>
        Purchase Date
        <input
          type="date"
          value={values.purchaseDate}
          onChange={handleChange("purchaseDate")}
        />
      </label>
      <label>
        Purchase Price
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.purchasePrice}
          onChange={handleChange("purchasePrice")}
          placeholder="e.g., 1250.00"
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
      <label>
        Return Due Date
        <input
          type="date"
          value={values.returnDueDate}
          onChange={handleChange("returnDueDate")}
        />
      </label>
      <label className="form-grid__full">
        Notes
        <textarea
          rows={3}
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Add any special instructions or accessories."
        />
      </label>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <div className="form-actions">
        <button type="button" className="btn btn-tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Saving…" : (submitLabel ?? "Save Asset")}
        </button>
      </div>
    </form>
  );
}

export default HardwareForm;


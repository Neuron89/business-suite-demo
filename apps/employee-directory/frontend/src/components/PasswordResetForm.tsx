import { type FormEvent, useState } from "react";

import type { ResetPasswordPayload } from "../api/employees";

type PasswordResetFormProps = {
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: ResetPasswordPayload) => Promise<void>;
  onCancel: () => void;
};

function PasswordResetForm({ submitting, errorMessage, onSubmit, onCancel }: PasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generate, setGenerate] = useState(true);
  const [forceReset, setForceReset] = useState(true);
  const [enableAd, setEnableAd] = useState(false);
  const [enableM365, setEnableM365] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPassword = password.trim();

    if (!generate) {
      if (!trimmedPassword) {
        setValidationError("Enter a new password or enable automatic generation.");
        return;
      }
      if (trimmedPassword.length < 8) {
        setValidationError("Password must be at least 8 characters long.");
        return;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        setValidationError("Passwords do not match.");
        return;
      }
    }

    setValidationError(null);
    const payload: ResetPasswordPayload = {
      password: generate ? null : trimmedPassword,
      generate,
      force_password_reset: forceReset,
      enable_local_ad: enableAd,
      enable_m365: enableM365,
    };
    await onSubmit(payload);
  };

  return (
    <form className="password-reset-form" onSubmit={handleSubmit}>
      <p>
        Reset the employee's password in both local Active Directory and Microsoft 365.
        The new password will be shown once the reset completes.
      </p>
      {validationError ? <div className="inline-error">{validationError}</div> : null}
      {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}
      <div className="form-grid">
        <label className="checkbox form-grid__full">
          <input
            type="checkbox"
            checked={generate}
            onChange={(event) => setGenerate(event.target.checked)}
          />
          Generate a random strong password
        </label>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={generate}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={generate}
            autoComplete="new-password"
          />
        </label>
        <label className="checkbox form-grid__full">
          <input
            type="checkbox"
            checked={forceReset}
            onChange={(event) => setForceReset(event.target.checked)}
          />
          Require password change at next sign-in
        </label>
        <label className="checkbox form-grid__full">
          <input
            type="checkbox"
            checked={enableAd}
            onChange={(event) => setEnableAd(event.target.checked)}
          />
          Enable local Active Directory account (if it was disabled)
        </label>
        <label className="checkbox form-grid__full">
          <input
            type="checkbox"
            checked={enableM365}
            onChange={(event) => setEnableM365(event.target.checked)}
          />
          Enable Microsoft 365 sign-in (if it was blocked)
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
          {submitting ? "Resetting…" : "Reset Password"}
        </button>
      </div>
    </form>
  );
}

export default PasswordResetForm;

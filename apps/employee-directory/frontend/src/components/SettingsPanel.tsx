import { useEffect, useState } from "react";
import { fetchSettings, updateSettings, type SettingItem } from "../api/settings";
import Modal from "./Modal";

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  companyId: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  systems: "System URLs",
  network: "Network",
};

function SettingsPanel({ isOpen, onClose, companyId }: SettingsPanelProps) {
  const [grouped, setGrouped] = useState<Record<string, SettingItem[]>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    fetchSettings(companyId)
      .then((data) => {
        setGrouped(data.settings);
        const vals: Record<string, string> = {};
        for (const items of Object.values(data.settings)) {
          for (const item of items) {
            vals[item.setting_key] = item.setting_value;
          }
        }
        setValues(vals);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load settings")
      )
      .finally(() => setLoading(false));
  }, [isOpen, companyId]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = Object.entries(values).map(([setting_key, setting_value]) => ({
        setting_key,
        setting_value,
      }));
      if (!companyId) return;
      const result = await updateSettings(companyId, payload);
      setSuccess(`Saved ${result.updated} setting(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const categoryOrder = ["general", "systems", "network"];
  const orderedCategories = categoryOrder.filter((c) => grouped[c]);

  return (
    <Modal isOpen={isOpen} title="Organization Settings" onClose={onClose}>
      <div className="settings-panel">
        {!companyId && <p>Select a company first.</p>}
        {companyId && loading && <p>Loading settings...</p>}

        {error && (
          <div className="inline-error">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="inline-success">
            <span>{success}</span>
          </div>
        )}

        {!loading &&
          orderedCategories.map((category) => (
            <fieldset key={category} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px", marginBottom: 16 }}>
              <legend style={{ fontWeight: 600, fontSize: 14, padding: "0 6px" }}>
                {CATEGORY_LABELS[category] ?? category}
              </legend>
              {grouped[category].map((item) => (
                <label
                  key={item.setting_key}
                  style={{ display: "block", marginBottom: 10 }}
                >
                  <span style={{ display: "block", fontSize: 13, marginBottom: 2 }}>
                    {item.setting_label}
                  </span>
                  <input
                    type={item.setting_key.includes("password") ? "password" : "text"}
                    value={values[item.setting_key] ?? ""}
                    onChange={(e) => handleChange(item.setting_key, e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }}
                    placeholder={item.setting_label}
                  />
                </label>
              ))}
            </fieldset>
          ))}

        {!loading && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SettingsPanel;

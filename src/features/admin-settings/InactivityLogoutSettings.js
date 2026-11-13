import React, { useCallback, useEffect, useState } from "react";
import { getInactivitySettings, saveInactivitySettings } from "../../services/executiveService";
import "../../styles/inactivitySettings.css";

export const PRESET_MINUTES = [5, 10, 15];
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 480;

export const validateMinutes = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_MINUTES || n > MAX_MINUTES) {
    return `Enter a whole number of minutes between ${MIN_MINUTES} and ${MAX_MINUTES}.`;
  }
  return null;
};

// Admin -> Settings -> Auto Logout. One tenant-wide value, stored in the
// company database; the executive panel reads it and enforces it (with the
// work session saved before the logout).
const InactivityLogoutSettings = ({ onNotify }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [choice, setChoice] = useState("custom"); // "5" | "10" | "15" | "custom"
  const [custom, setCustom] = useState("45");
  const [error, setError] = useState("");

  const apply = useCallback((data) => {
    setEnabled(!!data.enabled);
    const m = Number(data.minutes);
    if (PRESET_MINUTES.includes(m)) {
      setChoice(String(m));
    } else {
      setChoice("custom");
      setCustom(String(m));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getInactivitySettings();
        if (!cancelled) apply(data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Could not load the current setting.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const minutes = choice === "custom" ? custom : choice;

  const submit = async (e) => {
    e.preventDefault();
    if (enabled) {
      const problem = validateMinutes(minutes);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError("");
    setSaving(true);
    try {
      // When switched off, keep the last valid duration so re-enabling restores it.
      const payload = { enabled, minutes: validateMinutes(minutes) ? 45 : Number(minutes) };
      const saved = await saveInactivitySettings(payload);
      apply(saved);
      onNotify?.("success", "Saved", enabled ? `Users are logged out after ${saved.minutes} minutes of inactivity.` : "Automatic inactivity logout is turned off.");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save the setting.";
      setError(msg);
      onNotify?.("error", "Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <h3>Automatic Inactivity Logout</h3>
      <p className="inactivity-help">
        Sign users out after a period without mouse, keyboard or touch activity. The executive&apos;s work session is
        saved before the logout, and a warning appears one minute earlier. This applies to every user of your company.
      </p>
      <form className="profile-form inactivity-form" onSubmit={submit} noValidate>
        <label className="inactivity-switch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable automatic logout</span>
        </label>

        <fieldset className="inactivity-options" disabled={!enabled}>
          <legend>Log out after</legend>
          {PRESET_MINUTES.map((m) => (
            <label key={m} className={`inactivity-chip ${choice === String(m) ? "is-selected" : ""}`}>
              <input type="radio" name="inactivity" value={m} checked={choice === String(m)} onChange={() => setChoice(String(m))} />
              {m} minutes
            </label>
          ))}
          <label className={`inactivity-chip ${choice === "custom" ? "is-selected" : ""}`}>
            <input type="radio" name="inactivity" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} />
            Custom
          </label>
          {choice === "custom" && (
            <span className="inactivity-custom">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step="1"
                aria-label="Custom minutes"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              minutes
            </span>
          )}
        </fieldset>
        <small>
          Allowed range for a custom value: {MIN_MINUTES}-{MAX_MINUTES} minutes.
        </small>

        {error && (
          <div className="settings-inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group full save-btn-wrapper">
          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>
  );
};

export default InactivityLogoutSettings;

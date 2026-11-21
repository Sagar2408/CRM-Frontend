import React, { useCallback, useEffect, useState } from "react";
import { getProcessClientDetailsApi, updateProcessClientDetailsApi } from "../../services/processService";

const FIELDS = [
  { key: "fullName", label: "Full name", type: "text", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  { key: "country", label: "Country", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "education", label: "Education", type: "text" },
  { key: "experience", label: "Experience", type: "text" },
  { key: "dob", label: "Date of birth", type: "date" },
];

const pick = (client) => Object.fromEntries(FIELDS.map((f) => [f.key, client?.[f.key] || ""]));
const today = () => new Date().toISOString().slice(0, 10);

// The shared client record: the same values the Executive saved. Editing writes to the existing
// customer / lead records (server side) and never blanks a saved value out.
export default function ClientDetailsCard({ customerId, onLoaded, onSaved }) {
  const [state, setState] = useState({ loading: true, error: "", client: null });
  const [form, setForm] = useState(pick(null));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const client = await getProcessClientDetailsApi(customerId);
      setState({ loading: false, error: "", client });
      setForm(pick(client));
      onLoaded?.(client);
    } catch (err) {
      setState({ loading: false, error: err.message || "Could not load client details.", client: null });
    }
    // onLoaded is intentionally not a dependency: callers pass inline callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyKeys = FIELDS.map((f) => f.key).filter((k) => String(form[k] || "").trim() !== String(state.client?.[k] || "").trim());
  const dirty = dirtyKeys.length > 0;

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || saving) return;
    // Only changed fields with a value are sent; an emptied input never erases saved data.
    const payload = Object.fromEntries(dirtyKeys.filter((k) => String(form[k] || "").trim() !== "").map((k) => [k, String(form[k]).trim()]));
    if (Object.keys(payload).length === 0) {
      setMessage({ kind: "error", text: "Saved values cannot be cleared. Enter a new value instead." });
      return;
    }
    setSaving(true);
    setMessage({ kind: "", text: "" });
    try {
      const res = await updateProcessClientDetailsApi(customerId, payload);
      setState({ loading: false, error: "", client: res.client });
      setForm(pick(res.client));
      setMessage({ kind: "ok", text: "Client details saved." });
      onSaved?.(res.client);
    } catch (err) {
      setMessage({ kind: "error", text: err.message || "Could not save client details." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pfu-card" aria-labelledby="pfu-details-h">
      <h2 id="pfu-details-h" className="pfu-card__title">Client details</h2>
      <p className="pfu-hint">Shared with the Executive: you see what they saved, and your changes are saved to the same client record.</p>
      {state.loading && <div className="pfu-skel" aria-busy="true">Loading client details...</div>}
      {state.error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {state.error}{" "}
          <button type="button" className="pfu-link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {state.client && (
        <form className="pfu-fields" onSubmit={save} noValidate>
          {FIELDS.map((f) => (
            <label key={f.key} className="pfu-field">
              <span>{f.label}</span>
              <input
                type={f.type}
                value={form[f.key]}
                autoComplete={f.autoComplete}
                max={f.type === "date" ? today() : undefined}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="pfu-actions pfu-fields__actions">
            <button type="submit" className="pp-btn pp-btn--primary" disabled={!dirty || saving}>
              {saving ? "Saving..." : "Save details"}
            </button>
            {dirty && !saving && (
              <button type="button" className="pp-btn" onClick={() => setForm(pick(state.client))}>
                Discard
              </button>
            )}
            {message.text && (
              <span className={`pfu-msg pfu-msg--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
                {message.text}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

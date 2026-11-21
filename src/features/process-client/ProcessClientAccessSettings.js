import React, { useCallback, useEffect, useState } from "react";
import { getClientAccessStatus, setClientAccessPassword, changeClientAccessPassword } from "../../services/clientAccess";
import "../../styles/processModern.css";
import "../../styles/manageClients.css";

const strongEnough = (p) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

// Settings > Client Portal Access Password: the separate password that unlocks Manage Clients. It is NOT
// the CRM login password. First time: confirm with the CRM login password; afterwards: the current access
// password is required to change it. The server stores only a hash.
export default function ProcessClientAccessSettings() {
  const [state, setState] = useState({ loading: true, error: "", isSet: false });
  const [form, setForm] = useState({ loginPassword: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: "", text: "" });
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const s = await getClientAccessStatus();
      setState({ loading: false, error: "", isSet: !!s.isSet });
    } catch (err) {
      setState({ loading: false, error: err.message || "Could not load your access password status.", isSet: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = {};
    if (state.isSet && !form.currentPassword) found.currentPassword = "Enter your current access password.";
    if (!state.isSet && !form.loginPassword) found.loginPassword = "Enter your CRM login password to confirm it is you.";
    if (!strongEnough(form.newPassword)) found.newPassword = "Use 8-72 characters with at least one letter and one number.";
    if (form.confirmPassword !== form.newPassword) found.confirmPassword = "The two passwords do not match.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setMessage({ kind: "", text: "" });
    try {
      const res = state.isSet
        ? await changeClientAccessPassword(form.currentPassword, form.newPassword, form.confirmPassword)
        : await setClientAccessPassword(form.loginPassword, form.newPassword, form.confirmPassword);
      setForm({ loginPassword: "", currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ kind: "ok", text: res.message || "Saved." });
      await load();
    } catch (err) {
      setMessage({ kind: "error", text: err.message || "Could not save the password." });
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, autoComplete) => (
    <div className="mc-field">
      <label htmlFor={`mc-acc-${k}`}>{label}</label>
      <input
        id={`mc-acc-${k}`}
        type="password"
        autoComplete={autoComplete}
        value={form[k]}
        disabled={busy}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `mc-acc-${k}-err` : undefined}
      />
      {errors[k] && (
        <small id={`mc-acc-${k}-err`} className="mc-err">
          {errors[k]}
        </small>
      )}
    </div>
  );

  return (
    <section className="mc-settings" aria-labelledby="mc-access-title">
      <h2 id="mc-access-title" className="mc-h3">Client Portal Access Password</h2>
      <p className="mc-muted">
        This password protects <strong>Manage Clients</strong>. It is separate from your CRM login password and is stored only as a secure hash. Manage Clients stays unlocked while you are active and locks again after a period of inactivity.
      </p>

      {state.loading && <p className="mc-muted">Loading...</p>}
      {state.error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {state.error}{" "}
          <button type="button" className="mc-link" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!state.loading && !state.error && (
        <form onSubmit={submit} noValidate>
          <p className="mc-status">
            Status: <span className={`mc-badge ${state.isSet ? "mc-badge--active" : "mc-badge--not_set"}`}>{state.isSet ? "Set" : "Not set"}</span>
          </p>
          {state.isSet ? field("currentPassword", "Current access password", "off") : field("loginPassword", "CRM login password (to confirm it is you)", "current-password")}
          {field("newPassword", state.isSet ? "New access password" : "Access password", "new-password")}
          {field("confirmPassword", "Confirm access password", "new-password")}
          <p className="mc-hint">At least 8 characters with a letter and a number. It must differ from your CRM login password.</p>
          <div className="mc-actions">
            <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
              {busy ? "Saving..." : state.isSet ? "Change access password" : "Set access password"}
            </button>
          </div>
        </form>
      )}

      {message.text && (
        <p className={`mc-msg mc-msg--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </section>
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getClientPortalInfo, setClientPortalPassword, setClientPortalActive } from "../../services/clientAccess";

const STATUS_TEXT = { active: "Active", disabled: "Disabled", not_set: "Not set" };

// Per-client portal login. The login e-mail is the client's existing CRM e-mail (read-only here); the
// Process Person sets / resets the password (never shown again, never stored in the browser) and can
// enable or disable portal access. Every call is checked server-side against the assigned-client rule.
export default function ClientPortalCredentialsModal({ client, onClose, onChanged }) {
  const [state, setState] = useState({ loading: true, error: "", portal: null });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: "", text: "" });
  const dialogRef = useRef(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      setState({ loading: false, error: "", portal: await getClientPortalInfo(client.id) });
    } catch (err) {
      setState({ loading: false, error: err.message || "Could not load portal access.", portal: null });
    }
  }, [client.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes; focus starts inside the dialog
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = state.portal?.status || "not_set";

  const savePassword = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setMessage({ kind: "error", text: "Use at least 8 characters." });
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setMessage({ kind: "error", text: "Include at least one letter and one number." });
    if (password !== confirm) return setMessage({ kind: "error", text: "The two passwords do not match." });
    setBusy(true);
    setMessage({ kind: "", text: "" });
    try {
      const res = await setClientPortalPassword(client.id, password, confirm);
      setPassword("");
      setConfirm("");
      setMessage({ kind: "ok", text: res.message || "Saved." });
      await load();
      onChanged?.();
    } catch (err) {
      setMessage({ kind: "error", text: err.message || "Could not save the password." });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setMessage({ kind: "", text: "" });
    try {
      const res = await setClientPortalActive(client.id, status !== "active");
      setMessage({ kind: "ok", text: res.message });
      await load();
      onChanged?.();
    } catch (err) {
      setMessage({ kind: "error", text: err.message || "Could not change access." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" aria-labelledby="mc-cred-title" tabIndex={-1} ref={dialogRef}>
        <header className="mc-modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 id="mc-cred-title" className="mc-modal__title">Client Portal Credentials</h2>
            <p className="mc-muted">{client.fullName}</p>
          </div>
          <button type="button" className="pp-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        {state.loading && <p className="mc-muted">Loading...</p>}
        {state.error && (
          <div className="pp-alert pp-alert--error" role="alert">
            {state.error}{" "}
            <button type="button" className="mc-link" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {state.portal && (
          <>
            <dl className="mc-facts">
              <div>
                <dt>Login e-mail</dt>
                <dd>{state.portal.loginEmail || "No e-mail"}</dd>
              </div>
              <div>
                <dt>Portal access</dt>
                <dd>
                  <span className={`mc-badge mc-badge--${status}`}>{STATUS_TEXT[status]}</span>
                </dd>
              </div>
              {state.portal.lastLoginAt && (
                <div>
                  <dt>Last sign-in</dt>
                  <dd>{new Date(state.portal.lastLoginAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>

            <form onSubmit={savePassword} noValidate>
              <h3 className="mc-h3">{status === "not_set" ? "Set Client Portal Password" : "Reset password"}</h3>
              <p className="mc-muted">The client signs in at the normal CRM login page with the company code, this e-mail and this password. It is never shown again.</p>
              <label className="mc-field">
                <span>{status === "not_set" ? "Initial password" : "New password"}</span>
                <input type="password" autoComplete="new-password" value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="mc-field">
                <span>Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <p className="mc-hint">At least 8 characters with a letter and a number.</p>
              <div className="mc-actions">
                <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
                  {busy ? "Saving..." : status === "not_set" ? "Create portal access" : "Reset password"}
                </button>
                {status !== "not_set" && (
                  <button type="button" className="pp-btn" onClick={toggle} disabled={busy}>
                    {status === "active" ? "Disable access" : "Enable access"}
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        {message.text && (
          <p className={`mc-msg mc-msg--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

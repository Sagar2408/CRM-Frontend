import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CLIENT_ACCESS_LOCKED_EVENT,
  getClientAccessStatus,
  readClientAccessGrant,
  renewClientAccessGrant,
  verifyClientAccessPassword,
} from "../../services/clientAccess";
import "../../styles/processModern.css";
import "../../styles/manageClients.css";

const ACTIVITY_PING_MS = 60 * 1000;
const EXPIRY_CHECK_MS = 15 * 1000;

// Nothing about any client is rendered (or requested) until the Process Person proves their separate
// Client Portal Access Password. The unlock lasts across refreshes of the same session (a server-signed
// grant in sessionStorage - never the password) and ends after an idle period, on logout, or when the
// server says it expired. Activity inside Manage Clients keeps it alive.
export default function ManageClientsGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => !!readClientAccessGrant());
  const [status, setStatus] = useState({ loading: true, isSet: true, locked: false, retryAfterMinutes: null });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastPing = useRef(0);

  // lock again when the server rejects the grant or the idle window passes
  useEffect(() => {
    const lock = () => setUnlocked(false);
    window.addEventListener(CLIENT_ACCESS_LOCKED_EVENT, lock);
    const timer = setInterval(() => {
      if (!readClientAccessGrant()) setUnlocked(false);
    }, EXPIRY_CHECK_MS);
    return () => {
      window.removeEventListener(CLIENT_ACCESS_LOCKED_EVENT, lock);
      clearInterval(timer);
    };
  }, []);

  // user activity while unlocked renews the grant (throttled)
  useEffect(() => {
    if (!unlocked) return undefined;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing.current < ACTIVITY_PING_MS) return;
      lastPing.current = now;
      renewClientAccessGrant().catch(() => {});
    };
    const events = ["click", "keydown"];
    events.forEach((e) => window.addEventListener(e, ping));
    return () => events.forEach((e) => window.removeEventListener(e, ping));
  }, [unlocked]);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getClientAccessStatus();
      setStatus({ loading: false, isSet: !!s.isSet, locked: !!s.locked, retryAfterMinutes: s.retryAfterMinutes });
    } catch (err) {
      setStatus({ loading: false, isSet: true, locked: false, retryAfterMinutes: null });
      setError(err.message || "Could not check your access password.");
    }
  }, []);

  useEffect(() => {
    if (!unlocked) loadStatus();
  }, [unlocked, loadStatus]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!password) return setError("Enter your Client Portal Access Password.");
    setBusy(true);
    setError("");
    try {
      await verifyClientAccessPassword(password);
      setPassword("");
      lastPing.current = Date.now();
      setUnlocked(true);
    } catch (err) {
      setPassword("");
      if (err.code === "ACCESS_LOCKED") setStatus((s) => ({ ...s, locked: true, retryAfterMinutes: err.data?.retryAfterMinutes ?? null }));
      if (err.code === "ACCESS_PASSWORD_NOT_SET") setStatus((s) => ({ ...s, isSet: false }));
      setError(err.message || "Could not verify the password.");
    } finally {
      setBusy(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="pp-page mc-gate">
      <section className="mc-gate__card" role="dialog" aria-modal="false" aria-labelledby="mc-gate-title">
        <h1 id="mc-gate-title" className="mc-gate__title">Manage Clients is protected</h1>
        <p className="mc-gate__text">Enter your <strong>Client Portal Access Password</strong> to see your clients. This is separate from your CRM login password.</p>

        {!status.loading && !status.isSet ? (
          <div className="pp-alert" role="status">
            You have not set an access password yet. <Link to="/process/process-settings/client-access">Set it in Settings &rarr; Client Portal Access Password</Link>.
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label className="mc-field">
              <span>Access password</span>
              <input
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                disabled={busy || status.locked}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {status.locked && (
              <p className="mc-err" role="alert">
                Too many incorrect attempts{status.retryAfterMinutes ? `. Try again in ${status.retryAfterMinutes} minute${status.retryAfterMinutes === 1 ? "" : "s"}.` : "."}
              </p>
            )}
            {error && !status.locked && (
              <p className="mc-err" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="pp-btn pp-btn--primary mc-gate__btn" disabled={busy || status.locked}>
              {busy ? "Checking..." : "Unlock"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

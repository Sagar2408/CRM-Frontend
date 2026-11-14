import React, { useCallback, useEffect, useState } from "react";
import { masterAdmin, errorMessage, fmtDateTime } from "../../../../services/masterAdminService";
import { Msg, Field, useReportDirty } from "./common";

const STATUS = {
  not_configured: ["Not configured", "unconfigured"],
  untested: ["Not tested", "untested"],
  connected: ["Connected", "connected"],
  failed: ["Connection failed", "failed"],
};

const fromDb = (d) => ({ db_name: d.db_name || "", db_host: d.db_host || "", db_port: String(d.db_port || 3306), db_user: d.db_user || "", db_password: "" });

/**
 * Tenant database settings. The stored password is never sent to the browser: the field is always
 * blank, and leaving it blank keeps the current password. The typed password lives in state only
 * until the save completes.
 */
const DatabaseTab = ({ company, reload, setDirty }) => {
  const [db, setDb] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await masterAdmin.database(company.id);
      setDb(d);
      setForm(fromDb(d));
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not load the database configuration.") });
    }
  }, [company.id]);
  useEffect(() => { load(); }, [load]);

  const dirty = !!db && !!form && JSON.stringify(form) !== JSON.stringify(fromDb(db));
  useReportDirty(dirty, setDirty);

  if (!db || !form) return <div className="mc-card">{msg ? <Msg msg={msg} /> : <div className="mc-skel" aria-busy="true" />}</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const [statusLabel, statusClass] = STATUS[db.status] || STATUS.not_configured;

  const validate = () => {
    const e = {};
    if (!form.db_name.trim()) e.db_name = "Database name is required.";
    else if (!/^[A-Za-z0-9_$-]+$/.test(form.db_name.trim())) e.db_name = "Letters, digits, _, $ and - only.";
    if (!form.db_host.trim()) e.db_host = "Host is required.";
    else if (!/^[A-Za-z0-9._-]+$/.test(form.db_host.trim())) e.db_host = "Enter a host name or IP address only (no http://, no port).";
    const p = Number(form.db_port);
    if (!(Number.isInteger(p) && p >= 1 && p <= 65535)) e.db_port = "Port must be 1-65535.";
    if (!form.db_user.trim()) e.db_user = "Database username is required.";
    if (!db.passwordSet && !form.db_password) e.db_password = "A password is required the first time.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy("save");
    setMsg(null);
    try {
      const body = { db_name: form.db_name.trim(), db_host: form.db_host.trim(), db_port: Number(form.db_port), db_user: form.db_user.trim() };
      if (form.db_password) body.db_password = form.db_password;
      const r = await masterAdmin.saveDatabase(company.id, body);
      setDb(r.database);
      setForm(fromDb(r.database)); // the typed password is dropped from state here
      setDirty(false);
      setMsg({ type: "ok", text: r.message });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not save the database configuration.") });
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setBusy("test");
    setMsg(null);
    try {
      const r = await masterAdmin.testDatabase(company.id);
      setDb(r.database);
      setMsg({ type: r.ok ? "ok" : "error", text: r.message });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not test the connection.") });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mc-card">
      <p>
        Connection status: <span className={`mc-badge db-${statusClass}`}>{statusLabel}</span>
        {db.lastTestAt && <span className="mc-muted"> · last tested {fmtDateTime(db.lastTestAt)}</span>}
      </p>
      <Msg msg={msg} />
      <div className="mc-form" style={{ margin: "12px 0" }}>
        <Field id="db-name" label="Database name *" error={errors.db_name}>
          <input id="db-name" className="mc-input" value={form.db_name} onChange={set("db_name")} maxLength={64} autoComplete="off" aria-invalid={!!errors.db_name} />
        </Field>
        <Field id="db-host" label="Database host *" error={errors.db_host}>
          <input id="db-host" className="mc-input" value={form.db_host} onChange={set("db_host")} maxLength={255} autoComplete="off" aria-invalid={!!errors.db_host} />
        </Field>
        <Field id="db-port" label="Database port *" error={errors.db_port}>
          <input id="db-port" type="number" min={1} max={65535} className="mc-input" value={form.db_port} onChange={set("db_port")} aria-invalid={!!errors.db_port} />
        </Field>
        <Field id="db-user" label="Database username *" error={errors.db_user}>
          <input id="db-user" className="mc-input" value={form.db_user} onChange={set("db_user")} maxLength={64} autoComplete="off" aria-invalid={!!errors.db_user} />
        </Field>
        <Field id="db-password" label={db.passwordSet ? "Database password" : "Database password *"} error={errors.db_password} hint={db.passwordSet ? "A password is stored (encrypted). Leave blank to keep it, or type a new one to replace it." : "Stored encrypted; never shown again after saving."}>
          <input id="db-password" type="password" className="mc-input" value={form.db_password} onChange={set("db_password")} placeholder={db.passwordSet ? "•••••••• (unchanged)" : ""} autoComplete="new-password" maxLength={100} aria-invalid={!!errors.db_password} />
        </Field>
      </div>
      <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="mc-btn primary" onClick={save} disabled={busy === "save" || !dirty}>{busy === "save" ? "Saving…" : "Save configuration"}</button>
        <button type="button" className="mc-btn" onClick={test} disabled={busy === "test" || dirty || !db.configured} title={dirty ? "Save your changes before testing" : undefined}>
          {busy === "test" ? "Testing…" : "Test Connection"}
        </button>
      </div>
      {dirty && <p className="mc-muted">Save your changes, then test the connection.</p>}
      <p className="mc-muted">Each company must use its own database. The test only checks that the credentials can connect; it does not create or change anything.</p>
    </div>
  );
};

export default DatabaseTab;

import React, { useCallback, useEffect, useState } from "react";
import { masterAdmin, errorMessage, fmtDate, fmtDateTime } from "../../../../services/masterAdminService";
import { Msg, Field, useReportDirty, confirmAction } from "./common";

const EMPTY = { adminName: "", adminEmail: "", adminPhone: "", designation: "", expiresInHours: "72" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Initial company admin onboarding. The Master user can invite an admin and see who registered,
 * but there is deliberately no way to set, view or reset any admin password: the admin chooses
 * their own during registration. The raw invitation token exists only in this component's state
 * until the Master user dismisses it (it cannot be fetched again).
 */
const AdminTab = ({ company, reload, setDirty }) => {
  const [admins, setAdmins] = useState(null);
  const [inv, setInv] = useState(undefined); // undefined = loading
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [issued, setIssued] = useState(null); // { token, expiresAt, email }
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");

  const claimed = !!company.adminClaimedAt;
  const dbReady = company.provisioning !== "draft" || company.setup?.steps?.find((s) => s.key === "database")?.done;
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  useReportDirty(dirty, setDirty);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([masterAdmin.admins(company.id), masterAdmin.invitation(company.id).catch(() => ({ current: null, history: [] }))]);
      setAdmins(a.admins);
      setInv(i);
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not load the company admins.") });
    }
  }, [company.id]);
  useEffect(() => { load(); }, [load]);

  const validate = () => {
    const e = {};
    if (form.adminName.trim().length < 2) e.adminName = "Enter the admin's full name.";
    if (!EMAIL_RE.test(form.adminEmail.trim())) e.adminEmail = "Enter a valid email address.";
    if (form.adminPhone && !/^[0-9+()\-\s]{5,40}$/.test(form.adminPhone)) e.adminPhone = "Enter a valid phone number.";
    const h = Number(form.expiresInHours);
    if (!(h >= 1 && h <= 720)) e.expiresInHours = "Between 1 and 720 hours.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const pending = inv?.current?.status === "pending";
  const generate = async () => {
    if (!validate()) return;
    if (pending && !confirmAction("This replaces the unused invitation. The old token will stop working. Continue?")) return;
    setBusy("generate");
    setMsg(null);
    try {
      const body = { adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim(), expiresInHours: Number(form.expiresInHours) };
      if (form.adminPhone) body.adminPhone = form.adminPhone.trim();
      if (form.designation) body.designation = form.designation.trim();
      const r = await masterAdmin.generateInvitation(company.id, body);
      setIssued({ token: r.token, expiresAt: r.invitation.expiresAt, email: r.invitation.adminEmail });
      setCopied(false);
      setForm(EMPTY);
      setDirty(false);
      await load();
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not generate the invitation.") });
    } finally {
      setBusy("");
    }
  };

  const revoke = async () => {
    if (!confirmAction("Revoke this invitation? The token will stop working immediately.")) return;
    setBusy("revoke");
    try {
      await masterAdmin.revokeInvitation(company.id);
      setIssued(null);
      setMsg({ type: "ok", text: "Invitation revoked." });
      await load();
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not revoke the invitation.") });
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setMsg({ type: "error", text: "Copy is not available here — select the token and copy it manually." });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const registerUrl = `${window.location.origin}/admin/signup`;

  return (
    <div className="mc-card">
      <Msg msg={msg} />

      {issued && (
        <section className="mc-token" aria-label="Admin invitation token">
          <h3>Invitation token for {issued.email}</h3>
          <p className="mc-muted">Copy it now — it is shown only once and cannot be retrieved later. Share it with the admin together with the company code <strong>{company.code}</strong> and this link: {registerUrl}</p>
          <div className="mc-copy-row">
            <input className="mc-input" readOnly value={issued.token} aria-label="Invitation token" onFocus={(e) => e.target.select()} />
            <button type="button" className="mc-btn primary" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <p className="mc-muted">Expires {fmtDateTime(issued.expiresAt)}. Single use. Only the company admin should know it; you will never see their password.</p>
          <div className="mc-actions"><button type="button" className="mc-btn" onClick={() => setIssued(null)}>I have copied it — hide</button></div>
        </section>
      )}

      {claimed ? (
        <p className="mc-ok">The company admin registered on {fmtDate(company.adminClaimedAt)}. Admin passwords are set by the admin and are never visible to Master users.</p>
      ) : (
        <>
          <h3>Initial company admin</h3>
          {!dbReady && <p className="mc-error" role="status">Connect and test the company database first (Database Configuration tab). Invitations unlock afterwards.</p>}
          <div className="mc-form">
            <Field id="adm-name" label="Admin full name *" error={errors.adminName}>
              <input id="adm-name" className="mc-input" value={form.adminName} onChange={set("adminName")} maxLength={150} disabled={!dbReady} aria-invalid={!!errors.adminName} />
            </Field>
            <Field id="adm-email" label="Admin email *" error={errors.adminEmail} hint="The invitation only works for this exact email.">
              <input id="adm-email" type="email" className="mc-input" value={form.adminEmail} onChange={set("adminEmail")} maxLength={255} disabled={!dbReady} aria-invalid={!!errors.adminEmail} />
            </Field>
            <Field id="adm-phone" label="Admin phone (optional)" error={errors.adminPhone}>
              <input id="adm-phone" type="tel" className="mc-input" value={form.adminPhone} onChange={set("adminPhone")} disabled={!dbReady} />
            </Field>
            <Field id="adm-designation" label="Designation (optional)">
              <input id="adm-designation" className="mc-input" value={form.designation} onChange={set("designation")} maxLength={100} disabled={!dbReady} />
            </Field>
            <Field id="adm-expiry" label="Token expires after (hours)" error={errors.expiresInHours}>
              <input id="adm-expiry" type="number" min={1} max={720} className="mc-input" value={form.expiresInHours} onChange={set("expiresInHours")} disabled={!dbReady} />
            </Field>
          </div>
          <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="mc-btn primary" onClick={generate} disabled={!dbReady || busy === "generate"}>
              {busy === "generate" ? "Generating…" : pending ? "Regenerate Admin Invitation Token" : "Generate Admin Invitation Token"}
            </button>
            {pending && <button type="button" className="mc-btn danger" onClick={revoke} disabled={busy === "revoke"}>Revoke unused invitation</button>}
          </div>
        </>
      )}

      {inv === undefined && !msg && <div className="mc-skel" aria-busy="true" />}
      {inv?.current && (
        <>
          <h3 style={{ marginTop: 18 }}>Latest invitation</h3>
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>Admin</th><th>Email</th><th>Status</th><th>Expires</th><th>Generated by</th><th>Generated</th></tr></thead>
              <tbody>
                {[inv.current, ...(inv.history || [])].map((i) => (
                  <tr key={i.id}>
                    <td>{i.adminName}{i.designation ? ` · ${i.designation}` : ""}</td>
                    <td>{i.adminEmail}</td>
                    <td><span className={`mc-badge inv-${i.status}`}>{i.status}</span></td>
                    <td>{fmtDateTime(i.expiresAt)}</td>
                    <td>{i.createdByEmail || "—"}</td>
                    <td>{fmtDateTime(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 style={{ marginTop: 18 }}>Registered admins</h3>
      {admins === null && !msg && <div className="mc-skel" aria-busy="true" />}
      {admins && admins.length === 0 && <p className="mc-empty">No admin has registered yet.</p>}
      {admins && admins.length > 0 && (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Access</th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{[a.firstname, a.lastname].filter(Boolean).join(" ") || "—"}</td>
                  <td>{a.username}</td>
                  <td>{a.email}</td>
                  <td>{a.can_login ? "Enabled" : "Disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminTab;

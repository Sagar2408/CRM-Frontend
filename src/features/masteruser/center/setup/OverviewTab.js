import React, { useMemo, useState } from "react";
import { masterAdmin, errorMessage, fmtDate, fmtDateTime, toInputDate } from "../../../../services/masterAdminService";
import CompanyProfileFields, { EMPTY_PROFILE, toBody, validateProfile } from "../CompanyProfileFields";
import SetupProgress from "./SetupProgress";
import { Msg, Field, useReportDirty, confirmAction } from "./common";

const SUBSCRIPTION_KEYS = ["plan", "subscriptionStart", "expiryDate", "userLimit", "storageLimitMb", "isTrial", "trialEndsAt"];

export const formFrom = (c) => ({
  ...EMPTY_PROFILE,
  ...(c
    ? Object.fromEntries(Object.keys(EMPTY_PROFILE).map((k) => [k, k === "isTrial" ? !!c.isTrial : ["subscriptionStart", "expiryDate", "trialEndsAt"].includes(k) ? toInputDate(c[k]) : c[k] ?? ""]))
    : {}),
});

const OverviewTab = ({ company, reload, goTab, onCreated, setDirty }) => {
  const isNew = !company;
  const draft = company?.provisioning === "draft";
  const setup = company?.setup;
  const stage = setup?.stage || (company?.status === "active" ? "active" : "suspended");
  const initial = useMemo(() => ({ ...formFrom(company), name: company?.name || "", code: company?.code || "" }), [company]);

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");

  const dirty = editing && JSON.stringify(form) !== JSON.stringify(initial);
  useReportDirty(dirty, setDirty);

  const codeEditable = !isNew && draft && !company.adminClaimedAt;
  const nameEditable = isNew || draft;

  const validate = () => {
    const problems = validateProfile(form);
    if (nameEditable && !String(form.name || "").trim()) problems.name = "Company name is required.";
    if (codeEditable && !/^[A-Za-z0-9][A-Za-z0-9-]{3,15}$/.test(form.code || "")) problems.code = "4-16 letters, digits or dashes.";
    setErrors(problems);
    return Object.keys(problems).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy("save");
    setMsg(null);
    try {
      const { name: _n, code: _c, ...profileForm } = form;
      const profile = Object.fromEntries(Object.entries(toBody(profileForm, { forCreate: isNew })).filter(([k]) => !SUBSCRIPTION_KEYS.includes(k)));
      if (isNew) {
        const res = await masterAdmin.createDraft({ name: form.name.trim(), ...profile });
        setDirty(false);
        onCreated(res.company.id);
        return;
      }
      const body = { ...profile };
      if (nameEditable && form.name !== company.name) body.name = form.name.trim();
      await masterAdmin.updateCompany(company.id, body);
      if (codeEditable && form.code.toUpperCase() !== company.code) await masterAdmin.updateCode(company.id, form.code);
      setEditing(false);
      setMsg({ type: "ok", text: draft ? "Draft saved." : "Company updated." });
      await reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not save the company.") });
    } finally {
      setBusy("");
    }
  };

  const cancel = () => {
    if (dirty && !confirmAction("Discard your unsaved changes?")) return;
    setEditing(false);
    setForm(initial);
    setErrors({});
  };

  const run = async (key, fn, okText) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ type: r?.ok === false ? "error" : "ok", text: okText ? okText(r) : r?.message || "Done." });
      await reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "That action failed.") });
    } finally {
      setBusy("");
    }
  };

  const suspend = () => confirmAction(`Suspend ${company.displayName || company.name}? Its users will lose access immediately.`) && run("suspend", () => masterAdmin.updateCompany(company.id, { status: "paused" }), () => "Company suspended.");
  const resume = () => run("resume", () => masterAdmin.updateCompany(company.id, { status: "active" }), () => "Company resumed.");
  const activate = () => confirmAction("Activate this company? Its admin and users will be able to log in.") && run("activate", () => masterAdmin.activate(company.id));
  const testDb = () => run("test", () => masterAdmin.testDatabase(company.id), (r) => r.message);

  const rows = company
    ? [
        ["Legal name", company.legalName], ["Display name", company.displayName], ["Company code", company.code], ["Industry", company.industry],
        ["Website", company.website], ["Contact person", company.contactPerson], ["Contact email", company.contactEmail], ["Contact phone", company.contactPhone],
        ["Account manager", company.accountManager], ["Location", [company.city, company.state, company.country].filter(Boolean).join(", ")],
        ["Address", company.address], ["Registration number", company.registrationNumber], ["Tax / GST ID", company.taxId],
        ["Description", company.description], ["Logo", company.logoUrl], ["Created", fmtDate(company.createdAt)],
        ["Admin account", company.adminClaimedAt ? `Registered ${fmtDate(company.adminClaimedAt)}` : "Not registered yet"],
        ...(company.activatedAt ? [["Activated", fmtDateTime(company.activatedAt)]] : []),
      ]
    : [];

  return (
    <div className="mc-card">
      {!isNew && <SetupProgress setup={setup} provisioning={company.provisioning || "active"} />}
      <Msg msg={msg} />

      {editing ? (
        <>
          <div className="mc-form" style={{ marginBottom: 14 }}>
            <Field id="company-name" label="Company name *" error={errors.name} hint={isNew ? "Required. This is the registry name." : undefined}>
              <input id="company-name" className="mc-input" value={form.name} disabled={!nameEditable} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} aria-invalid={!!errors.name} />
            </Field>
            <Field id="company-code" label="Company code" error={errors.code} hint={isNew ? "Generated automatically when you save the draft." : codeEditable ? "Editable until the company is activated or its admin registers." : "Locked."}>
              <input id="company-code" className="mc-input" value={isNew ? "" : form.code} placeholder={isNew ? "Auto-generated" : ""} disabled={!codeEditable} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={16} />
            </Field>
          </div>
          <CompanyProfileFields values={form} onChange={(v) => setForm({ ...form, ...v })} errors={errors} withSubscription={false} />
          <div className="mc-actions">
            {!isNew && <button type="button" className="mc-btn" onClick={cancel}>Cancel</button>}
            <button type="button" className="mc-btn primary" onClick={save} disabled={busy === "save"}>
              {busy === "save" ? "Saving…" : isNew || draft ? "Save draft" : "Save changes"}
            </button>
          </div>
          {isNew && <p className="mc-muted">Saving creates the company as a draft. The database, admin invitation, subscription and features unlock after that; nothing is live until you activate it.</p>}
        </>
      ) : (
        <>
          <dl className="mc-dl">{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>))}</dl>
          <div className="mc-actions">
            <button type="button" className="mc-btn" onClick={() => setEditing(true)}>{draft ? "Edit draft" : "Edit company"}</button>
            {draft && company.dbConfigured && (
              <button type="button" className="mc-btn" onClick={testDb} disabled={busy === "test"}>{busy === "test" ? "Testing…" : "Test database connection"}</button>
            )}
            {draft && !company.adminClaimedAt && (
              <button type="button" className="mc-btn" onClick={() => goTab("Admin Users")}>Generate admin invitation</button>
            )}
            {draft && setup?.canActivate && (
              <button type="button" className="mc-btn primary" onClick={activate} disabled={busy === "activate"}>{busy === "activate" ? "Activating…" : "Activate company"}</button>
            )}
            {company.status === "active"
              ? <button type="button" className="mc-btn danger" onClick={suspend} disabled={busy === "suspend"}>Suspend company</button>
              : <button type="button" className="mc-btn primary" onClick={resume} disabled={busy === "resume"}>Resume company</button>}
          </div>
          {draft && !setup?.canActivate && stage !== "suspended" && (
            <p className="mc-muted">Activation unlocks once the database connection is tested and the company admin has registered.</p>
          )}
        </>
      )}
    </div>
  );
};

export default OverviewTab;

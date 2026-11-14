import React, { useMemo, useState } from "react";
import { masterAdmin, errorMessage, fmtDate, toInputDate, SUBSCRIPTION_LABELS, BILLING_CYCLES } from "../../../../services/masterAdminService";
import { Msg, Field, useReportDirty } from "./common";

const fromCompany = (c) => ({
  plan: c.plan ?? "",
  billingCycle: c.billingCycle ?? "",
  subscriptionStart: toInputDate(c.subscriptionStart),
  expiryDate: toInputDate(c.expiryDate),
  userLimit: c.userLimit ?? "",
  employeeLimit: c.employeeLimit ?? "",
  storageLimitMb: c.storageLimitMb ?? "",
  isTrial: !!c.isTrial,
  trialEndsAt: toInputDate(c.trialEndsAt),
  autoRenew: !!c.autoRenew,
  renewalReminderDays: c.renewalReminderDays ?? "",
  subscriptionNotes: c.subscriptionNotes ?? "",
});

const num = (v) => (v === "" || v == null ? null : Number(v));
const text = (v) => (v === "" || v == null ? null : v);

const SubscriptionTab = ({ company, reload, setDirty }) => {
  const initial = useMemo(() => fromCompany(company), [company]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const draft = company.provisioning === "draft";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useReportDirty(dirty, setDirty);

  const validate = () => {
    const e = {};
    for (const [k, l] of [["userLimit", "User limit"], ["employeeLimit", "Employee limit"], ["storageLimitMb", "Storage limit"], ["renewalReminderDays", "Reminder days"]]) {
      if (form[k] !== "" && !(Number(form[k]) >= 1)) e[k] = `${l} must be a positive number.`;
    }
    if (form.subscriptionStart && form.expiryDate && form.expiryDate < form.subscriptionStart) e.expiryDate = "Expiry must be after the start date.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      await masterAdmin.updateSubscription(company.id, {
        plan: text(form.plan), billingCycle: text(form.billingCycle), subscriptionStart: text(form.subscriptionStart), expiryDate: text(form.expiryDate),
        userLimit: num(form.userLimit), employeeLimit: num(form.employeeLimit), storageLimitMb: num(form.storageLimitMb),
        isTrial: form.isTrial, trialEndsAt: text(form.trialEndsAt), autoRenew: form.autoRenew,
        renewalReminderDays: num(form.renewalReminderDays), subscriptionNotes: text(form.subscriptionNotes),
      });
      setMsg({ type: "ok", text: "Subscription updated. Tenant data and database connection are unchanged." });
      setDirty(false);
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not update the subscription.") });
    }
  };
  const renew = async (months) => {
    try {
      await masterAdmin.renew(company.id, months);
      setMsg({ type: "ok", text: `Renewed for ${months} month(s).` });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not renew.") });
    }
  };
  const remind = async () => {
    try {
      const r = await masterAdmin.expiryReminder(company.id);
      setMsg({ type: "ok", text: r.message });
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not send the reminder.") });
    }
  };

  const input = (id, label, type = "text", extra = {}) => (
    <Field id={`sub-${id}`} label={label} error={errors[id]} key={id}>
      <input id={`sub-${id}`} type={type} className="mc-input" value={form[id] ?? ""} onChange={set(id)} aria-invalid={!!errors[id]} {...extra} />
    </Field>
  );

  return (
    <div className="mc-card">
      <p>Status: <span className={`mc-badge ${company.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[company.subscriptionStatus]}</span> · Expires {fmtDate(company.expiryDate)}</p>
      <Msg msg={msg} />
      <div className="mc-form" style={{ margin: "12px 0" }}>
        {input("plan", "Subscription plan")}
        <Field id="sub-billingCycle" label="Billing cycle">
          <select id="sub-billingCycle" className="mc-select" value={form.billingCycle} onChange={set("billingCycle")}>
            {BILLING_CYCLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {input("subscriptionStart", "Subscription start", "date")}
        {input("expiryDate", "Subscription expiry", "date")}
        {input("userLimit", "Employee / user limit", "number", { min: 1 })}
        {input("employeeLimit", "Maximum employees (headcount)", "number", { min: 1 })}
        {input("storageLimitMb", "Storage limit (MB)", "number", { min: 1 })}
        <Field id="sub-trial" label="Trial">
          <label className="mc-switch-row" style={{ border: 0, padding: 0 }}><input id="sub-trial" type="checkbox" checked={form.isTrial} onChange={set("isTrial")} /> Trial account</label>
        </Field>
        {form.isTrial && input("trialEndsAt", "Trial ends", "date")}
        <Field id="sub-autoRenew" label="Renewal">
          <label className="mc-switch-row" style={{ border: 0, padding: 0 }}><input id="sub-autoRenew" type="checkbox" checked={form.autoRenew} onChange={set("autoRenew")} /> Mark as auto-renewing</label>
        </Field>
        {input("renewalReminderDays", "Renewal reminder (days before expiry)", "number", { min: 1, max: 365 })}
        <Field id="sub-subscriptionNotes" label="Internal subscription notes" wide>
          <textarea id="sub-subscriptionNotes" className="mc-textarea" value={form.subscriptionNotes} onChange={set("subscriptionNotes")} maxLength={2000} />
        </Field>
      </div>
      <p className="mc-muted">Plan and renewal settings are records for your team; no billing system is connected.</p>
      <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="mc-btn primary" onClick={save}>Save subscription</button>
        {!draft && [1, 3, 6, 12].map((m) => <button key={m} type="button" className="mc-btn" onClick={() => renew(m)}>Renew +{m} mo</button>)}
        {!draft && <button type="button" className="mc-btn" onClick={remind}>Send expiry reminder</button>}
      </div>
    </div>
  );
};

export default SubscriptionTab;

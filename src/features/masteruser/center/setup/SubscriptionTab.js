import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { masterAdmin, errorMessage, fmtDate, toInputDate, SUBSCRIPTION_LABELS, BILLING_CYCLES } from "../../../../services/masterAdminService";
import { fmtDay } from "../../../subscription/format";
import AssignPlanForm from "./AssignPlanForm";
import { CurrentSubscription, Payments, History } from "./CompanyBilling";
import { Msg, Field, useReportDirty, confirmAction } from "./common";

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

/** The date a renewal runs to, as the server computes it (from the later of expiry and now). */
const renewedUntil = (expiry, months) => {
  const base = expiry && new Date(expiry) > new Date() ? new Date(expiry) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString();
};

const SubscriptionTab = ({ company, reload, setDirty }) => {
  const initial = useMemo(() => fromCompany(company), [company]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assignDirty, setAssignDirty] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const request = useRef(0);
  const draft = company.provisioning === "draft";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const manualDirty = JSON.stringify(form) !== JSON.stringify(initial);
  useReportDirty(manualDirty || assignDirty, setDirty);

  // The company was reloaded (saved, renewed, assigned): show its new values.
  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  const loadDetails = useCallback(async () => {
    const mine = ++request.current;
    try {
      const data = await masterAdmin.subscriptionDetails(company.id);
      if (mine !== request.current) return;
      setDetails(data || null);
      setDetailsError("");
    } catch (e) {
      if (mine === request.current) setDetailsError(errorMessage(e, "Could not load the subscription history and payments."));
    }
  }, [company]);
  useEffect(() => { loadDetails(); }, [loadDetails]);

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
    // A recorded price belongs to a plan and billing cycle: warn before detaching it.
    const priced = details?.current && details.current.amount !== null;
    if (priced && (form.plan !== initial.plan || form.billingCycle !== initial.billingCycle)
      && !confirmAction("Changing the plan name or billing cycle by hand removes the recorded plan price from the current terms (history keeps it). To set a price, use “Assign subscription plan”. Continue?")) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };
  const renew = async (months) => {
    const price = details?.current?.amount;
    const lines = [
      `Renew ${company.displayName || company.name} for ${months} month(s)?`,
      `New expiry: ${fmtDay(renewedUntil(company.expiryDate, months))} (currently ${fmtDay(company.expiryDate)})`,
      price !== null && price !== undefined ? "The plan and agreed price stay the same. No payment is recorded automatically." : "No payment is recorded automatically.",
      company.isTrial ? "The trial will end." : "",
      manualDirty || assignDirty ? "Unsaved edits on this tab will be discarded." : "",
    ].filter(Boolean);
    if (!confirmAction(lines.join("\n"))) return;
    setBusy(true);
    try {
      await masterAdmin.renew(company.id, months);
      setMsg({ type: "ok", text: `Renewed for ${months} month(s).` });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not renew.") });
    } finally {
      setBusy(false);
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
    <div className="mc-stack">
      <div className="mc-card">
        <p>Status: <span className={`mc-badge ${company.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[company.subscriptionStatus]}</span> · Expires {fmtDate(company.expiryDate)}</p>
        <Msg msg={msg} />
        <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
          {!draft && [1, 3, 6, 12].map((m) => <button key={m} type="button" className="mc-btn" onClick={() => renew(m)} disabled={busy}>Renew +{m} mo</button>)}
          {!draft && <button type="button" className="mc-btn" onClick={remind}>Send expiry reminder</button>}
        </div>
      </div>

      {detailsError && <div className="mc-card"><p className="mc-error" role="alert">{detailsError}</p><button type="button" className="mc-btn" onClick={loadDetails}>Retry</button></div>}
      {!details && !detailsError && <div className="mc-card" aria-busy="true"><div className="mc-skel" /><div className="mc-skel" /></div>}
      {details && <CurrentSubscription details={details} />}

      <AssignPlanForm company={company} current={details?.current || null} setDirty={setAssignDirty} otherChangesPending={manualDirty}
        onAssigned={() => { setDirty(false); reload(); }} />

      <div className="mc-card">
        <h2>Manual adjustments</h2>
        <p className="mc-muted">Edit individual subscription fields without assigning a plan. Every saved change is added to the history.</p>
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
            <label className="mc-check"><input id="sub-trial" type="checkbox" checked={form.isTrial} onChange={set("isTrial")} /> Trial account</label>
          </Field>
          {form.isTrial && input("trialEndsAt", "Trial ends", "date")}
          <Field id="sub-autoRenew" label="Renewal">
            <label className="mc-check"><input id="sub-autoRenew" type="checkbox" checked={form.autoRenew} onChange={set("autoRenew")} /> Mark as auto-renewing</label>
          </Field>
          {input("renewalReminderDays", "Renewal reminder (days before expiry)", "number", { min: 1, max: 365 })}
          <Field id="sub-subscriptionNotes" label="Internal subscription notes" wide>
            <textarea id="sub-subscriptionNotes" className="mc-textarea" value={form.subscriptionNotes} onChange={set("subscriptionNotes")} maxLength={2000} />
          </Field>
        </div>
        <p className="mc-muted">Auto-renewal and limits are records for your team; no billing system is connected and nothing is charged or renewed automatically.</p>
        <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="mc-btn primary" onClick={save} disabled={busy}>Save subscription</button>
        </div>
      </div>

      {details && <Payments company={company} details={details} refresh={loadDetails} />}
      {details && <History details={details} />}
    </div>
  );
};

export default SubscriptionTab;

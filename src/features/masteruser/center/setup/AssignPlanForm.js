import React, { useEffect, useMemo, useRef, useState } from "react";
import { masterAdmin, errorMessage, toInputDate } from "../../../../services/masterAdminService";
import { CYCLE_MONTHS, cycleLabel, money, pricePer, fmtDay, limitText, todayInput, addMonthsInput, addDaysInput } from "../../../subscription/format";
import { TermsFields, EMPTY_PLAN, validateTerms, termsBody } from "../SubscriptionPlansPage";
import { Msg, Field, confirmAction, useReportDirty } from "./common";

const CUSTOM = "custom";

const blank = () => ({
  choice: "", custom: { ...EMPTY_PLAN, name: "Custom Plan" }, useCustomAmount: false, customAmount: "",
  startDate: todayInput(), expiryDate: "", isTrial: false, trialEndsAt: "", autoRenew: false, applyModules: false, notes: "",
});

/** Default dates for a selection: one billing cycle, or the trial window. */
export const defaultDates = ({ startDate, isTrial }, terms) => {
  const trialEndsAt = isTrial && terms?.trialDays ? addDaysInput(startDate, terms.trialDays - 1) : "";
  const expiryDate = isTrial ? trialEndsAt : CYCLE_MONTHS[terms?.billingCycle] ? addMonthsInput(startDate, CYCLE_MONTHS[terms.billingCycle]) : "";
  return { trialEndsAt, expiryDate };
};

const AssignPlanForm = ({ company, current, onAssigned, setDirty, otherChangesPending }) => {
  const [catalogue, setCatalogue] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useReportDirty(!!form.choice, setDirty);

  const load = async () => {
    try {
      const res = await masterAdmin.plans();
      if (alive.current) {
        setCatalogue({ plans: res?.plans || [], modules: res?.modules || [] });
        setLoadError("");
      }
    } catch (e) {
      if (alive.current) setLoadError(errorMessage(e, "Could not load the subscription plans."));
    }
  };
  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, []);

  // Active plans, plus the company's own plan even when it has since been deactivated.
  const options = useMemo(() => (catalogue?.plans || []).filter((p) => p.status === "active" || p.id === current?.planId), [catalogue, current]);
  const custom = form.choice === CUSTOM;
  const plan = custom ? null : options.find((p) => String(p.id) === form.choice) || null;
  const terms = custom ? form.custom : plan;
  const trialAllowed = custom || !!plan?.trialAvailable;
  const isCurrentPlan = !!plan && current?.planId === plan.id;
  const price = custom ? form.custom.amount : form.useCustomAmount ? form.customAmount : plan?.amount;
  const negotiated = !!plan && form.useCustomAmount && form.customAmount !== "" && Number(form.customAmount) !== plan.amount;
  const moduleCount = terms?.modules?.length || 0;

  const update = (patch, redate = false) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!redate) return next;
      const t = next.choice === CUSTOM ? next.custom : options.find((p) => String(p.id) === next.choice);
      return { ...next, ...defaultDates(next, t) };
    });

  const choose = (e) => {
    const choice = e.target.value;
    setErrors({});
    setMsg(null);
    if (!choice) return setForm(blank());
    const picked = options.find((p) => String(p.id) === choice);
    const keepsPrice = picked && current?.planId === picked.id && current.amount !== null && current.amount !== picked.amount;
    const patch = { choice, useCustomAmount: !!keepsPrice, customAmount: keepsPrice ? String(current.amount) : "", isTrial: false, applyModules: false };
    // Re-selecting the current plan keeps the company's own dates and renewal setting.
    if (picked && current?.planId === picked.id) {
      return update({
        ...patch, startDate: toInputDate(company.subscriptionStart) || todayInput(), expiryDate: toInputDate(company.expiryDate),
        isTrial: !!company.isTrial && picked.trialAvailable, trialEndsAt: picked.trialAvailable ? toInputDate(company.trialEndsAt) : "", autoRenew: !!company.autoRenew,
      });
    }
    return update(patch, true);
  };

  // Editing the custom billing cycle re-computes the suggested expiry date.
  const setCustom = (fn) =>
    setForm((f) => {
      const nextCustom = fn(f.custom);
      const next = { ...f, custom: nextCustom };
      return nextCustom.billingCycle !== f.custom.billingCycle ? { ...next, ...defaultDates(next, nextCustom) } : next;
    });

  const validate = () => {
    const e = custom ? validateTerms(form.custom) : {};
    if (!custom && form.useCustomAmount && !/^\d+(\.\d{1,2})?$/.test(form.customAmount)) e.customAmount = "Enter the negotiated amount (0 or more, up to 2 decimals).";
    if (!form.startDate) e.startDate = "Choose a start date.";
    if (!form.expiryDate) e.expiryDate = "Choose an expiry date.";
    else if (form.expiryDate < form.startDate) e.expiryDate = "Expiry must be on or after the start date.";
    if (form.isTrial) {
      if (!form.trialEndsAt) e.trialEndsAt = "Choose when the trial ends.";
      else if (form.trialEndsAt < form.startDate) e.trialEndsAt = "The trial cannot end before it starts.";
      else if (form.expiryDate && form.expiryDate < form.trialEndsAt) e.expiryDate = "Expiry cannot be before the trial ends.";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!terms || !validate()) return;
    const name = custom ? form.custom.name.trim() : plan.name;
    const lines = [
      `${current?.planName ? `Change ${company.name} from “${current.planName}” to` : `Assign ${company.name} to`} “${name}”?`,
      `Price: ${pricePer(Number(price), terms.billingCycle)}${negotiated ? ` (negotiated; standard price ${money(plan.amount)})` : ""}`,
      `Period: ${fmtDay(form.startDate)} to ${fmtDay(form.expiryDate)}`,
      current ? "The current terms stay in the subscription history." : "",
      form.expiryDate < todayInput() ? "WARNING: this expiry date is in the past, so the company's users will be blocked immediately." : "",
      form.applyModules ? "Module access will be changed: modules not included in this plan are switched off." : "",
      otherChangesPending ? "Unsaved edits in the manual subscription form will be discarded." : "",
    ].filter(Boolean);
    if (!confirmAction(lines.join("\n"))) return;
    setBusy(true);
    setMsg(null);
    try {
      const body = {
        ...(custom ? { custom: termsBody(form.custom) } : { planId: plan.id, ...(form.useCustomAmount ? { customAmount: Number(form.customAmount) } : {}) }),
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        isTrial: form.isTrial,
        ...(form.isTrial ? { trialEndsAt: form.trialEndsAt } : {}),
        autoRenew: form.autoRenew,
        applyModules: form.applyModules,
        notes: form.notes.trim() || null,
      };
      const res = await masterAdmin.assignPlan(company.id, body);
      setForm(blank());
      setMsg({ type: "ok", text: res?.message || "Subscription saved." });
      onAssigned(res);
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not assign the plan.") });
    } finally {
      setBusy(false);
    }
  };

  const dateField = (key, label, redate = false) => (
    <Field id={`assign-${key}`} label={label} error={errors[key]}>
      <input id={`assign-${key}`} type="date" className="mc-input" value={form[key]} onChange={(e) => update({ [key]: e.target.value }, redate)} aria-invalid={!!errors[key]} />
    </Field>
  );

  return (
    <form className="mc-card" onSubmit={submit} noValidate aria-label="Assign subscription plan">
      <h2>Assign subscription plan</h2>
      {loadError && <p className="mc-error" role="alert">{loadError} <button type="button" className="mc-link" onClick={load}>Retry</button></p>}
      {!catalogue && !loadError && <div className="mc-skel" aria-busy="true" />}
      <Msg msg={msg} />
      {catalogue && (
        <>
          <div className="mc-form">
            <Field id="assign-plan" label="Select Subscription Plan" wide hint={options.length === 0 ? "No active plans yet. Create one under Subscription Plans, or use a custom plan." : undefined}>
              <select id="assign-plan" className="mc-select" value={form.choice} onChange={choose}>
                <option value="">— Choose a plan —</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {pricePer(p.amount, p.billingCycle)}{p.status !== "active" ? " (inactive, current plan)" : ""}</option>
                ))}
                <option value={CUSTOM}>Custom Plan (negotiated terms)</option>
              </select>
            </Field>
          </div>

          {plan && (
            <div className="mc-plan-summary" data-testid="plan-summary">
              <dl className="mc-dl">
                <div><dt>Billing cycle</dt><dd>{cycleLabel(plan.billingCycle)}</dd></div>
                <div><dt>Standard plan price</dt><dd>{money(plan.amount)}</dd></div>
                <div><dt>Company price</dt><dd><strong>{money(price === "" ? null : price)}</strong> {negotiated ? <span className="mc-badge custom">Custom price</span> : <span className="mc-badge">Standard</span>}</dd></div>
                <div><dt>Maximum users</dt><dd>{limitText(plan.userLimit)}</dd></div>
                <div><dt>Maximum employees</dt><dd>{limitText(plan.employeeLimit)}</dd></div>
                <div><dt>Storage limit</dt><dd>{limitText(plan.storageLimitMb, " MB")}</dd></div>
                <div><dt>Trial</dt><dd>{plan.trialAvailable ? `${plan.trialDays} days` : "Not offered"}</dd></div>
                <div><dt>Features</dt><dd>{[...(plan.moduleDetails || []).map((m) => m.label), ...(plan.highlights || [])].join(", ") || "None listed"}</dd></div>
              </dl>
              {isCurrentPlan && current.amount !== null && <p className="mc-muted">This is the company's current plan. Agreed price: {money(current.amount)}; current list price: {money(plan.amount)}.</p>}
              <div className="mc-form">
                <Field id="assign-useCustom" label="Pricing">
                  <label className="mc-check"><input id="assign-useCustom" type="checkbox" checked={form.useCustomAmount} onChange={(e) => update({ useCustomAmount: e.target.checked, customAmount: e.target.checked ? String(plan.amount) : "" })} /> Use a custom negotiated amount</label>
                </Field>
                {form.useCustomAmount && (
                  <Field id="assign-customAmount" label="Custom amount (INR)" error={errors.customAmount}>
                    <input id="assign-customAmount" className="mc-input" inputMode="decimal" value={form.customAmount} onChange={(e) => update({ customAmount: e.target.value })} />
                  </Field>
                )}
              </div>
            </div>
          )}

          {custom && (
            <div className="mc-form mc-plan-summary">
              <TermsFields form={form.custom} setForm={setCustom} errors={errors} modules={catalogue.modules} idPrefix="custom" />
            </div>
          )}

          {terms && (
            <>
              <div className="mc-form mc-plan-summary">
                {dateField("startDate", "Start date", true)}
                {dateField("expiryDate", "Expiry date")}
                <Field id="assign-trial" label="Trial period">
                  <label className="mc-check"><input id="assign-trial" type="checkbox" checked={form.isTrial} disabled={!trialAllowed} onChange={(e) => update({ isTrial: e.target.checked }, true)} /> Start as a trial</label>
                </Field>
                {form.isTrial && dateField("trialEndsAt", "Trial end date")}
                <Field id="assign-autoRenew" label="Auto-renewal">
                  <label className="mc-check"><input id="assign-autoRenew" type="checkbox" checked={form.autoRenew} onChange={(e) => update({ autoRenew: e.target.checked })} /> Auto-renew (record only)</label>
                </Field>
                <Field id="assign-modules" label="Module access" wide hint={moduleCount ? "Off by default: the company's current feature switches stay as they are." : "This plan lists no modules."}>
                  <label className="mc-check"><input id="assign-modules" type="checkbox" checked={form.applyModules} disabled={!moduleCount} onChange={(e) => update({ applyModules: e.target.checked })} /> Switch company modules to match this plan</label>
                </Field>
                <Field id="assign-notes" label="Assignment notes (Master only)" wide>
                  <textarea id="assign-notes" className="mc-textarea" value={form.notes} maxLength={2000} onChange={(e) => update({ notes: e.target.value })} />
                </Field>
              </div>
              <div className="mc-actions">
                <button type="button" className="mc-btn" onClick={() => { setForm(blank()); setErrors({}); }} disabled={busy}>Cancel</button>
                <button type="submit" className="mc-btn primary" disabled={busy}>{busy ? "Saving…" : current ? "Apply plan change" : "Assign plan"}</button>
              </div>
            </>
          )}
        </>
      )}
    </form>
  );
};

export default AssignPlanForm;

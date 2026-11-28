import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { masterAdmin, errorMessage, SUBSCRIPTION_LABELS } from "../../../services/masterAdminService";
import { PLAN_CYCLES, cycleLabel, money, limitText } from "../../subscription/format";
import { Msg, Field, confirmAction } from "./setup/common";
import "../../../styles/masterCenter.css";

export const EMPTY_PLAN = {
  name: "", description: "", billingCycle: "monthly", amount: "", userLimit: "", employeeLimit: "", storageLimitMb: "",
  modules: [], highlights: "", trialAvailable: false, trialDays: "", status: "active",
};
const LIMITS = [["userLimit", "Maximum users"], ["employeeLimit", "Maximum employees"], ["storageLimitMb", "Storage limit (MB)"]];
const wholePositive = (v) => /^\d+$/.test(String(v)) && Number(v) >= 1;

export const highlightLines = (text) => String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Client-side checks mirroring the server rules (the server stays authoritative). */
export const validateTerms = (f) => {
  const e = {};
  const name = String(f.name || "").trim();
  if (name.length < 2 || name.length > 60) e.name = "Plan name must be 2–60 characters.";
  if (f.amount === "" || !(Number(f.amount) >= 0) || !/^\d+(\.\d{1,2})?$/.test(String(f.amount))) e.amount = "Enter an amount of 0 or more (up to 2 decimals).";
  for (const [k, label] of LIMITS) if (f[k] !== "" && !wholePositive(f[k])) e[k] = `${label} must be a whole number above 0.`;
  const lines = highlightLines(f.highlights);
  if (lines.length > 30 || lines.some((l) => l.length > 150)) e.highlights = "Up to 30 lines of 150 characters each.";
  return e;
};
export const validatePlan = (f) => {
  const e = validateTerms(f);
  if (f.trialAvailable && !(wholePositive(f.trialDays) && Number(f.trialDays) <= 365)) e.trialDays = "Trial duration must be 1–365 days.";
  return e;
};

const optional = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
export const termsBody = (f) => ({
  name: f.name.trim(),
  description: f.description.trim() || null,
  billingCycle: f.billingCycle,
  amount: Number(f.amount),
  currency: "INR",
  userLimit: optional(f.userLimit),
  employeeLimit: optional(f.employeeLimit),
  storageLimitMb: optional(f.storageLimitMb),
  modules: f.modules,
  highlights: highlightLines(f.highlights),
});
export const planPayload = (f) => ({
  ...termsBody(f),
  trialAvailable: !!f.trialAvailable,
  ...(f.trialAvailable ? { trialDays: Number(f.trialDays) } : {}),
  status: f.status,
});

const toForm = (p) => ({
  ...EMPTY_PLAN,
  ...Object.fromEntries(Object.keys(EMPTY_PLAN).map((k) => [k, p[k] ?? EMPTY_PLAN[k]])),
  highlights: (p.highlights || []).join("\n"),
});

/** Price, cycle, limits and features: shared by the plan editor and the custom company plan. */
export const TermsFields = ({ form, setForm, errors, modules, idPrefix }) => {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (key) => setForm((f) => ({ ...f, modules: f.modules.includes(key) ? f.modules.filter((m) => m !== key) : [...f.modules, key] }));
  const input = (k, label, props = {}) => (
    <Field id={`${idPrefix}-${k}`} label={label} error={errors[k]}>
      <input id={`${idPrefix}-${k}`} className="mc-input" value={form[k]} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
    </Field>
  );
  return (
    <>
      {input("name", "Plan name", { maxLength: 60 })}
      <Field id={`${idPrefix}-cycle`} label="Plan billing cycle">
        <select id={`${idPrefix}-cycle`} className="mc-select" value={form.billingCycle} onChange={set("billingCycle")}>
          {PLAN_CYCLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      {input("amount", "Plan amount (INR)", { inputMode: "decimal" })}
      {input("userLimit", "Plan maximum users", { type: "number", min: 1, placeholder: "Not specified" })}
      {input("employeeLimit", "Plan maximum employees", { type: "number", min: 1, placeholder: "Not specified" })}
      {input("storageLimitMb", "Plan storage (MB)", { type: "number", min: 1, placeholder: "Not specified" })}
      <Field id={`${idPrefix}-description`} label="Plan description" wide>
        <textarea id={`${idPrefix}-description`} className="mc-textarea" value={form.description} onChange={set("description")} maxLength={2000} />
      </Field>
      <fieldset className="mc-field wide mc-fieldset">
        <legend>Included modules</legend>
        <div className="mc-checks">
          {modules.map((m) => (
            <label key={m.key}><input type="checkbox" checked={form.modules.includes(m.key)} onChange={() => toggle(m.key)} /> {m.label}</label>
          ))}
        </div>
      </fieldset>
      <Field id={`${idPrefix}-highlights`} label="Other features (one per line)" error={errors.highlights} wide>
        <textarea id={`${idPrefix}-highlights`} className="mc-textarea" value={form.highlights} onChange={set("highlights")} />
      </Field>
    </>
  );
};

const PlanEditor = ({ plan, modules, onClose, onSaved }) => {
  const [form, setForm] = useState(() => (plan ? toForm(plan) : EMPTY_PLAN));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const title = plan ? "Edit plan" : "New plan";

  const submit = async (e) => {
    e.preventDefault();
    const problems = validatePlan(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    setMsg(null);
    try {
      const body = planPayload(form);
      const res = plan ? await masterAdmin.updatePlan(plan.id, body) : await masterAdmin.createPlan(body);
      onSaved(res?.message || "Plan saved.");
    } catch (err) {
      setMsg({ type: "error", text: errorMessage(err, "Could not save the plan.") });
      setBusy(false);
    }
  };

  return (
    <div className="mc-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <form className="mc-modal wide" onSubmit={submit} noValidate>
        <h3>{title}</h3>
        {plan?.companiesAssigned > 0 && (
          <p className="mc-note">{plan.companiesAssigned} company(ies) are on this plan. Their recorded price and limits will not change; new terms apply only when a plan is assigned again.</p>
        )}
        <div className="mc-form">
          <TermsFields form={form} setForm={setForm} errors={errors} modules={modules} idPrefix="plan" />
          <Field id="plan-trial" label="Trial">
            <label className="mc-check"><input id="plan-trial" type="checkbox" checked={form.trialAvailable} onChange={(e) => setForm({ ...form, trialAvailable: e.target.checked })} /> Trial available</label>
          </Field>
          {form.trialAvailable && (
            <Field id="plan-trialDays" label="Trial duration (days)" error={errors.trialDays}>
              <input id="plan-trialDays" type="number" min={1} max={365} className="mc-input" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
            </Field>
          )}
          <Field id="plan-status" label="Plan status">
            <select id="plan-status" className="mc-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <Msg msg={msg} />
        <div className="mc-actions">
          <button type="button" className="mc-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="mc-btn primary" disabled={busy}>{busy ? "Saving…" : plan ? "Save changes" : "Create plan"}</button>
        </div>
      </form>
    </div>
  );
};

const Subscribers = ({ plan, onClose }) => (
  <div className="mc-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Companies on ${plan.name}`}>
    <div className="mc-modal">
      <h3>Companies on {plan.name}</h3>
      <div className="mc-table-wrap">
        <table className="mc-table">
          <thead><tr><th>Company</th><th>Code</th><th>Status</th></tr></thead>
          <tbody>
            {plan.companies.map((c) => (
              <tr key={c.id}>
                <td><Link className="mc-link" to={`/master/companies/${c.id}`}>{c.name}</Link></td>
                <td>{c.code}</td>
                <td><span className={`mc-badge ${c.status}`}>{SUBSCRIPTION_LABELS[c.status] || c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mc-actions"><button type="button" className="mc-btn" onClick={onClose}>Close</button></div>
    </div>
  </div>
);

const SubscriptionPlansPage = () => {
  const [filters, setFilters] = useState({ q: "", status: "", billingCycle: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | plan
  const [viewing, setViewing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const mine = ++request.current; // a slower, older search must not overwrite a newer one
    setLoading(true);
    try {
      const res = await masterAdmin.plans(filters);
      if (mine !== request.current) return;
      setData(res);
      setError("");
    } catch (e) {
      if (mine === request.current) setError(errorMessage(e, "Could not load subscription plans."));
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (plan) => {
    const next = plan.status === "active" ? "inactive" : "active";
    const question = next === "inactive"
      ? `Deactivate “${plan.name}”? It can no longer be assigned. ${plan.companiesAssigned} company(ies) on it keep their subscription.`
      : `Activate “${plan.name}”? It becomes available for assignment.`;
    if (!confirmAction(question)) return;
    setBusyId(plan.id);
    setMsg(null);
    try {
      const res = await masterAdmin.setPlanStatus(plan.id, next);
      setMsg({ type: "ok", text: res?.message || "Plan updated." });
      await load();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not change the plan status.") });
    } finally {
      setBusyId(null);
    }
  };

  const plans = data?.plans || [];
  const filtered = !!(filters.q || filters.status || filters.billingCycle);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <div className="mc-head">
        <div>
          <h1 className="mc-title">Subscription Plans</h1>
          <p className="mc-sub">Create and price the plans you assign to companies.</p>
        </div>
        <button type="button" className="mc-btn primary" onClick={() => setEditing("new")} disabled={!data}>New plan</button>
      </div>

      <div className="mc-card">
        <div className="mc-filters">
          <input className="mc-input" aria-label="Search plans" placeholder="Search by name or description" value={filters.q} onChange={set("q")} maxLength={100} />
          <select className="mc-select" aria-label="Status filter" value={filters.status} onChange={set("status")}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="mc-select" aria-label="Billing cycle filter" value={filters.billingCycle} onChange={set("billingCycle")}>
            <option value="">All billing cycles</option>
            {PLAN_CYCLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Msg msg={msg} />
        {error ? (
          <div>
            <p className="mc-error" role="alert">{error}</p>
            <button type="button" className="mc-btn" onClick={load}>Retry</button>
          </div>
        ) : !data ? (
          <div aria-busy="true"><div className="mc-skel" /><div className="mc-skel" /><div className="mc-skel" /></div>
        ) : plans.length === 0 ? (
          <p className="mc-empty">{filtered ? "No plans match these filters." : "No subscription plans yet. Create your first plan to assign it to companies."}</p>
        ) : (
          <div className="mc-table-wrap" aria-busy={loading}>
            <table className="mc-table">
              <thead><tr><th>Plan</th><th>Price</th><th>Billing</th><th>Limits</th><th>Features</th><th>Trial</th><th>Companies</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} data-testid={`plan-row-${p.id}`}>
                    <td className="mc-plan-name"><strong>{p.name}</strong>{p.description && <div className="mc-muted">{p.description}</div>}</td>
                    <td className="mc-price">{money(p.amount, p.currency)}</td>
                    <td>{cycleLabel(p.billingCycle)}</td>
                    <td className="mc-nowrap">
                      <div>Users: {limitText(p.userLimit)}</div>
                      <div>Employees: {limitText(p.employeeLimit)}</div>
                      <div>Storage: {limitText(p.storageLimitMb, " MB")}</div>
                    </td>
                    <td>
                      {p.moduleDetails.length + p.highlights.length === 0 ? "—" : (
                        <details><summary>{p.moduleDetails.length + p.highlights.length} included</summary>
                          <ul className="mc-feature-list">{[...p.moduleDetails.map((m) => m.label), ...p.highlights].map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </details>
                      )}
                    </td>
                    <td>{p.trialAvailable ? `${p.trialDays} days` : "No"}</td>
                    <td>
                      {p.companiesAssigned > 0 ? (
                        <button type="button" className="mc-link" onClick={() => setViewing(p)} aria-label={`${p.companiesAssigned} companies on ${p.name}`}>{p.companiesAssigned}</button>
                      ) : 0}
                      {p.companiesAssigned > 0 && <div className="mc-muted">{p.companiesActive} active</div>}
                    </td>
                    <td><span className={`mc-badge ${p.status === "active" ? "active" : "not_configured"}`}>{p.status === "active" ? "Active" : "Inactive"}</span></td>
                    <td className="mc-nowrap">
                      <button type="button" className="mc-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>Edit</button>{" "}
                      <button type="button" className={`mc-btn${p.status === "active" ? " danger" : ""}`} onClick={() => toggle(p)} disabled={busyId === p.id}
                        aria-label={`${p.status === "active" ? "Deactivate" : "Activate"} ${p.name}`}>
                        {p.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <PlanEditor plan={editing === "new" ? null : editing} modules={data?.modules || []} onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setMsg({ type: "ok", text }); load(); }} />
      )}
      {viewing && <Subscribers plan={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default SubscriptionPlansPage;

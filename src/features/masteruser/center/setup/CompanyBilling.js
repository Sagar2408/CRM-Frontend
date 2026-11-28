import React, { useState } from "react";
import { masterAdmin, errorMessage, fmtDateTime } from "../../../../services/masterAdminService";
import { EVENT_LABELS, PAYMENT_METHODS, PAYMENT_STATUS_LABELS, cycleLabel, methodLabel, money, pricePer, fmtDay, limitText, remainingText, todayInput, saveBlob } from "../../../subscription/format";
import { Msg, Field, confirmAction } from "./common";

const PriceTag = ({ r }) => (
  <>
    {r.isCustomPrice ? <span className="mc-badge custom">Custom price</span> : r.planSource === "plan" ? <span className="mc-badge">Standard</span> : null}
    {r.isCustomPrice && r.standardAmount !== null && <div className="mc-muted">Standard {money(r.standardAmount, r.currency)}</div>}
  </>
);

export const CurrentSubscription = ({ details }) => {
  const c = details.current;
  if (!c) return <div className="mc-card"><h2>Current subscription</h2><p className="mc-empty">No subscription has been set up for this company.</p></div>;
  return (
    <div className="mc-card" data-testid="current-subscription">
      <h2>Current subscription</h2>
      <p className="mc-plan-headline">
        <strong>{c.planName || "Unnamed plan"}</strong>
        <span className="mc-price">{pricePer(c.amount, c.billingCycle, c.currency)}</span>
        <PriceTag r={c} />
        {c.planSource === "custom" && <span className="mc-badge">Custom plan</span>}
        {c.planSource === "manual" && <span className="mc-badge not_configured">Entered manually</span>}
      </p>
      <dl className="mc-dl">
        <div><dt>Standard plan price</dt><dd>{c.standardAmount === null ? "—" : money(c.standardAmount, c.currency)}</dd></div>
        <div><dt>Billing cycle</dt><dd>{cycleLabel(c.billingCycle)}</dd></div>
        <div><dt>Period</dt><dd>{fmtDay(c.startDate)} – {fmtDay(c.expiryDate)}</dd></div>
        <div><dt>Time left</dt><dd>{remainingText(details.daysRemaining)}</dd></div>
        <div><dt>Maximum users</dt><dd>{limitText(c.userLimit)}</dd></div>
        <div><dt>Maximum employees</dt><dd>{limitText(c.employeeLimit)}</dd></div>
        <div><dt>Storage limit</dt><dd>{limitText(c.storageLimitMb, " MB")}</dd></div>
        <div><dt>Trial / auto-renew</dt><dd>{c.isTrial ? `Trial until ${fmtDay(c.trialEndsAt)}` : "Not a trial"} · {c.autoRenew ? "Auto-renew" : "Manual renewal"}</dd></div>
      </dl>
    </div>
  );
};

const blankPayment = (current) => ({
  amount: current?.amount ? String(current.amount) : "", paymentDate: todayInput(), method: "bank_transfer", status: "paid", reference: "", notes: "",
});

const NEXT = { pending: [["paid", "Mark paid"], ["failed", "Mark failed"]], paid: [["refunded", "Mark refunded"]] };

export const Payments = ({ company, details, refresh }) => {
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const act = async (fn, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ type: "ok", text: ok });
      await refresh();
      return true;
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "That payment action failed.") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const record = async (event) => {
    event.preventDefault();
    const e = {};
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount) || !(Number(form.amount) > 0)) e.amount = "Enter an amount above 0.";
    if (!form.paymentDate) e.paymentDate = "Choose the payment date.";
    else if (form.status !== "pending" && form.paymentDate > todayInput()) e.paymentDate = "Only a pending payment can have a future date.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!confirmAction(`Record a ${PAYMENT_STATUS_LABELS[form.status].toLowerCase()} payment of ${money(form.amount)} for ${company.name}?\nPayment records cannot be deleted.`)) return;
    const done = await act(() => masterAdmin.recordPayment(company.id, {
      amount: Number(form.amount), paymentDate: form.paymentDate, method: form.method, status: form.status,
      reference: form.reference.trim() || null, notes: form.notes.trim() || null,
    }), "Payment recorded.");
    if (done) setForm(null);
  };

  const change = (p, status) => {
    if (!confirmAction(`Mark the ${money(p.amount, p.currency)} payment of ${fmtDay(p.paymentDate)} as ${status}?`)) return;
    // A pending payment is dated when it was due; completing it records today's date.
    act(() => masterAdmin.updatePaymentStatus(company.id, p.id, { status, ...(p.status === "pending" ? { paymentDate: todayInput() } : {}) }), `Payment marked ${status}.`);
  };
  const upload = (p) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setMsg({ type: "error", text: "The file must be 5MB or smaller." });
    if (p.receipt && !confirmAction(`Replace the receipt “${p.receipt.name}”?`)) return;
    act(() => masterAdmin.uploadReceipt(company.id, p.id, file), "Receipt attached.");
  };
  const download = async (p) => {
    try {
      saveBlob(await masterAdmin.receipt(company.id, p.id), p.receipt.name);
    } catch (e) {
      setMsg({ type: "error", text: "Could not download the receipt." });
    }
  };

  return (
    <div className="mc-card">
      <div className="mc-head">
        <h2>Payment history</h2>
        {!form && <button type="button" className="mc-btn primary" onClick={() => { setForm(blankPayment(details.current)); setErrors({}); }}>Record payment</button>}
      </div>
      <p className="mc-muted">No payment gateway is connected. Record only money you have actually received (or are expecting).</p>
      <Msg msg={msg} />
      {form && (
        <form className="mc-plan-summary" onSubmit={record} noValidate aria-label="Record payment">
          <div className="mc-form">
            <Field id="pay-amount" label="Amount (INR)" error={errors.amount}><input id="pay-amount" className="mc-input" inputMode="decimal" value={form.amount} onChange={set("amount")} /></Field>
            <Field id="pay-date" label="Payment date" error={errors.paymentDate}><input id="pay-date" type="date" className="mc-input" value={form.paymentDate} onChange={set("paymentDate")} /></Field>
            <Field id="pay-method" label="Payment method"><select id="pay-method" className="mc-select" value={form.method} onChange={set("method")}>{PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field id="pay-status" label="Payment status"><select id="pay-status" className="mc-select" value={form.status} onChange={set("status")}><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option></select></Field>
            <Field id="pay-reference" label="Transaction / reference ID"><input id="pay-reference" className="mc-input" value={form.reference} maxLength={100} onChange={set("reference")} /></Field>
            <Field id="pay-notes" label="Payment notes (Master only)" wide><textarea id="pay-notes" className="mc-textarea" value={form.notes} maxLength={1000} onChange={set("notes")} /></Field>
          </div>
          <div className="mc-actions">
            <button type="button" className="mc-btn" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="mc-btn primary" disabled={busy}>{busy ? "Saving…" : "Save payment"}</button>
          </div>
        </form>
      )}
      {details.payments.length === 0 ? <p className="mc-empty">No payments recorded yet.</p> : (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Plan</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead>
            <tbody>
              {details.payments.map((p) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`}>
                  <td className="mc-nowrap">{fmtDay(p.paymentDate)}</td>
                  <td className="mc-price">{money(p.amount, p.currency)}</td>
                  <td>{methodLabel(p.method)}</td>
                  <td>{p.reference || "—"}{p.notes && <div className="mc-muted">{p.notes}</div>}</td>
                  <td>{p.planName || "—"}</td>
                  <td><span className={`mc-badge pay-${p.status}`}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                  <td className="mc-nowrap">
                    {p.receipt && <><button type="button" className="mc-link" onClick={() => download(p)}>Download</button>{" · "}</>}
                    <label className="mc-link mc-file">{p.receipt ? "Replace" : "Attach"}
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label={`Receipt for payment ${p.id}`} onChange={upload(p)} disabled={busy} />
                    </label>
                  </td>
                  <td className="mc-nowrap">
                    {(NEXT[p.status] || []).map(([status, label]) => (
                      <button key={status} type="button" className="mc-btn" onClick={() => change(p, status)} disabled={busy}>{label}</button>
                    ))}
                    {!NEXT[p.status] && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const History = ({ details }) => (
  <div className="mc-card">
    <h2>Subscription history</h2>
    {details.history.length === 0 ? <p className="mc-empty">No history yet. Every future change is recorded here.</p> : (
      <div className="mc-table-wrap">
        <table className="mc-table">
          <thead><tr><th>Recorded</th><th>Event</th><th>Plan</th><th>Price</th><th>Period</th><th>Limits (users / employees / MB)</th><th>By</th></tr></thead>
          <tbody>
            {details.history.map((r) => (
              <tr key={r.id} data-testid={`history-row-${r.id}`}>
                <td className="mc-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td>{EVENT_LABELS[r.event] || r.event}{r.renewalMonths ? ` (+${r.renewalMonths} mo)` : ""}</td>
                <td>{r.planName || "—"}{r.notes && <div className="mc-muted">{r.notes}</div>}</td>
                <td className="mc-nowrap"><div>{pricePer(r.amount, r.billingCycle, r.currency)}</div><PriceTag r={r} /></td>
                <td className="mc-nowrap">{fmtDay(r.periodStart)} – {fmtDay(r.expiryDate)}</td>
                <td className="mc-nowrap">{[r.userLimit, r.employeeLimit, r.storageLimitMb].map((v) => v ?? "—").join(" / ")}</td>
                <td>{r.actorEmail || "System"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

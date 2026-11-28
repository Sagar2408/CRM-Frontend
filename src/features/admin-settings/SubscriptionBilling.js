import React, { useCallback, useEffect, useRef, useState } from "react";
import { billing } from "../../services/billingService";
import {
  OUTCOME_LABELS, PAYMENT_STATUS_LABELS, cycleLabel, methodLabel, money, pricePer, fmtDay, limitText, remainingText, saveBlob,
} from "../subscription/format";
import "../../styles/subscriptionBilling.css";

const STATUS_LABELS = {
  active: "Active", expiring_soon: "Expiring soon", trial: "Trial", expired: "Expired", suspended: "Suspended", not_configured: "No expiry set",
};

const Badge = ({ tone, children }) => <span className={`sb-badge sb-${tone}`}>{children}</span>;

const CurrentPlan = ({ c }) => {
  const features = [...(c.moduleDetails || []).map((m) => m.label), ...(c.highlights || [])];
  const urgent = c.daysRemaining !== null && c.daysRemaining <= 30;
  const facts = [
    ["Billing cycle", cycleLabel(c.billingCycle)],
    ["Plan amount", money(c.amount, c.currency)],
    ["Start date", fmtDay(c.startDate)],
    ["Expiry date", fmtDay(c.expiryDate)],
    ["Employee limit", limitText(c.employeeLimit)],
    ["User limit", limitText(c.userLimit)],
    ["Storage limit", limitText(c.storageLimitMb, " MB")],
    ["Renewal", c.autoRenew ? "Auto-renewal" : "Manual renewal"],
    ...(c.isTrial ? [["Trial ends", fmtDay(c.trialEndsAt)]] : []),
  ];
  return (
    <section className="sb-card" aria-labelledby="sb-current-title" data-testid="billing-current">
      <div className="sb-hero">
        <div className="sb-hero-main">
          <p className="sb-eyebrow">Current subscription</p>
          <h4 id="sb-current-title">{c.planName || "Unnamed plan"}</h4>
          <div className="sb-tags">
            <Badge tone={c.status}>{STATUS_LABELS[c.status] || c.status}</Badge>
            {c.isCustomPrice && <Badge tone="custom">Negotiated price</Badge>}
          </div>
          {c.planDescription && <p className="sb-muted">{c.planDescription}</p>}
        </div>
        <div className="sb-hero-side">
          <p className="sb-price">{pricePer(c.amount, c.billingCycle, c.currency)}</p>
          <p className={`sb-remaining${urgent ? " urgent" : ""}`}>{remainingText(c.daysRemaining)}</p>
        </div>
      </div>
      <dl className="sb-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <h5>Included features</h5>
      {features.length === 0 ? <p className="sb-muted">No features are listed for this subscription.</p> : (
        <ul className="sb-features">{features.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}</ul>
      )}
    </section>
  );
};

const PreviousPlans = ({ rows }) => (
  <section className="sb-card" aria-labelledby="sb-previous-title">
    <h4 id="sb-previous-title">Previous plans</h4>
    {rows.length === 0 ? <p className="sb-empty">No previous subscription periods yet.</p> : (
      <div className="sb-table-wrap">
        <table className="sb-table">
          <thead><tr><th>Plan</th><th>Period</th><th>Price</th><th>Limits (users / employees / MB)</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.planName || "Unnamed plan"}</td>
                <td className="sb-nowrap">{fmtDay(r.periodStart)} – {fmtDay(r.expiryDate)}</td>
                <td className="sb-nowrap">{pricePer(r.amount, r.billingCycle, r.currency)}{r.isCustomPrice && <> <Badge tone="custom">Negotiated</Badge></>}</td>
                <td className="sb-nowrap">{[r.userLimit, r.employeeLimit, r.storageLimitMb].map((v) => v ?? "—").join(" / ")}</td>
                <td>
                  <Badge tone={r.outcome === "expired" ? "expired" : "not_configured"}>{OUTCOME_LABELS[r.outcome] || "Ended"}</Badge>
                  <div className="sb-muted">on {fmtDay(r.endedAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const Payments = ({ rows }) => {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const download = async (p) => {
    setBusy(p.id);
    setError("");
    try {
      saveBlob(await billing.receipt(p.id), p.receipt.name);
    } catch (e) {
      setError("Could not download the receipt. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="sb-card" aria-labelledby="sb-payments-title">
      <h4 id="sb-payments-title">Payment history</h4>
      {error && <p className="settings-inline-error" role="alert">{error}</p>}
      {rows.length === 0 ? <p className="sb-empty">No payments have been recorded for your company.</p> : (
        <div className="sb-table-wrap">
          <table className="sb-table">
            <thead><tr><th>Payment date</th><th>Amount</th><th>Method</th><th>Reference ID</th><th>Plan</th><th>Status</th><th>Invoice / receipt</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="sb-nowrap">{fmtDay(p.paymentDate)}</td>
                  <td className="sb-nowrap">{money(p.amount, p.currency)}</td>
                  <td>{methodLabel(p.method)}</td>
                  <td>{p.reference || "—"}</td>
                  <td>{p.planName || "—"}</td>
                  <td><Badge tone={`pay-${p.status}`}>{PAYMENT_STATUS_LABELS[p.status] || p.status}</Badge></td>
                  <td>
                    {p.receipt
                      ? <button type="button" className="mini-btn" onClick={() => download(p)} disabled={busy === p.id} aria-label={`Download ${p.receipt.name}`}>{busy === p.id ? "Downloading…" : "Download"}</button>
                      : <span className="sb-muted">Not available</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const SubscriptionBilling = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const alive = useRef(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await billing.subscription();
      if (alive.current) setData(res);
    } catch (e) {
      if (alive.current) setError(e?.response?.data?.message || "Could not load your subscription.");
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  return (
    <div className="sb-root">
      <div>
        <h3>Subscription &amp; Billing</h3>
        <p className="sb-muted">View only. To change your plan or pricing, contact your account manager.</p>
      </div>
      {error ? (
        <div className="sb-card">
          <p className="settings-inline-error" role="alert">{error}</p>
          <button type="button" className="primary-btn" onClick={load}>Retry</button>
        </div>
      ) : !data ? (
        <div className="sb-card" role="status" aria-busy="true" aria-label="Loading subscription">
          <div className="sb-skel" /><div className="sb-skel" /><div className="sb-skel" />
        </div>
      ) : (
        <>
          {data.current ? <CurrentPlan c={data.current} /> : (
            <section className="sb-card"><p className="sb-empty">No subscription has been set up for your company yet.</p></section>
          )}
          <PreviousPlans rows={data.previous || []} />
          <Payments rows={data.payments || []} />
        </>
      )}
    </div>
  );
};

export default SubscriptionBilling;

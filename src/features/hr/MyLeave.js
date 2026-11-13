import React, { useCallback, useEffect, useMemo, useState } from "react";
import { hrError, leaveApi } from "../../services/hrService";
import { ConfirmModal, Modal, StateBlock, fmtDate } from "./hrUi";

const EMPTY = { leaveTypeId: "", startDate: "", endDate: "", reason: "", emergencyContactName: "", emergencyPhone: "", workHandoverTo: "", handoverNotes: "" };

export const validateLeaveForm = (f, today = new Date().toISOString().slice(0, 10)) => {
  const e = {};
  if (!f.leaveTypeId) e.leaveTypeId = "Choose a leave type.";
  if (!f.startDate) e.startDate = "Choose a start date.";
  if (!f.endDate) e.endDate = "Choose an end date.";
  if (f.startDate && f.endDate && f.startDate > f.endDate) e.endDate = "End date must not be before the start date.";
  if (f.startDate && f.startDate < today && !e.startDate) e.startDate = "Start date is in the past — contact HR for back-dated leave.";
  if (!f.reason.trim() || f.reason.trim().length < 3) e.reason = "Give a short reason (at least 3 characters).";
  return e;
};

/**
 * "My Leave": apply for leave, see own balances and requests, cancel own
 * requests. Used by every role that can take leave (HR panel, Manager, TL;
 * the Executive page uses the same API). The employee is always the signed-in
 * user - no employee id is ever sent.
 */
const MyLeave = () => {
  const year = new Date().getFullYear();
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const [t, b, l] = await Promise.all([leaveApi.types(), leaveApi.myBalances(year), leaveApi.mine()]);
      setTypes(t);
      setBalances(b.balances);
      setLeaves(l);
      setState({ loading: false, error: "" });
    } catch (e) {
      setState({ loading: false, error: hrError(e, "Could not load your leave details.") });
    }
  }, [year]);
  useEffect(() => {
    load();
  }, [load]);

  const balanceOf = useMemo(() => Object.fromEntries(balances.map((b) => [b.leaveTypeId, b])), [balances]);
  const set = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: undefined }));
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const found = validateLeaveForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError("");
    try {
      await leaveApi.apply({ ...form, leaveTypeId: Number(form.leaveTypeId) });
      setNotice("Leave request submitted. HR will review it.");
      setForm(EMPTY);
      setOpen(false);
      load();
    } catch (e) {
      setServerError(hrError(e, "Could not submit the request."));
    } finally {
      setSaving(false);
    }
  };

  const doCancel = async () => {
    setSaving(true);
    try {
      await leaveApi.cancel(cancelTarget.id, "Cancelled by employee");
      setNotice("Leave cancelled.");
      setCancelTarget(null);
      load();
    } catch (e) {
      setServerError(hrError(e, "Could not cancel the leave."));
      setCancelTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const cancellable = (l) => l.status === "Pending" || (l.status === "Approved" && l.startDate >= today);
  const selected = balanceOf[Number(form.leaveTypeId)];

  return (
    <div className="hr-page">
      <div className="hr-head">
        <div>
          <h1>My Leave</h1>
          <p>Leave is allocated manually by HR each year; unused days expire on 31 December and do not carry forward.</p>
        </div>
        <button type="button" className="hr-btn" onClick={() => { setOpen(true); setServerError(""); }}>Apply for leave</button>
      </div>
      {notice && <div className="hr-ok" role="status">{notice}</div>}
      {serverError && !open && <div className="hr-error" role="alert">{serverError}</div>}

      <StateBlock loading={state.loading} error={state.error} onRetry={load}>
        <div className="hr-grid cols-4">
          {balances.length === 0 && <div className="hr-card hr-empty" style={{ gridColumn: "1 / -1" }}>HR has not allocated any leave to you for {year} yet.</div>}
          {balances.map((b) => (
            <div key={b.leaveTypeId} className="hr-card hr-stat" data-testid={`balance-${b.code}`}>
              <span className="hr-stat-label">{b.name} ({b.code})</span>
              <span className="hr-stat-value">{b.remaining}</span>
              <span className="hr-stat-sub">{b.allocated} allocated · {b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</span>
            </div>
          ))}
        </div>

        <div className="hr-card" style={{ marginTop: 16 }}>
          <h3>My requests</h3>
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Type</th><th>From</th><th>To</th><th className="num">Working days</th><th>Status</th><th>HR comment</th><th /></tr>
              </thead>
              <tbody>
                {leaves.length === 0 && <tr><td colSpan={7} className="hr-empty">You have not applied for any leave yet.</td></tr>}
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{l.leaveType}</td>
                    <td>{fmtDate(l.startDate)}</td>
                    <td>{fmtDate(l.endDate)}</td>
                    <td className="num">{l.workingDays ?? l.totalDays}</td>
                    <td><span className={`hr-pill ${l.status}`}>{l.status}</span></td>
                    <td>{l.hrComment || l.cancelReason || "—"}</td>
                    <td>{cancellable(l) && <button type="button" className="hr-link danger" onClick={() => setCancelTarget(l)}>Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </StateBlock>

      {open && (
        <Modal title="Apply for leave" onClose={() => setOpen(false)}>
          <form className="hr-form" onSubmit={submit} noValidate>
            <label>Leave type
              <select name="leaveTypeId" value={form.leaveTypeId} onChange={set}>
                <option value="">Select leave type</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
              {selected && selected.requiresBalance && <span className="hr-help">{selected.available} day(s) available</span>}
              {errors.leaveTypeId && <span className="hr-error">{errors.leaveTypeId}</span>}
            </label>
            <div className="hr-row">
              <label>From<input type="date" name="startDate" value={form.startDate} onChange={set} />{errors.startDate && <span className="hr-error">{errors.startDate}</span>}</label>
              <label>To<input type="date" name="endDate" value={form.endDate} min={form.startDate} onChange={set} />{errors.endDate && <span className="hr-error">{errors.endDate}</span>}</label>
            </div>
            <label>Reason<textarea name="reason" value={form.reason} onChange={set} maxLength={1000} />{errors.reason && <span className="hr-error">{errors.reason}</span>}</label>
            <div className="hr-row">
              <label>Emergency contact<input name="emergencyContactName" value={form.emergencyContactName} onChange={set} maxLength={255} /></label>
              <label>Emergency phone<input name="emergencyPhone" value={form.emergencyPhone} onChange={set} maxLength={50} /></label>
            </div>
            <label>Work handed over to<input name="workHandoverTo" value={form.workHandoverTo} onChange={set} maxLength={255} /></label>
            <span className="hr-help">Sundays and company holidays are not counted against your balance.</span>
            {serverError && <div className="hr-error" role="alert">{serverError}</div>}
            <div className="hr-modal-actions">
              <button type="button" className="hr-btn ghost" onClick={() => setOpen(false)} disabled={saving}>Close</button>
              <button type="submit" className="hr-btn" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</button>
            </div>
          </form>
        </Modal>
      )}
      {cancelTarget && (
        <ConfirmModal
          title="Cancel this leave?"
          message={`Your ${cancelTarget.leaveType} leave from ${fmtDate(cancelTarget.startDate)} to ${fmtDate(cancelTarget.endDate)} will be cancelled.`}
          confirmLabel="Cancel leave"
          danger
          busy={saving}
          onConfirm={doCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
};

export default MyLeave;

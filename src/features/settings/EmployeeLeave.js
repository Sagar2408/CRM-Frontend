import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "../../context/ApiContext";
import { leaveApi } from "../../services/hrService";
import "../../styles/settingsWorkspace.css";

const EXCEPTION_MIN = 10;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

const EMPTY = {
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  reason: "",
  emergencyContactName: "",
  emergencyPhone: "",
  workHandoverTo: "",
  handoverNotes: "",
  exceptionRequested: false,
  exceptionReason: "",
};

/** Client-side checks only; the server re-validates every rule. Exported for tests. */
export const validateLeaveForm = (f, preview) => {
  const e = {};
  if (!f.leaveTypeId) e.leaveTypeId = "Select a leave type";
  if (!f.startDate) e.startDate = "Choose a start date";
  if (!f.endDate) e.endDate = "Choose an end date";
  if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = "End date cannot be before the start date";
  if ((f.reason || "").trim().length < 3) e.reason = "Please give a reason (at least 3 characters)";
  if (preview?.exceedsBalance) {
    if (!f.exceptionRequested) e.exceptionRequested = "Tick the box to request an exception";
    if ((f.exceptionReason || "").trim().length < EXCEPTION_MIN) e.exceptionReason = `Explain why you need this extra leave (at least ${EXCEPTION_MIN} characters)`;
  }
  return e;
};

const BalanceCards = ({ balances, year, loading, error }) => (
  <section aria-label="Leave balances" style={{ marginBottom: 20 }}>
    <div className="xs-page-head" style={{ marginBottom: 10 }}>
      <div>
        <h3 style={{ margin: 0 }}>Your leave balance — {year}</h3>
        <p className="xs-page-sub">Allocated by HR for the calendar year. Unused leave does not carry forward.</p>
      </div>
    </div>
    {loading && <p className="xs-hint" role="status">Loading balances…</p>}
    {error && <div className="xs-alert error" role="alert">{error}</div>}
    {!loading && !error && balances.length === 0 && (
      <div className="xs-alert">No leave types are available yet. Please contact HR.</div>
    )}
    <div className="xs-grid">
      {balances.map((b) => (
        <div className="xs-card" key={b.leaveTypeId} data-testid={`balance-${b.code}`}>
          <div className="xs-card-head">
            <h3>{b.name}</h3>
            <span className="xs-badge">{b.requiresBalance ? b.code : `${b.code} · no balance needed`}</span>
          </div>
          {b.requiresBalance ? (
            <div className="xs-fields" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 8 }}>
              <div className="xs-field"><span className="xs-label">Allocated</span><span className="xs-value">{b.allocated}</span></div>
              <div className="xs-field"><span className="xs-label">Used</span><span className="xs-value">{b.used}</span></div>
              <div className="xs-field"><span className="xs-label">Pending</span><span className="xs-value">{b.pending}</span></div>
              <div className="xs-field"><span className="xs-label">Available</span><span className="xs-value" style={{ fontWeight: 700 }} data-testid={`available-${b.code}`}>{b.available}</span></div>
            </div>
          ) : (
            <p className="xs-card-sub" style={{ marginTop: 8 }}>Used so far: {b.used} day(s). This type is not limited by a balance.</p>
          )}
        </div>
      ))}
    </div>
  </section>
);

const EmployeeLeave = () => {
  const { uploadFileAPI } = useApi();
  const year = new Date().getFullYear();

  const [balances, setBalances] = useState([]);
  const [balLoading, setBalLoading] = useState(true);
  const [balError, setBalError] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState("");

  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch (_) { return {}; }
  }, []);

  const loadBalances = useCallback(async () => {
    setBalLoading(true);
    setBalError("");
    try {
      const res = await leaveApi.myBalances(year);
      setBalances(res.balances || []);
    } catch (e) {
      setBalError(errMsg(e, "Could not load your leave balances."));
    } finally {
      setBalLoading(false);
    }
  }, [year]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setHistError("");
    try {
      setLeaves((await leaveApi.mine()) || []);
    } catch (e) {
      setHistError(errMsg(e, "Could not load your leave history."));
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => { loadBalances(); loadHistory(); }, [loadBalances, loadHistory]);

  const types = useMemo(() => balances.filter((b) => b.active), [balances]);
  const selectedType = types.find((t) => String(t.leaveTypeId) === String(form.leaveTypeId));

  // Live check of the chosen dates against the server's rules (working days, holidays, weekly offs, overlap, balance).
  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    if (!form.leaveTypeId || !form.startDate || !form.endDate || form.endDate < form.startDate) return undefined;
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const p = await leaveApi.preview({ leaveTypeId: Number(form.leaveTypeId), startDate: form.startDate, endDate: form.endDate });
        if (alive) setPreview(p);
      } catch (e) {
        if (alive) setPreviewError(errMsg(e, "Could not check these dates."));
      } finally {
        if (alive) setPreviewing(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [form.leaveTypeId, form.startDate, form.endDate]);

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setNotice(null);
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const blocked = !!previewError || !!preview?.overlap || !!preview?.noWorkingDays || previewing || !preview;

  const submit = async (ev) => {
    ev.preventDefault();
    const v = validateLeaveForm(form, preview);
    setErrors(v);
    if (Object.keys(v).length || blocked) return;
    setSubmitting(true);
    setNotice(null);
    try {
      let supportingDocumentPath;
      if (file) {
        const up = await uploadFileAPI(file);
        supportingDocumentPath = up?.filePath || undefined;
      }
      const body = {
        leaveTypeId: Number(form.leaveTypeId),
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        workHandoverTo: form.workHandoverTo.trim() || undefined,
        handoverNotes: form.handoverNotes.trim() || undefined,
        supportingDocumentPath,
      };
      if (preview?.exceedsBalance) {
        body.exceptionRequested = true;
        body.exceptionReason = form.exceptionReason.trim();
      }
      const res = await leaveApi.apply(body);
      const saved = res?.data;
      setNotice({
        type: "ok",
        text: saved?.exceedsBalance
          ? "Your request was submitted and flagged as exceeding your balance. HR will review it."
          : "Your leave request was submitted and is pending HR approval.",
      });
      setForm(EMPTY);
      setFile(null);
      setErrors({});
      await Promise.all([loadBalances(), loadHistory()]);
    } catch (e) {
      setNotice({ type: "error", text: errMsg(e, "Could not submit your leave request.") });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (leave) => {
    setNotice(null);
    try {
      await leaveApi.cancel(leave.id, "Cancelled by employee");
      setNotice({ type: "ok", text: "Leave request cancelled." });
      await Promise.all([loadBalances(), loadHistory()]);
    } catch (e) {
      setNotice({ type: "error", text: errMsg(e, "Could not cancel this request.") });
    }
  };

  return (
    <div>
      <div className="xs-page-head">
        <div>
          <h2 className="xs-page-title">Ask for Leave</h2>
          <p className="xs-page-sub">
            {me?.username ? `Applying as ${me.username}${me.role ? ` (${me.role})` : ""}. ` : ""}
            HR reviews every request. Sundays and company holidays are not counted.
          </p>
        </div>
      </div>

      {notice && <div className={`xs-alert ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} style={{ marginBottom: 16 }}>{notice.text}</div>}

      <BalanceCards balances={balances} year={year} loading={balLoading} error={balError} />

      <div className="xs-grid two">
        <form className="xs-card" onSubmit={submit} noValidate aria-label="Leave application">
          <h3>New leave request</h3>
          <p className="xs-card-sub">Step 1 – choose type and dates. Step 2 – review the summary. Step 3 – give a reason and submit.</p>

          <div className="xs-fields">
            <div className="xs-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="lv-type">Leave type *</label>
              <select id="lv-type" name="leaveTypeId" className="xs-select" value={form.leaveTypeId} onChange={set}>
                <option value="">Select leave type</option>
                {types.map((t) => (
                  <option key={t.leaveTypeId} value={t.leaveTypeId}>
                    {t.name}{t.requiresBalance ? ` — ${t.available} available` : ""}
                  </option>
                ))}
              </select>
              {errors.leaveTypeId && <span className="xs-error">{errors.leaveTypeId}</span>}
            </div>
            <div className="xs-field">
              <label htmlFor="lv-start">From *</label>
              <input id="lv-start" type="date" name="startDate" className="xs-input" value={form.startDate} onChange={set} />
              {errors.startDate && <span className="xs-error">{errors.startDate}</span>}
            </div>
            <div className="xs-field">
              <label htmlFor="lv-end">To *</label>
              <input id="lv-end" type="date" name="endDate" className="xs-input" value={form.endDate} min={form.startDate || undefined} onChange={set} />
              {errors.endDate && <span className="xs-error">{errors.endDate}</span>}
            </div>
          </div>
          <p className="xs-hint" style={{ marginTop: 6 }}>Leave is applied for full days. {form.startDate && form.startDate < today() ? "You are applying for a past date." : ""}</p>

          {previewing && <p className="xs-hint" role="status">Checking your dates…</p>}
          {previewError && <div className="xs-alert error" role="alert" style={{ marginTop: 10 }}>{previewError}</div>}
          {preview && (
            <div className="xs-alert" style={{ marginTop: 12 }} data-testid="leave-summary" aria-live="polite">
              <strong>{preview.workingDays} working day(s)</strong> will be counted
              {" "}({preview.totalDays} calendar day(s) from {fmt(form.startDate)} to {fmt(form.endDate)}).
              {preview.weeklyOffs.length > 0 && <div>Weekly off (not counted): {preview.weeklyOffs.map(fmt).join(", ")}</div>}
              {preview.holidays.length > 0 && <div>Holidays (not counted): {preview.holidays.map((h) => `${fmt(h.date)} ${h.name}`).join(", ")}</div>}
              {preview.requiresBalance && preview.years.map((y) => (
                <div key={y.year}>{y.year}: {y.requested} day(s) requested, {Math.max(y.available ?? 0, 0)} available</div>
              ))}
            </div>
          )}
          {preview?.overlap && (
            <div className="xs-alert error" role="alert" style={{ marginTop: 10 }}>
              You already have a {preview.overlap.status.toLowerCase()} leave from {fmt(preview.overlap.startDate)} to {fmt(preview.overlap.endDate)} that overlaps these dates.
            </div>
          )}
          {preview?.noWorkingDays && (
            <div className="xs-alert error" role="alert" style={{ marginTop: 10 }}>These dates contain no working days (only weekly offs / holidays).</div>
          )}
          {preview?.exceedsBalance && !preview.overlap && !preview.noWorkingDays && (
            <div className="xs-alert warn" style={{ marginTop: 10 }} data-testid="exceeds-warning">
              <strong>This request exceeds your available {selectedType?.name || "leave"} balance by {preview.shortfall} day(s).</strong>
              <div>You can still submit it as an exception request. It will be flagged for HR, who will decide whether to approve or reject it.</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
                <input type="checkbox" name="exceptionRequested" checked={form.exceptionRequested} onChange={set} />
                I want to request an exception beyond my balance
              </label>
              {errors.exceptionRequested && <span className="xs-error">{errors.exceptionRequested}</span>}
              <label htmlFor="lv-exc" className="xs-label">Explanation for HR *</label>
              <textarea id="lv-exc" name="exceptionReason" className="xs-textarea" value={form.exceptionReason} onChange={set} maxLength={1000} disabled={!form.exceptionRequested} />
              {errors.exceptionReason && <span className="xs-error">{errors.exceptionReason}</span>}
            </div>
          )}

          <div className="xs-field" style={{ marginTop: 14 }}>
            <label htmlFor="lv-reason">Reason *</label>
            <textarea id="lv-reason" name="reason" className="xs-textarea" value={form.reason} onChange={set} maxLength={1000} />
            {errors.reason && <span className="xs-error">{errors.reason}</span>}
          </div>

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Optional: contact, handover and document</summary>
            <div className="xs-fields" style={{ marginTop: 12 }}>
              <div className="xs-field"><label htmlFor="lv-ecn">Emergency contact</label><input id="lv-ecn" name="emergencyContactName" className="xs-input" value={form.emergencyContactName} onChange={set} maxLength={255} /></div>
              <div className="xs-field"><label htmlFor="lv-ep">Emergency phone</label><input id="lv-ep" name="emergencyPhone" type="tel" className="xs-input" value={form.emergencyPhone} onChange={set} maxLength={50} /></div>
              <div className="xs-field"><label htmlFor="lv-wh">Work handover to</label><input id="lv-wh" name="workHandoverTo" className="xs-input" value={form.workHandoverTo} onChange={set} maxLength={255} /></div>
              <div className="xs-field"><label htmlFor="lv-doc">Supporting document</label><input id="lv-doc" type="file" className="xs-input" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
              <div className="xs-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="lv-hn">Handover notes</label><textarea id="lv-hn" name="handoverNotes" className="xs-textarea" value={form.handoverNotes} onChange={set} maxLength={2000} /></div>
            </div>
          </details>

          <div className="xs-actions">
            <button type="button" className="xs-btn" onClick={() => { setForm(EMPTY); setErrors({}); setFile(null); setNotice(null); }} disabled={submitting}>Clear</button>
            <button type="submit" className="xs-btn primary" disabled={submitting || blocked}>
              {submitting ? "Submitting…" : preview?.exceedsBalance ? "Submit exception request" : "Submit request"}
            </button>
          </div>
        </form>

        <section className="xs-card" aria-label="Leave history">
          <h3>My leave history</h3>
          <p className="xs-card-sub">Status updates appear here once HR responds.</p>
          {histLoading && <p className="xs-hint" role="status">Loading history…</p>}
          {histError && <div className="xs-alert error" role="alert">{histError}</div>}
          {!histLoading && !histError && leaves.length === 0 && <p className="xs-hint">You have not applied for leave yet.</p>}
          {leaves.length > 0 && (
            <div className="xs-table-wrap">
              <table className="xs-table">
                <thead>
                  <tr><th>Type</th><th>Dates</th><th className="num">Days</th><th>Status</th><th>Details</th><th /></tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} data-testid={`leave-row-${l.id}`}>
                      <td>{l.leaveType}</td>
                      <td>{fmt(l.startDate)} – {fmt(l.endDate)}<div className="xs-hint">Applied {fmt(l.appliedDate)}</div></td>
                      <td className="num">{l.workingDays ?? l.totalDays}</td>
                      <td>
                        <span className={`xs-badge ${l.status}`}>{l.status}</span>
                        {l.exceedsBalance && <div><span className="xs-badge flag">Exceeds balance by {l.balanceShortfall}</span></div>}
                      </td>
                      <td>
                        <div>{l.reason}</div>
                        {l.exceedsBalance && l.exceptionReason && <div className="xs-hint">Exception: {l.exceptionReason}</div>}
                        {l.hrComment && <div className="xs-hint">HR: {l.hrComment}</div>}
                        {l.cancelReason && <div className="xs-hint">Cancelled: {l.cancelReason}</div>}
                      </td>
                      <td>
                        {(l.status === "Pending" || (l.status === "Approved" && l.startDate >= today())) && (
                          <button type="button" className="xs-btn" onClick={() => cancel(l)}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default EmployeeLeave;

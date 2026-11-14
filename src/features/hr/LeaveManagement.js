import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarToggle from "../admin/SidebarToggle";
import { EMPLOYEE_TYPES, hrError, leaveApi, typeLabel } from "../../services/hrService";
import MyLeave from "./MyLeave";
import { ConfirmModal, Modal, Pager, StateBlock, fmtDate, fmtDateTime, useDebounced } from "./hrUi";

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "balances", label: "Balances" },
  { id: "types", label: "Leave types" },
  { id: "mine", label: "My leave" },
];
const LIMIT = 10;

// ------------------------------------------------------------------ requests
const Requests = ({ types }) => {
  const [filters, setFilters] = useState({ status: "Pending", employeeType: "", leaveTypeId: "", q: "" });
  const q = useDebounced(filters.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ requests: [], total: 0, counts: {} });
  const [state, setState] = useState({ loading: true, error: "" });
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState(null); // {leave, kind: Approved|Rejected|revoke}
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "" });
    leaveApi
      .requests({ status: filters.status, employeeType: filters.employeeType, leaveTypeId: filters.leaveTypeId, q, page, limit: LIMIT })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState({ loading: false, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, error: hrError(e, "Could not load leave requests.") }));
    return () => {
      alive = false;
    };
  }, [filters.status, filters.employeeType, filters.leaveTypeId, q, page, reload]);

  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const close = () => {
    setAction(null);
    setComment("");
    setActionError("");
  };

  const run = async () => {
    if (action.kind === "revoke" && !comment.trim()) {
      setActionError("A reason is required to revoke a leave.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (action.kind === "revoke") await leaveApi.cancel(action.leave.id, comment.trim());
      else await leaveApi.decide(action.leave.id, action.kind, comment.trim());
      setNotice(action.kind === "revoke" ? "Leave revoked." : `Leave ${action.kind.toLowerCase()}.`);
      close();
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(hrError(e, "Could not update the request."));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (leave) => {
    try {
      setDetail(await leaveApi.request(leave.id));
    } catch (e) {
      setNotice(hrError(e, "Could not load the request."));
    }
  };

  return (
    <>
      {notice && <div className="hr-ok" role="status">{notice}</div>}
      <div className="hr-toolbar">
        <input type="search" placeholder="Search by employee name" aria-label="Search requests" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          {["Pending", "Approved", "Rejected", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}{data.counts?.[s] !== undefined ? ` (${data.counts[s]})` : ""}</option>
          ))}
        </select>
        <select aria-label="Filter by role" value={filters.employeeType} onChange={(e) => setFilter("employeeType", e.target.value)}>
          <option value="">All roles</option>
          {EMPLOYEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select aria-label="Filter by leave type" value={filters.leaveTypeId} onChange={(e) => setFilter("leaveTypeId", e.target.value)}>
          <option value="">All leave types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <StateBlock loading={state.loading} error={state.error} onRetry={() => setReload((n) => n + 1)}>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr><th>Employee</th><th>Role</th><th>Leave type</th><th>From</th><th>To</th><th className="num">Days</th><th>Reason</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {data.requests.length === 0 && <tr><td colSpan={9} className="hr-empty">No leave requests match these filters.</td></tr>}
              {data.requests.map((l) => (
                <tr key={l.id}>
                  <td><button type="button" className="hr-link" onClick={() => openDetail(l)}>{l.fullName}</button></td>
                  <td>{typeLabel(l.employeeType)}</td>
                  <td>
                    {l.leaveType}
                    {l.exceedsBalance && (
                      <div><span className="hr-pill Pending" title={l.exceptionReason || ""}>Exceeds balance by {l.balanceShortfall ?? "?"} day(s)</span></div>
                    )}
                  </td>
                  <td>{fmtDate(l.startDate)}</td>
                  <td>{fmtDate(l.endDate)}</td>
                  <td className="num">{l.workingDays ?? l.totalDays}</td>
                  <td style={{ maxWidth: 240, overflowWrap: "anywhere" }}>{l.reason}</td>
                  <td><span className={`hr-pill ${l.status}`}>{l.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.status === "Pending" && !l.isOwn && (
                      <>
                        <button type="button" className="hr-btn ok sm" onClick={() => setAction({ leave: l, kind: "Approved" })}>Approve</button>{" "}
                        <button type="button" className="hr-btn danger sm" onClick={() => setAction({ leave: l, kind: "Rejected" })}>Reject</button>
                      </>
                    )}
                    {l.status === "Pending" && l.isOwn && <span className="hr-help">Your own request needs another approver</span>}
                    {l.status === "Approved" && !l.isOwn && (
                      <button type="button" className="hr-link danger" onClick={() => setAction({ leave: l, kind: "revoke" })}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} limit={LIMIT} total={data.total} onPage={setPage} />
      </StateBlock>

      {action && (
        <ConfirmModal
          title={action.kind === "revoke" ? "Revoke approved leave?" : `${action.kind === "Approved" ? "Approve" : "Reject"} leave request?`}
          message={`${action.leave.fullName} · ${action.leave.leaveType} · ${fmtDate(action.leave.startDate)} to ${fmtDate(action.leave.endDate)}.${action.kind === "Approved" ? " Attendance will show Leave for every working day in this range." : action.kind === "revoke" ? " Attendance and the leave balance will be restored." : ""}`}
          confirmLabel={action.kind === "revoke" ? "Revoke" : action.kind === "Approved" ? "Approve" : "Reject"}
          danger={action.kind !== "Approved"}
          busy={busy}
          onConfirm={run}
          onCancel={close}
        >
          <label className="hr-form">
            <span>{action.kind === "revoke" ? "Reason (required)" : "Comment (optional)"}</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} aria-label="Comment" />
          </label>
          {actionError && <div className="hr-error" role="alert">{actionError}</div>}
        </ConfirmModal>
      )}
      {detail && (
        <Modal title="Leave request" onClose={() => setDetail(null)}>
          <p>
            <strong>{detail.leave.fullName}</strong> ({typeLabel(detail.leave.employeeType)}) — {detail.leave.leaveType}
            <br />
            {fmtDate(detail.leave.startDate)} to {fmtDate(detail.leave.endDate)} · {detail.leave.workingDays} working day(s)
          </p>
          <p><strong>Reason:</strong> {detail.leave.reason}</p>
          {detail.leave.exceedsBalance && (
            <div className="hr-error" role="note" data-testid="exception-flag">
              <strong>Exceeds leave balance by {detail.leave.balanceShortfall} day(s) — exception requested.</strong>
              <br />
              Employee's explanation: {detail.leave.exceptionReason}
              <br />
              Approving this request grants the exception; rejecting it declines it.
            </div>
          )}
          <p>
            <strong>Total days:</strong> {detail.leave.totalDays} · <strong>Applied:</strong> {fmtDate(detail.leave.appliedDate)}
            {detail.leave.emergencyContactName && <><br /><strong>Emergency contact:</strong> {detail.leave.emergencyContactName} {detail.leave.emergencyPhone}</>}
            {detail.leave.workHandoverTo && <><br /><strong>Work handover to:</strong> {detail.leave.workHandoverTo}</>}
            {detail.leave.handoverNotes && <><br /><strong>Handover notes:</strong> {detail.leave.handoverNotes}</>}
          </p>
          <h3>History</h3>
          <ul className="hr-list">
            {detail.events.map((e) => (
              <li key={e.id}><time>{fmtDateTime(e.createdAt)}</time><span><strong>{e.action}</strong> by {e.actorName || e.actorRole}{e.comment ? ` — ${e.comment}` : ""}</span></li>
            ))}
          </ul>
          <div className="hr-modal-actions"><button type="button" className="hr-btn ghost" onClick={() => setDetail(null)}>Close</button></div>
        </Modal>
      )}
    </>
  );
};

// ------------------------------------------------------------------ balances
const AllocationModal = ({ target, types, year, onClose, onSaved }) => {
  const [f, setF] = useState({ leaveTypeId: "", mode: "ALLOCATE", days: "", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (ev) => {
    ev.preventDefault();
    const days = Number(f.days);
    if (!f.leaveTypeId) return setError("Choose a leave type.");
    if (!days || Number.isNaN(days)) return setError("Enter the number of days.");
    if (days % 0.5 !== 0) return setError("Days must be a whole or half number.");
    if (f.mode === "ALLOCATE" && days <= 0) return setError("An allocation must be positive. Use Adjust to reduce a balance.");
    if (f.reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");
    setSaving(true);
    setError("");
    try {
      const body = { employeeType: target.employeeType, employeeId: target.employeeId, leaveTypeId: Number(f.leaveTypeId), year, days, reason: f.reason.trim() };
      await (f.mode === "ALLOCATE" ? leaveApi.allocate(body) : leaveApi.adjust(body));
      onSaved();
    } catch (e) {
      setError(hrError(e, "Could not update the balance."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Leave balance — ${target.name} (${year})`} onClose={onClose}>
      <form className="hr-form" onSubmit={submit} noValidate>
        <label>Leave type
          <select name="leaveTypeId" value={f.leaveTypeId} onChange={set}>
            <option value="">Select</option>
            {types.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
        </label>
        <div className="hr-row">
          <label>Action
            <select name="mode" value={f.mode} onChange={set}>
              <option value="ALLOCATE">Allocate (add days)</option>
              <option value="ADJUST">Adjust (+/− days)</option>
            </select>
          </label>
          <label>Days<input name="days" type="number" step="0.5" value={f.days} onChange={set} /></label>
        </div>
        <label>Reason<input name="reason" value={f.reason} onChange={set} maxLength={500} /></label>
        <span className="hr-help">Allocation is manual. Nothing is added automatically, and unused days expire at the end of {year}.</span>
        {error && <div className="hr-error" role="alert">{error}</div>}
        <div className="hr-modal-actions">
          <button type="button" className="hr-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="hr-btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
};

const History = ({ employee, onClose }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    leaveApi
      .history({ employeeType: employee.employeeType, employeeId: employee.employeeId, limit: 50 })
      .then((d) => setRows(d.history))
      .catch((e) => setError(hrError(e, "Could not load history.")));
  }, [employee]);
  return (
    <Modal title={`Allocation history — ${employee.name}`} onClose={onClose}>
      <StateBlock loading={!rows && !error} error={error} empty={rows && rows.length === 0} emptyText="No allocations yet.">
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead><tr><th>When</th><th>Type</th><th>Year</th><th className="num">Change</th><th className="num">Balance</th><th>By</th><th>Reason</th></tr></thead>
            <tbody>
              {(rows || []).map((h) => (
                <tr key={h.id}>
                  <td>{fmtDateTime(h.createdAt)}</td><td>{h.leaveTypeName}</td><td>{h.year}</td>
                  <td className="num">{Number(h.delta) > 0 ? "+" : ""}{h.delta}</td><td className="num">{h.newAllocated}</td>
                  <td>{h.actorName || h.actorRole}</td><td>{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBlock>
      <div className="hr-modal-actions"><button type="button" className="hr-btn ghost" onClick={onClose}>Close</button></div>
    </Modal>
  );
};

const Balances = ({ types }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [filters, setFilters] = useState({ employeeType: "", q: "" });
  const q = useDebounced(filters.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ employees: [], total: 0 });
  const [state, setState] = useState({ loading: true, error: "" });
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "" });
    leaveApi
      .balanceOverview({ year, employeeType: filters.employeeType, q, page, limit: LIMIT })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState({ loading: false, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, error: hrError(e, "Could not load balances.") }));
    return () => {
      alive = false;
    };
  }, [year, filters.employeeType, q, page, reload]);

  const activeTypes = useMemo(() => types.filter((t) => t.active), [types]);

  return (
    <>
      <div className="hr-toolbar">
        <input type="search" placeholder="Search employee" aria-label="Search employees" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
        <select aria-label="Filter by role" value={filters.employeeType} onChange={(e) => { setFilters((f) => ({ ...f, employeeType: e.target.value })); setPage(1); }}>
          <option value="">All roles</option>
          {EMPLOYEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select aria-label="Leave year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}>
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="hr-note" style={{ marginBottom: 12 }}>Policy: manual allocation only · no carry forward · unused balance expires at the end of the leave year.</div>
      <StateBlock loading={state.loading} error={state.error} onRetry={() => setReload((n) => n + 1)}>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr><th>Employee</th><th>Role</th>{activeTypes.map((t) => <th key={t.id} className="num">{t.code} (left / allocated)</th>)}<th /></tr>
            </thead>
            <tbody>
              {data.employees.length === 0 && <tr><td colSpan={3 + activeTypes.length} className="hr-empty">No employees found.</td></tr>}
              {data.employees.map((e) => (
                <tr key={`${e.employeeType}-${e.employeeId}`}>
                  <td>{e.name}</td>
                  <td>{typeLabel(e.employeeType)}</td>
                  {activeTypes.map((t) => {
                    const b = e.balances.find((x) => x.leaveTypeId === t.id);
                    return <td key={t.id} className="num">{b ? `${b.remaining} / ${b.allocated}` : "0 / 0"}</td>;
                  })}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="hr-btn sm" onClick={() => setTarget({ ...e })}>Allocate / adjust</button>{" "}
                    <button type="button" className="hr-link" onClick={() => setHistory(e)}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} limit={LIMIT} total={data.total} onPage={setPage} />
      </StateBlock>
      {target && <AllocationModal target={target} types={types} year={year} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); setReload((n) => n + 1); }} />}
      {history && <History employee={history} onClose={() => setHistory(null)} />}
    </>
  );
};

// --------------------------------------------------------------------- types
const TypeModal = ({ type, onClose, onSaved }) => {
  const [f, setF] = useState({ name: type?.name || "", code: type?.code || "", description: type?.description || "", isPaid: !!type?.isPaid, requiresBalance: type ? !!type.requiresBalance : true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (ev) => {
    ev.preventDefault();
    if (f.name.trim().length < 2) return setError("Enter a name.");
    if (!type && !/^[A-Za-z0-9_-]{1,20}$/.test(f.code.trim())) return setError("Code must be 1–20 letters, numbers, - or _.");
    setSaving(true);
    setError("");
    try {
      if (type) await leaveApi.updateType(type.id, { name: f.name.trim(), description: f.description, isPaid: f.isPaid, requiresBalance: f.requiresBalance });
      else await leaveApi.createType({ name: f.name.trim(), code: f.code.trim(), description: f.description, isPaid: f.isPaid, requiresBalance: f.requiresBalance });
      onSaved();
    } catch (e) {
      setError(hrError(e, "Could not save the leave type."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={type ? "Edit leave type" : "New leave type"} onClose={onClose}>
      <form className="hr-form" onSubmit={submit} noValidate>
        <div className="hr-row">
          <label>Name<input name="name" value={f.name} onChange={set} maxLength={100} placeholder="Casual Leave" /></label>
          <label>Code<input name="code" value={f.code} onChange={set} maxLength={20} placeholder="CL" disabled={!!type} /></label>
        </div>
        <label>Description<input name="description" value={f.description} onChange={set} maxLength={500} /></label>
        <label style={{ flexDirection: "row", gap: 8 }}><input type="checkbox" name="isPaid" checked={f.isPaid} onChange={set} /> Paid leave (not deducted in payroll)</label>
        <label style={{ flexDirection: "row", gap: 8 }}><input type="checkbox" name="requiresBalance" checked={f.requiresBalance} onChange={set} /> Requires an allocated balance</label>
        {error && <div className="hr-error" role="alert">{error}</div>}
        <div className="hr-modal-actions">
          <button type="button" className="hr-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="hr-btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
};

const Types = ({ types, onChanged, error }) => {
  const [modal, setModal] = useState(null); // {type?}
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const toggle = async (t) => {
    setBusyId(t.id);
    setErr("");
    try {
      await leaveApi.updateType(t.id, { active: !t.active });
      onChanged();
    } catch (e) {
      setErr(hrError(e, "Could not update the leave type."));
    } finally {
      setBusyId(null);
    }
  };
  return (
    <>
      <div className="hr-toolbar"><button type="button" className="hr-btn" onClick={() => setModal({})}>+ New leave type</button></div>
      {(error || err) && <div className="hr-error" role="alert">{error || err}</div>}
      <div className="hr-table-wrap">
        <table className="hr-table">
          <thead><tr><th>Name</th><th>Code</th><th>Paid</th><th>Needs balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {types.length === 0 && <tr><td colSpan={6} className="hr-empty">No leave types yet. Create types such as CL, PL or SL, then allocate balances.</td></tr>}
            {types.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td><td>{t.code}</td><td>{t.isPaid ? "Yes" : "No"}</td><td>{t.requiresBalance ? "Yes" : "No"}</td>
                <td><span className={`hr-pill ${t.active ? "Approved" : "Cancelled"}`}>{t.active ? "Active" : "Inactive"}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="hr-link" onClick={() => setModal({ type: t })}>Edit</button>
                  <button type="button" className={`hr-link ${t.active ? "danger" : ""}`} disabled={busyId === t.id} onClick={() => toggle(t)}>{t.active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <TypeModal type={modal.type} onClose={() => setModal(null)} onSaved={() => { setModal(null); onChanged(); }} />}
    </>
  );
};

// ---------------------------------------------------------------------- page
const LeaveManagement = () => {
  const [tab, setTab] = useState("requests");
  const [types, setTypes] = useState([]);
  const [typesError, setTypesError] = useState("");
  const loadTypes = useCallback(async () => {
    try {
      setTypes(await leaveApi.types());
      setTypesError("");
    } catch (e) {
      setTypesError(hrError(e, "Could not load leave types."));
    }
  }, []);
  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>Leave Management</h1>
          <p>Define leave types, allocate balances manually, and review leave requests for every role.</p>
        </div>
      </div>
      <div className="hr-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="hr-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="hr-card">
        {tab === "requests" && <Requests types={types} />}
        {tab === "balances" && <Balances types={types} />}
        {tab === "types" && <Types types={types} onChanged={loadTypes} error={typesError} />}
        {tab === "mine" && <MyLeave />}
      </div>
    </div>
  );
};

export default LeaveManagement;

import React, { useCallback, useEffect, useState } from "react";
import SidebarToggle from "../admin/SidebarToggle";
import { PAYROLL_TYPES, currentMonth, hrError, money, payrollApi, typeLabel } from "../../services/hrService";
import { ConfirmModal, Modal, Pager, Stat, StateBlock, fmtDate, useDebounced } from "./hrUi";

const LIMIT = 10;
const today = () => new Date().toISOString().slice(0, 10);
const STATUS_LABEL = { processed: "Processed", pending: "Pending", "no-salary": "No salary" };

const SalaryModal = ({ employee, onClose, onSaved }) => {
  const [history, setHistory] = useState(null);
  const [f, setF] = useState({ grossSalary: employee.grossSalary ?? "", designation: employee.designation || "", effectiveFrom: today(), note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    payrollApi
      .salaryHistory(employee.employeeType, employee.employeeId)
      .then(setHistory)
      .catch((e) => setError(hrError(e, "Could not load salary history.")));
  }, [employee]);

  const set = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));
  const submit = async (ev) => {
    ev.preventDefault();
    const gross = Number(f.grossSalary);
    if (!gross || gross <= 0) return setError("Enter a salary greater than zero.");
    if (!f.effectiveFrom) return setError("Choose the date this salary takes effect.");
    setSaving(true);
    setError("");
    try {
      await payrollApi.saveSalary({
        employeeType: employee.employeeType,
        employeeId: employee.employeeId,
        grossSalary: gross,
        designation: f.designation,
        effectiveFrom: f.effectiveFrom,
        note: f.note,
      });
      onSaved();
    } catch (e) {
      setError(hrError(e, "Could not save the salary."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Salary — ${employee.name}`} onClose={onClose}>
      <form className="hr-form" onSubmit={submit} noValidate>
        <div className="hr-row">
          <label>Monthly gross salary<input name="grossSalary" type="number" min="0" step="0.01" value={f.grossSalary} onChange={set} /></label>
          <label>Effective from<input name="effectiveFrom" type="date" value={f.effectiveFrom} onChange={set} /></label>
        </div>
        <label>Designation<input name="designation" value={f.designation} onChange={set} maxLength={100} /></label>
        <label>Note<input name="note" value={f.note} onChange={set} maxLength={500} placeholder="e.g. annual revision" /></label>
        <span className="hr-help">Saving adds a new entry to the salary history; earlier entries are never overwritten.</span>
        {error && <div className="hr-error" role="alert">{error}</div>}
        <div className="hr-modal-actions">
          <button type="button" className="hr-btn ghost" onClick={onClose} disabled={saving}>Close</button>
          <button type="submit" className="hr-btn" disabled={saving}>{saving ? "Saving…" : "Save salary"}</button>
        </div>
      </form>
      <h3 style={{ marginTop: 18 }}>Salary history</h3>
      <StateBlock loading={!history && !error} empty={history && history.history.length === 0} emptyText="No salary recorded yet.">
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead><tr><th>Effective</th><th className="num">Gross</th><th>Designation</th><th>By</th><th>Note</th></tr></thead>
            <tbody>
              {(history?.history || []).map((h) => (
                <tr key={h.id}><td>{fmtDate(h.effectiveFrom)}</td><td className="num">{money(h.grossSalary)}</td><td>{h.designation || "—"}</td><td>{h.createdByName || h.createdByRole}</td><td>{h.note || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBlock>
      {history && history.payrolls.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Processed months</h3>
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead><tr><th>Month</th><th className="num">Gross</th><th className="num">Present / working</th><th className="num">Deductions</th><th className="num">Net</th></tr></thead>
              <tbody>
                {history.payrolls.map((p) => (
                  <tr key={p.id}><td>{p.month}</td><td className="num">{money(p.gross_salary)}</td><td className="num">{p.total_present_days} / {p.total_working_days}</td><td className="num">{money(p.deductions)}</td><td className="num">{money(p.net_salary)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
};

/** HR Payroll: salary records, monthly processing (duplicate-safe), filters, export. */
const PayrollSystem = () => {
  const [month, setMonth] = useState(currentMonth());
  const [filters, setFilters] = useState({ employeeType: "", status: "", q: "" });
  const q = useDebounced(filters.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [reload, setReload] = useState(0);
  const [salaryFor, setSalaryFor] = useState(null);
  const [confirm, setConfirm] = useState(null); // {reprocess}
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [exportError, setExportError] = useState("");

  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "" });
    payrollApi
      .overview({ month, employeeType: filters.employeeType, status: filters.status, q, page, limit: LIMIT })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState({ loading: false, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, error: hrError(e, "Could not load payroll.") }));
    return () => {
      alive = false;
    };
  }, [month, filters.employeeType, filters.status, q, page, reload]);

  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const runProcess = async () => {
    setBusy(true);
    try {
      const out = await payrollApi.process({ month, employeeType: filters.employeeType || undefined, reprocess: !!confirm.reprocess });
      setResult(out);
      setNotice(`${month}: ${out.created} created, ${out.updated} updated, ${out.skipped} skipped, ${out.failed} failed.`);
      setConfirm(null);
      load();
    } catch (e) {
      setNotice(hrError(e, "Payroll processing failed."));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setExportError("");
    try {
      await payrollApi.exportCsv({ month, employeeType: filters.employeeType, q });
    } catch (e) {
      setExportError(hrError(e, "Could not export payroll."));
    }
  };

  const s = data?.summary;
  const isFuture = month > currentMonth();

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>Payroll</h1>
          <p>Salary = gross − (absent days × per-day pay). Attendance, approved leave, joining date and holidays are applied automatically.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="hr-btn ghost" onClick={doExport}>Export CSV</button>
          <button type="button" className="hr-btn" disabled={isFuture || !s || s.pending === 0} onClick={() => setConfirm({ reprocess: false })}>
            Process {month}
          </button>
        </div>
      </div>
      {notice && <div className="hr-ok" role="status">{notice}</div>}
      {exportError && <div className="hr-error" role="alert">{exportError}</div>}

      <div className="hr-grid cols-4" style={{ marginBottom: 16 }}>
        <Stat testId="pay-employees" label="Employees" value={s ? s.employees : "—"} sub={s ? `${s.processed} processed · ${s.pending} pending` : ""} />
        <Stat label="Gross (processed)" value={s ? money(s.totalGross) : "—"} />
        <Stat label="Deductions" value={s ? money(s.totalDeductions) : "—"} />
        <Stat testId="pay-net" label="Net payable" value={s ? money(s.totalNet) : "—"} tone="ok" sub={s && s.noSalary ? `${s.noSalary} without a salary` : ""} />
      </div>

      <div className="hr-card">
        <div className="hr-toolbar">
          <input type="search" placeholder="Search employee" aria-label="Search employees" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
          <input type="month" aria-label="Payroll month" value={month} max={currentMonth()} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setPage(1); } }} />
          <select aria-label="Filter by role" value={filters.employeeType} onChange={(e) => setFilter("employeeType", e.target.value)}>
            <option value="">All roles</option>
            {PAYROLL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="processed">Processed</option>
            <option value="pending">Pending</option>
            <option value="no-salary">No salary</option>
          </select>
        </div>
        <StateBlock loading={state.loading && !data} error={state.error} onRetry={load}>
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Employee</th><th>Role</th><th className="num">Gross</th><th className="num">Present / working</th><th className="num">Deductions</th><th className="num">Net salary</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {data && data.employees.length === 0 && <tr><td colSpan={8} className="hr-empty">No employees match these filters.</td></tr>}
                {(data?.employees || []).map((e) => (
                  <tr key={`${e.employeeType}-${e.employeeId}`}>
                    <td><strong>{e.name}</strong><div className="hr-help">{e.designation}</div></td>
                    <td>{typeLabel(e.employeeType)}</td>
                    <td className="num">{e.payroll ? money(e.payroll.grossSalary) : e.grossSalary !== null ? money(e.grossSalary) : "—"}</td>
                    <td className="num">{e.payroll ? `${e.payroll.presentDays} / ${e.payroll.workingDays}` : "—"}</td>
                    <td className="num">{e.payroll ? money(e.payroll.deductions) : "—"}</td>
                    <td className="num">{e.payroll ? money(e.payroll.netSalary) : "—"}</td>
                    <td><span className={`hr-pill ${e.status}`}>{STATUS_LABEL[e.status]}</span></td>
                    <td><button type="button" className="hr-link" onClick={() => setSalaryFor(e)}>{e.grossSalary === null ? "Set salary" : "Salary & history"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} limit={LIMIT} total={data?.total || 0} onPage={setPage} />
        </StateBlock>
        {result && result.details.some((d) => d.outcome !== "created" && d.outcome !== "updated") && (
          <div className="hr-note" style={{ marginTop: 12 }}>
            <strong>Not processed:</strong>
            <ul className="hr-list">
              {result.details.filter((d) => d.outcome === "skipped" || d.outcome === "failed").map((d) => (
                <li key={`${d.employeeType}-${d.employeeId}`}><span>{d.name} — {d.reason || d.outcome}</span></li>
              ))}
            </ul>
          </div>
        )}
        {s && s.processed > 0 && (
          <p style={{ marginTop: 12 }}>
            <button type="button" className="hr-link danger" onClick={() => setConfirm({ reprocess: true })}>Reprocess already-processed payroll for {month}…</button>
          </p>
        )}
      </div>

      {salaryFor && <SalaryModal employee={salaryFor} onClose={() => setSalaryFor(null)} onSaved={() => { setSalaryFor(null); setNotice("Salary saved."); load(); }} />}
      {confirm && (
        <ConfirmModal
          title={confirm.reprocess ? `Reprocess ${month}?` : `Process payroll for ${month}?`}
          message={confirm.reprocess
            ? "This OVERWRITES the existing payroll records for this month using the latest attendance, leave and salary data."
            : "Payroll is calculated for every employee who has a salary and no payroll yet this month. Employees already processed are skipped, so nothing is duplicated."}
          confirmLabel={confirm.reprocess ? "Overwrite" : "Process"}
          danger={confirm.reprocess}
          busy={busy}
          onConfirm={runProcess}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default PayrollSystem;

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "../../styles/attendancetable.css";
import "../../styles/attendanceDashboard.css";
import SidebarToggle from "./SidebarToggle";
import {
  fetchAttendanceReport,
  correctAttendance,
  fetchAttendanceAudit,
  fetchHolidays,
  addHoliday,
  deleteHoliday,
  processPayroll,
} from "../../services/attendanceService";
import {
  ROLE_OPTIONS,
  ROLE_LABEL,
  STATUS_META,
  LEGEND_ORDER,
  monthBounds,
  rangeToMonth,
  formatDayHeader,
  validateFilterRange,
  validateCorrection,
  canCorrect,
  canProcessPayroll,
  PAYROLL_TYPES,
} from "./attendanceUtils";

const getCurrentRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.role || null;
  } catch {
    return null;
  }
};

const Badge = ({ status, corrected }) => {
  const meta = STATUS_META[status];
  if (!meta || !meta.label) return null;
  return (
    <span className={`ad-badge ad-${meta.cls}`} title={corrected ? "Manually corrected" : meta.legend}>
      {meta.label}
      {corrected && <span className="ad-dot" aria-label="corrected" />}
    </span>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="ad-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ad-modal-head">
        <h3>{title}</h3>
        <button className="ad-icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

/* ------------------------------ Correction ------------------------------ */
const CorrectionModal = ({ target, today, onClose, onDone }) => {
  const { employee, date, status, correction } = target;
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchAttendanceAudit({ employeeType: employee.employeeType, employeeId: employee.employeeId, startDate: date, endDate: date, limit: 20 })
      .then((r) => alive && setHistory(r.audit || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [employee, date]);

  const submit = async (chosen) => {
    const status2 = chosen || newStatus;
    const problem = validateCorrection({ status: status2, reason, date, today });
    if (problem) return setError(problem);
    setSaving(true);
    setError("");
    try {
      const res = await correctAttendance({ employeeType: employee.employeeType, employeeId: employee.employeeId, date, status: status2, reason: reason.trim() });
      onDone(res.message || "Attendance updated");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const options = ["Present", "Absent", "Leave"].filter((s) => s !== status);

  return (
    <Modal title="Correct attendance" onClose={onClose}>
      <p className="ad-muted">
        <strong>{employee.name}</strong> ({ROLE_LABEL[employee.employeeType]} #{employee.employeeId}) &middot; {dayjs(date).format("ddd, DD MMM YYYY")}
      </p>
      <p>
        Current status: <Badge status={status} corrected={!!correction} />
        {correction && <span className="ad-muted"> &mdash; corrected: "{correction.reason}"</span>}
      </p>
      <label className="ad-field">
        New status
        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
          <option value="">Select…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="ad-field">
        Reason (required, kept in the audit trail)
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <div className="ad-alert ad-alert-error">{error}</div>}
      <div className="ad-modal-actions">
        {correction && (
          <button className="ad-btn ad-btn-ghost" disabled={saving} onClick={() => submit("Auto")}>
            Remove correction
          </button>
        )}
        <button className="ad-btn ad-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="ad-btn ad-btn-primary" disabled={saving || !newStatus} onClick={() => submit()}>
          {saving ? "Saving…" : "Save correction"}
        </button>
      </div>
      {history.length > 0 && (
        <div className="ad-history">
          <h4>History for this day</h4>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <strong>{h.action}</strong> {h.previousStatus || "-"} → {h.newStatus || "-"} by {h.actorName || `#${h.actorId}`} ({h.actorRole}) on{" "}
                {dayjs(h.createdAt).format("DD MMM YYYY HH:mm")} &mdash; {h.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
};

/* ------------------------------- Holidays ------------------------------- */
const HolidayModal = ({ year, onClose, onChanged }) => {
  const [list, setList] = useState([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetchHolidays({ startDate: `${year}-01-01`, endDate: `${year}-12-31` });
      setList(r.holidays || []);
    } catch (e) {
      setError(e.message);
    }
  }, [year]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError("");
    try {
      await addHoliday({ date, name });
      setDate("");
      setName("");
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (id) => {
    setError("");
    try {
      await deleteHoliday(id);
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal title={`Company holidays ${year}`} onClose={onClose}>
      <div className="ad-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="text" placeholder="Holiday name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
        <button className="ad-btn ad-btn-primary" disabled={!date || name.trim().length < 2} onClick={add}>
          Add
        </button>
      </div>
      {error && <div className="ad-alert ad-alert-error">{error}</div>}
      {list.length === 0 ? (
        <p className="ad-muted">No holidays defined for {year}.</p>
      ) : (
        <ul className="ad-holiday-list">
          {list.map((h) => (
            <li key={h.id}>
              <span>
                {dayjs(h.holidayDate).format("ddd, DD MMM")} &mdash; {h.name}
              </span>
              <button className="ad-btn ad-btn-ghost" onClick={() => remove(h.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

/* -------------------------------- Payroll -------------------------------- */
const PayrollModal = ({ employee, period, onClose, onDone }) => {
  const [gross, setGross] = useState("");
  const [state, setState] = useState({ busy: false, error: "", duplicate: false });
  const s = employee.summary;

  const run = async (reprocess) => {
    const amount = Number(gross);
    if (!amount || amount <= 0) return setState({ busy: false, error: "Enter a gross salary greater than 0.", duplicate: false });
    setState({ busy: true, error: "", duplicate: false });
    try {
      const res = await processPayroll(employee.employeeType, {
        user_id: employee.employeeId,
        startDate: period.startDate,
        endDate: period.endDate,
        gross_salary: amount,
        ...(reprocess ? { reprocess: true } : {}),
      });
      onDone(res.message || "Payroll processed", res.payroll);
    } catch (e) {
      setState({ busy: false, error: e.message, duplicate: e.code === "PAYROLL_ALREADY_PROCESSED" });
    }
  };

  return (
    <Modal title="Confirm payroll processing" onClose={onClose}>
      <p>
        <strong>{employee.name}</strong> ({ROLE_LABEL[employee.employeeType]} #{employee.employeeId})
      </p>
      <p className="ad-muted">
        Period: {dayjs(period.startDate).format("DD MMM")} – {dayjs(period.endDate).format("DD MMM YYYY")}. Attendance so far: {s.present} present, {s.absent} absent, {s.leave} leave.
        Payroll counts non-Sunday days from the later of the period start and the joining date, up to today. Future days are not deducted; unpaid and approved leave days without attendance are deducted unless the leave type is configured as paid.
      </p>
      <label className="ad-field">
        Gross salary
        <input type="number" min="1" value={gross} onChange={(e) => setGross(e.target.value)} />
      </label>
      {state.error && <div className="ad-alert ad-alert-error">{state.error}</div>}
      <div className="ad-modal-actions">
        <button className="ad-btn ad-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {state.duplicate ? (
          <button className="ad-btn ad-btn-danger" disabled={state.busy} onClick={() => run(true)}>
            Reprocess &amp; overwrite
          </button>
        ) : (
          <button className="ad-btn ad-btn-primary" disabled={state.busy} onClick={() => run(false)}>
            {state.busy ? "Processing…" : "Confirm & process"}
          </button>
        )}
      </div>
    </Modal>
  );
};

/* ---------------------------------- Page --------------------------------- */
const AttendanceTable = () => {
  const role = getCurrentRole();
  const [view, setView] = useState("attendance");
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [roleFilter, setRoleFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [payrollFor, setPayrollFor] = useState(null);
  const [showHolidays, setShowHolidays] = useState(false);
  const reqId = useRef(0);

  const isSidebarExpanded = localStorage.getItem("adminSidebarExpanded") === "true";
  const month = rangeToMonth(startDate, endDate);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const problem = validateFilterRange(startDate, endDate);
    if (problem) {
      setError(problem);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAttendanceReport({ startDate, endDate, roles: roleFilter ? [roleFilter] : null, search });
      if (id === reqId.current) setReport(data);
    } catch (e) {
      if (id === reqId.current) {
        setReport(null);
        setError(e.message);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [startDate, endDate, roleFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const setMonth = (m) => {
    if (!m) return;
    const b = monthBounds(m);
    setStartDate(b.startDate);
    setEndDate(b.endDate);
  };

  const toggleView = () => {
    if (view === "attendance") {
      setMonth(startDate.slice(0, 7)); // payroll always runs on one calendar month
      setView("payroll");
    } else setView("attendance");
  };

  const flash = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 6000);
  };

  const employees = useMemo(() => {
    const list = report?.employees || [];
    return view === "payroll" ? list.filter((e) => PAYROLL_TYPES.includes(e.employeeType)) : list;
  }, [report, view]);

  const cards = report?.cards;

  return (
    <div className={`create-executive-container ${isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      <SidebarToggle />
      <div className="ad-page">
        <div className="ad-header">
          <div>
            <h2 className="ad-title">{view === "payroll" ? "Process Payroll" : "Attendance Management"}</h2>
            <p className="ad-muted">
              {view === "payroll"
                ? "Select an employee to process payroll for the chosen month using recorded attendance."
                : "Daily attendance for all employees, based on recorded activity, approved leave and admin corrections."}
            </p>
          </div>
          <div className="ad-header-actions">
            {canCorrect(role) && view === "attendance" && (
              <button className="ad-btn ad-btn-ghost" onClick={() => setShowHolidays(true)}>
                Manage holidays
              </button>
            )}
            {canProcessPayroll(role) && (
              <button className="ad-btn ad-btn-primary" onClick={toggleView}>
                {view === "payroll" ? "Back To Attendance" : "Process Payroll"}
              </button>
            )}
          </div>
        </div>

        {view === "attendance" && (
          <div className="ad-cards">
            <div className="ad-card">
              <span>Total Employees</span>
              <strong>{cards ? cards.totalEmployees : "–"}</strong>
            </div>
            <div className="ad-card ad-card-present">
              <span>Present Today</span>
              <strong>{cards ? cards.presentToday : "–"}</strong>
            </div>
            <div className="ad-card ad-card-absent">
              <span>Absent Today</span>
              <strong>{cards ? cards.absentToday : "–"}</strong>
            </div>
            <div className="ad-card ad-card-leave">
              <span>On Leave</span>
              <strong>{cards ? cards.onLeave : "–"}</strong>
            </div>
            <div className="ad-card">
              <span>Attendance % (range)</span>
              <strong>{cards ? `${cards.attendancePercentage}%` : "–"}</strong>
            </div>
          </div>
        )}

        <div className="ad-filters">
          <label>
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          {view === "attendance" && (
            <>
              <label>
                From
                <input type="date" value={startDate} max={endDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={endDate} min={startDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
              </label>
            </>
          )}
          <label>
            Role
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {ROLE_OPTIONS.filter((r) => view === "attendance" || !r.value || PAYROLL_TYPES.includes(r.value)).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-grow">
            Employee
            <input type="search" placeholder="Search by name, email or ID…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </label>
          <button className="ad-btn ad-btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {notice && <div className={`ad-alert ad-alert-${notice.type}`}>{notice.text}</div>}
        {error && <div className="ad-alert ad-alert-error">{error}</div>}

        {view === "attendance" ? (
          <>
            <div className="ad-legend" aria-label="Legend">
              {LEGEND_ORDER.map((s) => (
                <span key={s} className="ad-legend-item">
                  <Badge status={s} /> <small>{STATUS_META[s].legend.split(" - ")[1]}</small>
                </span>
              ))}
              <span className="ad-legend-item">
                <span className="ad-dot ad-dot-static" /> <small>Manually corrected</small>
              </span>
            </div>

            <div className="ad-table-scroll" tabIndex={0}>
              {loading && <div className="ad-overlay">Loading attendance…</div>}
              <table className="ad-table">
                <thead>
                  <tr>
                    <th className="ad-sticky ad-emp-col">Employee</th>
                    <th className="ad-sum-col" title="Present days">P</th>
                    <th className="ad-sum-col" title="Absent days">A</th>
                    <th className="ad-sum-col" title="Leave days">L</th>
                    <th className="ad-sum-col" title="Attendance % of working days">%</th>
                    {(report?.days || []).map((d) => {
                      const h = formatDayHeader(d.date);
                      return (
                        <th key={d.date} className={`ad-day ${d.isWeeklyOff ? "ad-off-col" : ""} ${d.holiday ? "ad-holiday-col" : ""} ${d.date === report.today ? "ad-today-col" : ""}`} title={d.holiday || ""}>
                          <div>{h.day}</div>
                          <small>{h.weekday}</small>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 && !loading && (
                    <tr>
                      <td className="ad-empty" colSpan={5 + (report?.days?.length || 0)}>
                        {report ? "No employees match the selected filters." : "No data."}
                      </td>
                    </tr>
                  )}
                  {employees.map((emp) => (
                    <tr key={emp.key}>
                      <td className="ad-sticky ad-emp-col">
                        <div className="ad-emp-name">{emp.name}</div>
                        <small>
                          ID {emp.employeeId} &middot; {ROLE_LABEL[emp.employeeType]}
                        </small>
                      </td>
                      <td className="ad-sum-col">{emp.summary.present}</td>
                      <td className="ad-sum-col">{emp.summary.absent}</td>
                      <td className="ad-sum-col">{emp.summary.leave}</td>
                      <td className="ad-sum-col">
                        <strong>{emp.summary.attendancePercentage}%</strong>
                      </td>
                      {report.days.map((d) => {
                        const status = emp.attendance[d.date];
                        const corr = emp.corrections[d.date];
                        const editable = canCorrect(role) && d.date <= report.today;
                        return (
                          <td
                            key={d.date}
                            className={`ad-cell ${d.isWeeklyOff ? "ad-off-col" : ""} ${editable ? "ad-editable" : ""}`}
                            onClick={editable ? () => setCorrection({ employee: emp, date: d.date, status, correction: corr }) : undefined}
                            title={editable ? "Click to correct" : ""}
                          >
                            <Badge status={status} corrected={!!corr} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="ad-table-scroll ad-payroll" tabIndex={0}>
            {loading && <div className="ad-overlay">Loading…</div>}
            <table className="ad-table">
              <thead>
                <tr>
                  <th className="ad-sticky ad-emp-col">Employee</th>
                  <th>Role</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Attendance %</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && !loading && (
                  <tr>
                    <td className="ad-empty" colSpan={7}>
                      No employees found for the selected filters.
                    </td>
                  </tr>
                )}
                {employees.map((emp) => (
                  <tr key={emp.key}>
                    <td className="ad-sticky ad-emp-col">
                      <div className="ad-emp-name">{emp.name}</div>
                      <small>ID {emp.employeeId}</small>
                    </td>
                    <td>{ROLE_LABEL[emp.employeeType]}</td>
                    <td>{emp.summary.present}</td>
                    <td>{emp.summary.absent}</td>
                    <td>{emp.summary.leave}</td>
                    <td>{emp.summary.attendancePercentage}%</td>
                    <td>
                      <button className="ad-btn ad-btn-primary" onClick={() => setPayrollFor(emp)}>
                        Process payroll
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {correction && (
        <CorrectionModal
          target={correction}
          today={report?.today}
          onClose={() => setCorrection(null)}
          onDone={(msg) => {
            setCorrection(null);
            flash("success", msg);
            load();
          }}
        />
      )}
      {payrollFor && (
        <PayrollModal
          employee={payrollFor}
          period={{ startDate, endDate }}
          onClose={() => setPayrollFor(null)}
          onDone={(msg) => {
            setPayrollFor(null);
            flash("success", msg);
          }}
        />
      )}
      {showHolidays && <HolidayModal year={startDate.slice(0, 4)} onClose={() => setShowHolidays(false)} onChanged={load} />}
    </div>
  );
};

export default AttendanceTable;

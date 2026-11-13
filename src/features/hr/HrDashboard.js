import React, { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SidebarToggle from "../admin/SidebarToggle";
import { getHrDashboard, hrError, money } from "../../services/hrService";
import { Stat, fmtDateTime } from "./hrUi";

const COLORS = ["#4f52bb", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

const Restricted = ({ what }) => (
  <div className="hr-note" role="note">{what} is not enabled for your account. Ask your administrator if you need it.</div>
);

/** HR Overview. Every figure comes from GET /api/hr-management/dashboard (tenant data only). */
const HrDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getHrDashboard());
      setError("");
    } catch (e) {
      setError(hrError(e, "Could not load the dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="hr-page" aria-busy="true" aria-label="Loading dashboard">
        <div className="hr-grid cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="hr-skeleton" />)}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="hr-page">
        <div className="hr-error" role="alert">{error} <button type="button" className="hr-link" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const { employees, attendance, leave, payroll, activities, restricted } = data;
  const att = attendance?.today;

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>HR Overview</h1>
          <p>Live workforce, attendance, leave and payroll figures for your organisation.</p>
        </div>
        <button type="button" className="hr-btn ghost" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      <div className="hr-grid cols-4">
        <Stat testId="stat-total" label="Total employees" value={employees.total} sub="Executives, TLs, Managers, HR, Process" />
        <Stat testId="stat-active" label="Active" value={employees.active} tone="ok" />
        <Stat testId="stat-inactive" label="Inactive" value={employees.inactive} tone={employees.inactive ? "warn" : ""} />
        {leave ? (
          <Stat testId="stat-pending-leave" label="Pending leave requests" value={leave.pending} tone={leave.pending ? "warn" : ""} sub={`${leave.onLeaveToday} on leave today`} />
        ) : (
          <Stat label="Pending leave requests" value="—" sub="Not enabled" />
        )}
      </div>

      <div className="hr-grid cols-4" style={{ marginTop: 16 }}>
        {att ? (
          <>
            <Stat testId="stat-present" label="Present today" value={att.present} tone="ok" sub={`${attendance.attendancePercentage}% attendance`} />
            <Stat testId="stat-absent" label="Absent today" value={att.absent} tone={att.absent ? "bad" : ""} />
            <Stat testId="stat-onleave" label="On leave today" value={att.onLeave} />
            <Stat testId="stat-notmarked" label="Not marked yet" value={att.notMarkedYet} sub={att.holidayOrOff ? `${att.holidayOrOff} on holiday / weekly off` : ""} />
          </>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}><Restricted what="Attendance" /></div>
        )}
      </div>

      <div className="hr-grid cols-2" style={{ marginTop: 16 }}>
        <div className="hr-card">
          <h3>Role-wise distribution</h3>
          {employees.byRole.length === 0 ? (
            <div className="hr-empty">No employees yet.</div>
          ) : (
            <div className="hr-chart" role="img" aria-label="Employees by role">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={employees.byRole} dataKey="total" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {employees.byRole.map((r, i) => <Cell key={r.role} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="hr-list" aria-label="Role counts">
            {employees.byRole.map((r) => (
              <li key={r.role}><strong>{r.label}</strong><span>{r.total} total · {r.active} active · {r.inactive} inactive</span></li>
            ))}
          </ul>
        </div>
        <div className="hr-card">
          <h3>Attendance — last 7 days</h3>
          {attendance ? (
            <div className="hr-chart" role="img" aria-label="Attendance trend">
              <ResponsiveContainer>
                <LineChart data={attendance.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekday" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" name="Present" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="absent" name="Absent" stroke="#dc2626" strokeWidth={2} />
                  <Line type="monotone" dataKey="onLeave" name="On leave" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Restricted what="Attendance" />
          )}
        </div>
      </div>

      <div className="hr-grid cols-2" style={{ marginTop: 16 }}>
        <div className="hr-card">
          <h3>Payroll{payroll ? ` — ${payroll.month}` : ""}</h3>
          {payroll ? (
            <>
              <div className="hr-grid cols-4" style={{ marginBottom: 12 }}>
                <Stat testId="stat-pay-net" label="Net payable" value={money(payroll.totalNet)} sub={`${payroll.processed} of ${payroll.employees} processed`} />
                <Stat label="Gross" value={money(payroll.totalGross)} />
                <Stat label="Deductions" value={money(payroll.totalDeductions)} />
                <Stat label="Pending" value={payroll.pending} tone={payroll.pending ? "warn" : ""} sub={payroll.noSalary ? `${payroll.noSalary} without a salary` : ""} />
              </div>
              {payroll.trend.length === 0 ? (
                <div className="hr-empty">No payroll has been processed yet.</div>
              ) : (
                <div className="hr-chart" role="img" aria-label="Monthly payroll">
                  <ResponsiveContainer>
                    <BarChart data={payroll.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
                      <Bar dataKey="net" name="Net" fill="#4f52bb" />
                      <Bar dataKey="deductions" name="Deductions" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <Restricted what="Payroll" />
          )}
        </div>
        <div className="hr-card">
          <h3>Recent HR activity</h3>
          {activities.length === 0 ? (
            <div className="hr-empty">Nothing has happened yet.</div>
          ) : (
            <ul className="hr-list">
              {activities.map((a, i) => (
                <li key={`${a.type}-${i}`}><time>{fmtDateTime(a.at)}</time><span>{a.text}</span></li>
              ))}
            </ul>
          )}
          {restricted.leave || restricted.payroll ? (
            <p className="hr-stat-sub">Leave and salary activity is only shown if those pages are enabled for you.</p>
          ) : null}
        </div>
      </div>

      {leave && leave.latestPending.length > 0 && (
        <div className="hr-card" style={{ marginTop: 16 }}>
          <h3>Latest pending leave requests</h3>
          <ul className="hr-list">
            {leave.latestPending.map((l) => (
              <li key={l.id}>
                <span><strong>{l.fullName}</strong> ({l.role}) — {l.leaveType}, {l.startDate} to {l.endDate} ({l.workingDays} working day{l.workingDays === 1 ? "" : "s"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SidebarToggle from "../admin/SidebarToggle";
import { Stat, fmtDate, fmtDateTime } from "../hr/hrUi";
import { PRIORITIES, STATUSES, fmtDuration, getManagerDashboard, labelOf, managerError } from "../../services/managerTaskService";
import "../../styles/hr.css";
import "../../styles/managerPanel.css";

const COLORS = ["#4f52bb", "#0ea5e9", "#14b8a6", "#f59e0b", "#10b981", "#ef4444"];

/** Manager Overview. Every figure comes from GET /api/manager-tasks/dashboard (the manager's own team only). */
const ManagerDashboard = ({ canSeeTasks = true }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getManagerDashboard());
      setError("");
    } catch (e) {
      setError(managerError(e, "Could not load the dashboard."));
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

  const { team, work, funnel, leads, meetings, tasks, performance, topTasks } = data;
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const workChart = work.today.map((w) => ({ name: w.name, Work: +(w.workSeconds / 3600).toFixed(2), Break: +(w.breakSeconds / 3600).toFixed(2) }));
  const taskPie = [
    { name: "To do", value: tasks.todo },
    { name: "In progress", value: tasks.inProgress },
    { name: "Completed", value: tasks.completed },
  ].filter((x) => x.value > 0);

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>Manager Overview</h1>
          <p>Live figures for your team{team.teams.length ? `: ${team.teams.map((t) => t.name).join(", ")}` : ""}.</p>
        </div>
        <button type="button" className="hr-btn ghost" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      {team.size === 0 && (
        <div className="hr-note" role="note" data-testid="no-team" style={{ marginBottom: 16 }}>
          No team members are assigned to you yet. Once your administrator adds Executives to your team, their work, leads and tasks appear here.
        </div>
      )}

      <div className="hr-grid cols-4">
        <Stat testId="stat-team" label="Team members" value={team.size} sub={`${team.active} can log in`} />
        <Stat testId="stat-online" label="Online now" value={team.online} tone="ok" />
        <Stat testId="stat-leads" label="Leads in team" value={leads.total} sub={`${meetings.today} meeting${meetings.today === 1 ? "" : "s"} today`} />
        <Stat testId="stat-overdue" label="Overdue tasks" value={tasks.overdue} tone={tasks.overdue ? "bad" : ""} sub={`${tasks.dueToday} due today`} />
      </div>
      <div className="hr-grid cols-4" style={{ marginTop: 16 }}>
        <Stat testId="stat-work" label="Team work time today" value={fmtDuration(work.totalWorkSeconds)} />
        <Stat testId="stat-break" label="Team break time today" value={fmtDuration(work.totalBreakSeconds)} />
        <Stat testId="stat-open" label="Open tasks" value={tasks.todo + tasks.inProgress} sub={`${tasks.completionRate}% completed overall`} />
        <Stat testId="stat-done" label="Completed tasks" value={tasks.completed} tone="ok" />
      </div>

      <div className="hr-grid cols-2" style={{ marginTop: 16 }}>
        <div className="hr-card">
          <h3>Lead funnel (team)</h3>
          {leads.total === 0 ? (
            <div className="hr-empty">No leads are assigned to your team yet.</div>
          ) : (
            <div className="mgr-funnel" role="img" aria-label="Lead funnel">
              {funnel.map((f, i) => (
                <div className="mgr-funnel-row" key={f.stage}>
                  <span>{f.stage}</span>
                  <div className="hr-bar"><span style={{ width: `${(f.count / maxFunnel) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                  <strong>{f.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hr-card">
          <h3>Work and break time today (hours)</h3>
          {workChart.length === 0 ? (
            <div className="hr-empty">No team members yet.</div>
          ) : (
            <div className="hr-chart" role="img" aria-label="Work and break time per member">
              <ResponsiveContainer>
                <BarChart data={workChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Work" fill="#4f52bb" />
                  <Bar dataKey="Break" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="hr-card" style={{ marginTop: 16 }}>
        <h3>Team performance</h3>
        {performance.length === 0 ? (
          <div className="hr-empty">No team members yet.</div>
        ) : (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Member</th><th>Status</th><th className="num">Work</th><th className="num">Break</th><th className="num">Leads</th><th className="num">Follow-up</th><th className="num">Closed</th><th className="num">Tasks open</th><th className="num">Done</th><th className="num">Overdue</th></tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><div className="mgr-task-desc">{p.teamName}</div></td>
                    <td>{p.onBreak ? <span className="mgr-pill break">On break</span> : p.online ? <span className="mgr-pill online">Online</span> : <span className="mgr-pill">Offline</span>}</td>
                    <td className="num">{fmtDuration(p.workSeconds)}</td>
                    <td className="num">{fmtDuration(p.breakSeconds)}</td>
                    <td className="num">{p.leadsAssigned}</td>
                    <td className="num">{p.leadsInFollowUp}</td>
                    <td className="num">{p.leadsClosed}</td>
                    <td className="num">{p.tasksOpen}</td>
                    <td className="num">{p.tasksCompleted}</td>
                    <td className="num">{p.tasksOverdue ? <span className="mgr-pill overdue">{p.tasksOverdue}</span> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hr-grid cols-2" style={{ marginTop: 16 }}>
        <div className="hr-card">
          <h3>Tasks {canSeeTasks && <Link to="/manager/teams" className="hr-link">Manage</Link>}</h3>
          {tasks.total === 0 ? (
            <div className="hr-empty">No tasks yet.</div>
          ) : (
            <div className="hr-chart" role="img" aria-label="Tasks by status">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={taskPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {taskPie.map((_, i) => <Cell key={i} fill={["#9ca3af", "#4f52bb", "#10b981"][["To do", "In progress", "Completed"].indexOf(taskPie[i].name)]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {topTasks.length > 0 && (
            <ul className="hr-list" aria-label="Next tasks due">
              {topTasks.map((t) => (
                <li key={t.id}>
                  <time>{fmtDate(t.dueDate)}</time>
                  <span><strong>{t.title}</strong> — {t.assigneeName} <span className={`mgr-pill ${t.priority}`}>{labelOf(PRIORITIES, t.priority)}</span> <span className={`mgr-pill ${t.status}`}>{labelOf(STATUSES, t.status)}</span>{t.overdue ? <span className="mgr-pill overdue">Overdue</span> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hr-card">
          <h3>Upcoming meetings</h3>
          {meetings.upcoming.length === 0 ? (
            <div className="hr-empty">No upcoming meetings for your team.</div>
          ) : (
            <ul className="hr-list">
              {meetings.upcoming.map((m) => (
                <li key={m.id}><time>{fmtDateTime(m.startTime)}</time><span><strong>{m.clientName}</strong>{m.executiveName ? ` with ${m.executiveName}` : ""}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;

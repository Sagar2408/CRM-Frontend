import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { masterAdmin, errorMessage, fmtDate, fmtDateTime, SUBSCRIPTION_LABELS } from "../../../services/masterAdminService";
import "../../../styles/masterCenter.css";

const KPI_DEFS = [
  ["totalCompanies", "Total Companies"],
  ["activeCompanies", "Active Companies"],
  ["inactiveCompanies", "Inactive Companies", "danger"],
  ["trialCompanies", "Trial Companies"],
  ["expiringSubscriptions", "Expiring Subscriptions", "warn"],
  ["totalCompanyAdmins", "Total Company Admins"],
  ["openSupportTickets", "Open Support Tickets", "warn"],
  ["recentlyRegistered", "Recently Registered (30d)"],
];
const PIE_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ef4444", "#9ca3af", "#cbd5e1"];

export const actionLabel = (a) => String(a || "").replace(/[._]/g, " ");

const Skeleton = () => (
  <div aria-busy="true" aria-label="Loading dashboard">
    {[0, 1, 2, 3].map((i) => <div key={i} className="mc-skel" />)}
  </div>
);

const ControlCenterDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await masterAdmin.dashboard());
    } catch (e) {
      setError(errorMessage(e, "Could not load the dashboard."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="mc-card">
        <p className="mc-error" role="alert">{error}</p>
        <button type="button" className="mc-btn" onClick={load}>Retry</button>
      </div>
    );
  }
  if (!data) return <Skeleton />;
  const { kpis, registrationTrend, subscriptionDistribution, upcomingExpiries, recentCompanies, recentActivity } = data;
  const pie = subscriptionDistribution.byStatus.filter((s) => s.count > 0).map((s) => ({ name: SUBSCRIPTION_LABELS[s.status], value: s.count }));

  return (
    <div>
      <div className="mc-head">
        <div>
          <h1 className="mc-title">Dashboard</h1>
          <p className="mc-sub">Overview of every company on the platform.</p>
        </div>
        <div className="mc-quick" aria-label="Quick actions">
          <button type="button" className="mc-btn primary" onClick={() => navigate("/master/companies?add=1")}>+ Add company</button>
          <button type="button" className="mc-btn" onClick={() => navigate("/master/promotions?new=1")}>New promotion</button>
          <button type="button" className="mc-btn" onClick={() => navigate("/master/support")}>Support queue</button>
        </div>
      </div>

      <section className="mc-kpis" aria-label="Key metrics">
        {KPI_DEFS.map(([key, label, tone]) => (
          <div key={key} className={`mc-kpi ${tone || ""}`} data-testid={`kpi-${key}`}>
            <div className="mc-kpi-label">{label}</div>
            <div className="mc-kpi-value">{kpis[key]}</div>
          </div>
        ))}
      </section>

      <div className="mc-grid">
        <section className="mc-card">
          <h2>Company registrations (12 months)</h2>
          <div className="mc-chart">
            <ResponsiveContainer>
              <BarChart data={registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Bar dataKey="count" name="Companies" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="mc-card">
          <h2>Subscription distribution</h2>
          {pie.length === 0 ? (
            <p className="mc-empty">No companies yet.</p>
          ) : (
            <div className="mc-chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label>
                    {pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mc-muted">By plan: {subscriptionDistribution.byPlan.map((p) => `${p.plan} ${p.count}`).join(" · ") || "—"}</p>
        </section>
      </div>

      <div className="mc-grid">
        <section className="mc-card">
          <h2>Upcoming subscription expiries</h2>
          {upcomingExpiries.length === 0 ? (
            <p className="mc-empty">Nothing expires in the next 30 days.</p>
          ) : (
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead><tr><th>Company</th><th>Plan</th><th>Expires</th><th>Days left</th></tr></thead>
                <tbody>
                  {upcomingExpiries.map((c) => (
                    <tr key={c.id}>
                      <td><Link className="mc-link" to={`/master/companies/${c.id}`}>{c.name}</Link></td>
                      <td>{c.plan || "—"}</td>
                      <td>{fmtDate(c.expiryDate)}</td>
                      <td>{c.daysLeft}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="mc-card">
          <h2>Recent company registrations</h2>
          {recentCompanies.length === 0 ? (
            <p className="mc-empty">No companies registered yet.</p>
          ) : (
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead><tr><th>Company</th><th>Code</th><th>Plan</th><th>Registered</th></tr></thead>
                <tbody>
                  {recentCompanies.map((c) => (
                    <tr key={c.id}>
                      <td><Link className="mc-link" to={`/master/companies/${c.id}`}>{c.name}</Link></td>
                      <td>{c.code}</td>
                      <td>{c.plan || "—"}</td>
                      <td>{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mc-card">
        <h2>Recent master admin activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mc-empty">No activity recorded yet.</p>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>When</th><th>Action</th><th>By</th><th>Entity</th></tr></thead>
              <tbody>
                {recentActivity.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.createdAt)}</td>
                    <td>{actionLabel(a.action)}</td>
                    <td>{a.actorEmail || "—"}</td>
                    <td>{a.entityType}{a.details?.title ? ` · ${a.details.title}` : a.details?.name ? ` · ${a.details.name}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ControlCenterDashboard;

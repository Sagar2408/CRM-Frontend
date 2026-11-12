import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { teamApi, teamErrorMessage } from "../../services/teamManagementApi";
import { barWidth, pct, STATUS_LABEL } from "./teamUtils";

const COLORS = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#64748b"];
const CHART_METRICS = [
  { key: "assigned", label: "Leads assigned" },
  { key: "followUps", label: "Follow-ups" },
  { key: "converted", label: "Converted" },
  { key: "closed", label: "Closed" },
  { key: "meetings", label: "Meetings" },
];

/** Select several teams and compare them over the page's date range. */
const TeamComparison = ({ teams, range }) => {
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await teamApi.compare(selected, range));
    } catch (e) {
      setError(teamErrorMessage(e, "Could not compare these teams."));
    } finally {
      setBusy(false);
    }
  };

  const chartData = result ? CHART_METRICS.map((m) => ({ metric: m.label, ...Object.fromEntries(result.teams.map((t) => [t.name, t.stats[m.key]])) })) : [];

  return (
    <section className="tm-panel" aria-label="Team comparison">
      <h2>Team comparison</h2>
      <p className="tm-muted">Pick two or more teams (up to 8). Figures use real CRM records for each member while they were on the team, within the date range above.</p>
      <div className="tm-chips">
        {teams.length === 0 && <span className="tm-muted">Create teams to compare them.</span>}
        {teams.map((t) => (
          <label key={t.id} className={`tm-chip ${selected.includes(t.id) ? "on" : ""}`}>
            <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} aria-label={`Compare ${t.name}`} />
            {t.name}
            {t.status === "archived" && <em> (archived)</em>}
          </label>
        ))}
      </div>
      <button type="button" className="tm-btn primary" disabled={selected.length < 2 || busy} onClick={run}>
        {busy ? "Comparing…" : `Compare ${selected.length || ""} teams`}
      </button>
      {error && (
        <div className="tm-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="tm-table-wrap">
            <table className="tm-table" aria-label="Ranking">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Goal</th>
                  <th>Goal achievement</th>
                  <th>Assigned</th>
                  <th>Conversion rate</th>
                  <th>Follow-ups</th>
                  <th>Meetings</th>
                </tr>
              </thead>
              <tbody>
                {result.teams.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="tm-rank">#{t.rank}</span>
                    </td>
                    <td>
                      {t.name} <span className={`tm-pill ${t.status}`}>{STATUS_LABEL[t.status]}</span>
                    </td>
                    <td>
                      {t.goal.metricLabel}: {t.goal.achieved}/{t.goal.target}
                    </td>
                    <td>
                      <div className="tm-mini-bar wide">
                        <span style={{ width: barWidth(t.goal.percent) }} />
                        <em>{pct(t.goal.percent)}</em>
                      </div>
                    </td>
                    <td>{t.stats.assigned}</td>
                    <td>{t.conversionRate === null ? "—" : pct(t.conversionRate)}</td>
                    <td>{t.stats.followUps}</td>
                    <td>{t.stats.meetings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tm-chart" aria-label="Comparison chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {result.teams.map((t, i) => (
                  <Bar key={t.id} dataKey={t.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3>Individual contributions</h3>
          <div className="tm-contrib-grid">
            {result.teams.map((t) => (
              <div key={t.id} className="tm-contrib">
                <strong>{t.name}</strong>
                {t.members.filter((m) => m.tracked).length === 0 && <p className="tm-muted">No members with tracked lead activity.</p>}
                {t.members
                  .filter((m) => m.tracked)
                  .map((m) => (
                    <div key={m.key} className="tm-contrib-row">
                      <span>
                        {m.name}
                        {!m.current && <em> (former)</em>}
                      </span>
                      <div className="tm-mini-bar">
                        <span style={{ width: barWidth(m.contributionPct) }} />
                        <em>{m.metrics[t.goalMetric]} · {pct(m.contributionPct)}</em>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default TeamComparison;

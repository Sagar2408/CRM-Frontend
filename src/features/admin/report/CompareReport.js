import React, { useMemo, useState } from "react";
import { FaBalanceScale } from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useApi } from "../../../context/ApiContext";
import ExecutivePicker from "./ExecutivePicker";
import RangeFilter from "./RangeFilter";
import {
  METRICS, rangeFor, rangeError, rangeParams, summarize, conversionRate, buildInsights, secondsToHours, toISODate,
} from "./reportUtils";

const MAX = 5;
// Fixed, colour-blind-friendly series colours (one per selected executive).
export const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const CompareReport = ({ executives }) => {
  const { fetchExecutiveReport, fetchExecutiveActivityRange } = useApi();
  const [picks, setPicks] = useState([]);
  const [range, setRange] = useState({ preset: "month", from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { entries, failed, periodLabel }

  const effective = useMemo(() => rangeFor(range.preset, range), [range]);
  const rangeProblem = rangeError(effective);
  const canRun = picks.length >= 2 && !rangeProblem && !loading;

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setError("");
    const { startDate, endDate } = effective;
    const params = rangeParams(effective);
    // Attendance needs concrete bounds: "all time" = from the beginning until today.
    const actStart = startDate || "1970-01-01";
    const actEnd = endDate || toISODate(new Date());
    try {
      const settled = await Promise.allSettled(
        picks.map(async (ex) => {
          const [report, activity] = await Promise.all([
            fetchExecutiveReport(ex.username, params),
            fetchExecutiveActivityRange(ex.id, actStart, actEnd).catch(() => null), // attendance is optional
          ]);
          const counts = summarize(report);
          const days = Array.isArray(activity) ? activity : null;
          return {
            name: ex.username,
            counts,
            rate: conversionRate(counts),
            workHours: days ? secondsToHours(days.reduce((s, d) => s + (d.workTime || 0), 0)) : null,
            breakHours: days ? secondsToHours(days.reduce((s, d) => s + (d.breakTime || 0), 0)) : null,
          };
        })
      );
      const entries = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
      const failed = picks.filter((_, i) => settled[i].status === "rejected").map((p) => p.username);
      if (entries.length === 0) {
        setResult(null);
        setError("Could not load the comparison. Please try again.");
      } else {
        const label = startDate || endDate ? `${startDate || "beginning"} → ${endDate || "today"}` : "All time";
        setResult({ entries, failed, periodLabel: label });
      }
    } catch (err) {
      console.error("Comparison error:", err);
      setResult(null);
      setError("Could not load the comparison. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const entries = useMemo(() => result?.entries || [], [result]);
  const chartData = METRICS.map((m) => {
    const row = { name: m.short };
    entries.forEach((e, i) => {
      row[`s${i}`] = e.counts[m.key];
    });
    return row;
  });
  const hasAttendance = entries.some((e) => e.workHours != null);
  const attendanceData = entries
    .filter((e) => e.workHours != null)
    .map((e) => ({ name: e.name, Work: e.workHours, Break: e.breakHours }));
  const attendanceEmpty = attendanceData.every((d) => !d.Work && !d.Break);
  const insights = useMemo(() => buildInsights(entries), [entries]);

  // Highlight the best value of a metric among the compared executives (only when > 0).
  const bestOf = (key) => Math.max(...entries.map((e) => e.counts[key]), 0);

  return (
    <div className="rp-section">
      <div className="rp-toolbar">
        <ExecutivePicker label="Executives to compare" mode="multi" max={MAX} executives={executives} value={picks} onChange={setPicks} />
        <RangeFilter value={range} onChange={setRange} />
        <button type="button" className="rp-primary" onClick={run} disabled={!canRun}>
          {loading ? "Comparing…" : "Compare"}
        </button>
      </div>
      {picks.length < 2 && !result && (
        <p className="rp-help">Pick at least 2 executives (up to {MAX}), choose a period and press Compare.</p>
      )}
      {rangeProblem && <div className="ad-state ad-state-error" role="alert">{rangeProblem}</div>}

      {loading ? (
        <div className="ad-state" role="status">Loading comparison…</div>
      ) : error ? (
        <div className="rp-error" role="alert">{error}</div>
      ) : !result ? (
        <div className="rp-empty">
          <FaBalanceScale size={42} aria-hidden="true" />
          <h3>Compare executives side by side</h3>
          <p>Leads, follow-ups, conversions and meetings for the same period.</p>
        </div>
      ) : (
        <>
          {result.failed.length > 0 && (
            <div className="rp-warning" role="alert">Could not load: {result.failed.join(", ")}. Showing the rest.</div>
          )}
          <p className="rp-period">Period: <strong>{result.periodLabel}</strong></p>

          <div className="rp-compare-grid">
            {entries.map((e, i) => (
              <section key={e.name} className="rp-compare-card" style={{ borderTopColor: SERIES_COLORS[i] }}>
                <h3>{e.name}</h3>
                <dl>
                  {METRICS.map((m) => (
                    <div key={m.key} className={e.counts[m.key] > 0 && e.counts[m.key] === bestOf(m.key) && entries.length > 1 ? "is-best" : ""}>
                      <dt>{m.label}</dt>
                      <dd>{e.counts[m.key]}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Conversion rate</dt>
                    <dd>{e.rate == null ? "—" : `${e.rate}%`}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>

          <section className="ad-panel">
            <header className="ad-panel-head">
              <div>
                <h2 className="ad-panel-title">Performance Comparison</h2>
                <p className="ad-panel-sub">Number of leads per category</p>
              </div>
            </header>
            <div className="rp-chart" role="img" aria-label="Grouped bar chart comparing executives">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" interval={0} tickMargin={8} />
                  <YAxis allowDecimals={false} width={44} />
                  <Tooltip cursor={{ fillOpacity: 0.08 }} />
                  <Legend verticalAlign="bottom" height={36} />
                  {entries.map((e, i) => (
                    <Bar key={e.name} dataKey={`s${i}`} name={e.name} fill={SERIES_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {insights.length > 0 && (
            <section className="ad-panel">
              <header className="ad-panel-head"><h2 className="ad-panel-title">Insights</h2></header>
              <ul className="rp-insights">
                {insights.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          )}

          {hasAttendance && (
            <section className="ad-panel">
              <header className="ad-panel-head">
                <div>
                  <h2 className="ad-panel-title">Work &amp; Break Time</h2>
                  <p className="ad-panel-sub">Logged work and break sessions for the period (hours)</p>
                </div>
              </header>
              {attendanceEmpty ? (
                <div className="ad-state">No work or break time was logged in this period.</div>
              ) : (
                <div className="rp-chart" role="img" aria-label="Bar chart of work and break hours">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attendanceData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" interval={0} tickMargin={8} />
                      <YAxis allowDecimals tickFormatter={(v) => `${v}h`} width={52} />
                      <Tooltip formatter={(v) => `${v} h`} cursor={{ fillOpacity: 0.08 }} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Bar dataKey="Work" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Break" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default CompareReport;

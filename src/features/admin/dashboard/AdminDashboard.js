import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import "chart.js/auto";
import {
  FaUsers,
  FaUserPlus,
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaUserTie,
} from "react-icons/fa";
import { useApi } from "../../../context/ApiContext";
import Panel from "./Panel";
import ExecutivePerformance from "./ExecutivePerformance";
import ProcessPersonPerformance from "./ProcessPersonPerformance";
import MeetingsActivity from "./MeetingsActivity";
import EmployeeLiveStatus from "./EmployeeLiveStatus";
import "../../../styles/adminDashboard.css";

// ClientLead.status -> label + colour for the distribution chart.
export const STATUS_SLICES = [
  { key: "New", label: "New", color: "#3b82f6" },
  { key: "Assigned", label: "Assigned to executive", color: "#8b5cf6" },
  { key: "Follow-Up", label: "Follow-up", color: "#f59e0b" },
  { key: "Meeting", label: "Meeting scheduled", color: "#14b8a6" },
  { key: "Converted", label: "Converted", color: "#10b981" },
  { key: "Closed", label: "Closed", color: "#6b7280" },
  { key: "Rejected", label: "Rejected", color: "#ef4444" },
];

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Preset -> { startDate, endDate } (empty = no date filter).
export const rangeFor = (preset, custom) => {
  const today = new Date();
  if (preset === "7" || preset === "30") {
    const start = new Date(today);
    start.setDate(today.getDate() - (Number(preset) - 1));
    return { startDate: toISO(start), endDate: toISO(today) };
  }
  if (preset === "custom") {
    return { startDate: custom.from || "", endDate: custom.to || "" };
  }
  return { startDate: "", endDate: "" };
};

const AdminDashboard = () => {
  const { fetchLeadPerformance, fetchExecutivesAPI } = useApi();

  const [perf, setPerf] = useState({ data: null, loading: true, error: "" });
  const [executives, setExecutives] = useState([]);

  const [executiveId, setExecutiveId] = useState("");
  const [preset, setPreset] = useState("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const { startDate, endDate } = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeadPerformance();
        if (!cancelled) setPerf({ data, loading: false, error: "" });
      } catch (err) {
        console.error("Lead performance error:", err);
        if (!cancelled) setPerf({ data: null, loading: false, error: "Could not load lead data." });
      }
    })();
    (async () => {
      try {
        const list = await fetchExecutivesAPI();
        if (!cancelled) setExecutives(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Executives error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLeadPerformance, fetchExecutivesAPI]);

  const by = perf.data?.byStatus || {};
  const total = perf.data?.total || 0;
  const kpis = [
    { label: "Total Leads", value: total, icon: <FaUsers />, tone: "blue" },
    { label: "New Leads", value: by["New"] || 0, icon: <FaUserPlus />, tone: "indigo" },
    { label: "Follow-up Leads", value: by["Follow-Up"] || 0, icon: <FaClipboardCheck />, tone: "amber" },
    { label: "Converted Leads", value: by["Converted"] || 0, icon: <FaCheckCircle />, tone: "green" },
    { label: "Closed Leads", value: by["Closed"] || 0, icon: <FaTimesCircle />, tone: "gray" },
    { label: "Process Person Assigned", value: perf.data?.assignedToProcessPersons || 0, icon: <FaUserTie />, tone: "teal" },
  ];

  const slices = STATUS_SLICES.filter((s) => (by[s.key] || 0) > 0);
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const chartData = {
    labels: slices.map((s) => s.label),
    datasets: [
      {
        data: slices.map((s) => by[s.key]),
        backgroundColor: slices.map((s) => s.color),
        borderWidth: 0,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw} (${pct(c.raw)}%)` } },
    },
  };

  const filters = (
    <div className="ad-filters">
      <label>
        <span>Executive</span>
        <select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)} aria-label="Executive">
          <option value="">All executives</option>
          {executives.map((e) => (
            <option key={e.id} value={e.id}>
              {e.username}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Assigned in</span>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Date range">
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      {preset === "custom" && (
        <>
          <label>
            <span>From</span>
            <input type="date" value={custom.from} max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From date" />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={custom.to} min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To date" />
          </label>
        </>
      )}
    </div>
  );

  return (
    <div className="ad-dashboard">
      {/* A. KPI cards */}
      {perf.error ? (
        <div className="ad-state ad-state-error ad-kpi-error" role="alert">{perf.error}</div>
      ) : (
        <div className="ad-kpis">
          {kpis.map((k) => (
            <div key={k.label} className={`ad-kpi ad-tone-${k.tone}`}>
              <span className="ad-kpi-icon">{k.icon}</span>
              <div>
                <div className="ad-kpi-value">{perf.loading ? "…" : k.value}</div>
                <div className="ad-kpi-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ad-grid">
        {/* B. Lead status distribution */}
        <Panel
          title="Lead Status Distribution"
          subtitle="Share of all leads by current status"
          loading={perf.loading}
          error={perf.error}
          empty={!perf.loading && slices.length === 0}
          emptyText="No leads yet."
        >
          <div className="ld-dist">
            <div className="ld-chart">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="ld-center">
                <strong>{total}</strong>
                <span>leads</span>
              </div>
            </div>
            <ul className="ld-legend">
              {slices.map((s) => (
                <li key={s.key}>
                  <span className="ld-dot" style={{ background: s.color }} />
                  <span className="ld-label" title={s.label}>{s.label}</span>
                  <span className="ld-count">{by[s.key]}</span>
                  <span className="ld-pct">{pct(by[s.key])}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {/* E. Meetings & activity */}
        <MeetingsActivity executives={executives} />

        {/* F. Employee live status (real socket presence) */}
        <div className="ad-span-3">
          <EmployeeLiveStatus />
        </div>

        {/* Filters apply to C and D */}
        <div className="ad-filter-bar ad-span-3">
          <h2 className="ad-filter-title">Team performance</h2>
          {filters}
        </div>

        {/* C. Executive performance */}
        <ExecutivePerformance executiveId={executiveId} startDate={startDate} endDate={endDate} />

        {/* D. Process person performance */}
        <ProcessPersonPerformance startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
};

export default AdminDashboard;

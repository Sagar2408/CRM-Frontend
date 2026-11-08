import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaUserPlus, FaClipboardCheck, FaUsers, FaTimesCircle, FaCalendarCheck, FaEye, FaTimes, FaUserCircle } from "react-icons/fa";
import { useApi } from "../../../context/ApiContext";
import { exportToExcel, exportToCSV, exportToPDF } from "../../../utils/exportUtils";
import ExecutivePicker from "./ExecutivePicker";
import RangeFilter from "./RangeFilter";
import {
  METRICS, COLUMNS, rangeFor, rangeError, rangeParams, summarize, rowsFor, exportRows, fmtDateTime,
} from "./reportUtils";

const ICONS = {
  fresh: <FaUserPlus />,
  followUp: <FaClipboardCheck />,
  converted: <FaUsers />,
  closed: <FaTimesCircle />,
  meetings: <FaCalendarCheck />,
};
const TONES = { fresh: "blue", followUp: "amber", converted: "green", closed: "gray", meetings: "teal" };
const PAGE_SIZE = 10;
const HAS_HISTORY = ["followUp", "converted", "closed"];

const SingleReport = ({ executives }) => {
  const { fetchExecutiveReport } = useApi();
  const [executive, setExecutive] = useState(null);
  const [range, setRange] = useState({ preset: "all", from: "", to: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("fresh");
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);

  const effective = useMemo(() => rangeFor(range.preset, range), [range]);
  const rangeProblem = rangeError(effective);
  const { startDate, endDate } = effective;

  const load = useCallback(async () => {
    if (!executive || rangeProblem) return;
    setLoading(true);
    setError("");
    try {
      setReport(await fetchExecutiveReport(executive.username, rangeParams({ startDate, endDate })));
    } catch (err) {
      console.error("Executive report error:", err);
      setReport(null);
      setError("Could not load this executive's report.");
    } finally {
      setLoading(false);
    }
  }, [executive, startDate, endDate, rangeProblem, fetchExecutiveReport]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [metric, executive, startDate, endDate]);

  const counts = useMemo(() => (report ? summarize(report) : null), [report]);
  const rows = useMemo(() => (report ? rowsFor(metric, report) : []), [report, metric]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columns = COLUMNS[metric];
  const label = METRICS.find((m) => m.key === metric).label;

  const doExport = (type) => {
    if (!rows.length) return;
    const data = exportRows(metric, rows);
    const name = `${executive.username}_${metric}`;
    if (type === "excel") exportToExcel(data, name);
    else if (type === "csv") exportToCSV(data, name);
    else exportToPDF(data, name, columns.map((c) => c.header));
  };

  const openHistory = (row) => {
    const items = (report.followUps || [])
      .filter((f) => f.fresh_lead_id === row.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setHistory({ name: row.name, items });
  };

  return (
    <div className="rp-section">
      <div className="rp-toolbar">
        <ExecutivePicker label="Executive" executives={executives} value={executive} onChange={setExecutive} />
        <RangeFilter value={range} onChange={setRange} />
      </div>

      {!executive ? (
        <div className="rp-empty">
          <FaUserCircle size={42} aria-hidden="true" />
          <h3>Select an executive</h3>
          <p>Search for an employee above to see their leads, follow-ups, conversions and meetings.</p>
        </div>
      ) : rangeProblem ? (
        <div className="ad-state ad-state-error" role="alert">{rangeProblem}</div>
      ) : error ? (
        <div className="rp-error" role="alert">
          {error} <button type="button" onClick={load}>Retry</button>
        </div>
      ) : (
        <>
          <div className="rp-kpis">
            {METRICS.map((m) => (
              <button
                type="button"
                key={m.key}
                className={`ad-kpi ad-tone-${TONES[m.key]} rp-kpi ${metric === m.key ? "is-active" : ""}`}
                onClick={() => setMetric(m.key)}
                aria-pressed={metric === m.key}
              >
                <span className="ad-kpi-icon">{ICONS[m.key]}</span>
                <span>
                  <span className="ad-kpi-value">{loading || !counts ? "…" : counts[m.key]}</span>
                  <span className="ad-kpi-label">{m.label}</span>
                </span>
              </button>
            ))}
          </div>

          <section className="ad-panel">
            <header className="ad-panel-head">
              <div>
                <h2 className="ad-panel-title">{label}</h2>
                <p className="ad-panel-sub">{executive.username} · {rows.length} record{rows.length === 1 ? "" : "s"}</p>
              </div>
              <div className="rp-export" role="group" aria-label="Export">
                <button type="button" onClick={() => doExport("excel")} disabled={!rows.length}>Excel</button>
                <button type="button" onClick={() => doExport("csv")} disabled={!rows.length}>CSV</button>
                <button type="button" onClick={() => doExport("pdf")} disabled={!rows.length}>PDF</button>
              </div>
            </header>
            {loading ? (
              <div className="ad-state" role="status">Loading report…</div>
            ) : rows.length === 0 ? (
              <div className="ad-state">No {label.toLowerCase()} for this period.</div>
            ) : (
              <>
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        {columns.map((c) => <th key={c.header}>{c.header}</th>)}
                        {HAS_HISTORY.includes(metric) && <th aria-label="History" />}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => (
                        <tr key={`${r.id}-${i}`}>
                          {columns.map((c) => <td key={c.header}>{c.get(r) || "—"}</td>)}
                          {HAS_HISTORY.includes(metric) && (
                            <td>
                              <button type="button" className="rp-icon-btn" aria-label={`Follow-up history for ${r.name}`} onClick={() => openHistory(r)}>
                                <FaEye />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > PAGE_SIZE && (
                  <div className="rp-pager">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>Next</button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {history && (
        <div className="rp-modal-overlay" role="dialog" aria-modal="true" aria-label="Follow-up history">
          <div className="rp-modal">
            <button type="button" className="rp-modal-close" onClick={() => setHistory(null)} aria-label="Close"><FaTimes /></button>
            <h3>Follow-up history — {history.name}</h3>
            {history.items.length === 0 ? (
              <p>No follow-ups recorded for this lead in the selected period.</p>
            ) : (
              <ul className="ad-list">
                {history.items.map((f) => (
                  <li key={f.id}>
                    <span className="ad-list-main">{f.follow_up_type || "Follow-up"}{f.connect_via ? ` · ${f.connect_via}` : ""}</span>
                    <span className="ad-list-meta">{fmtDateTime(f.createdAt)}{f.reason_for_follow_up ? ` — ${f.reason_for_follow_up}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleReport;

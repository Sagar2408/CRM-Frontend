import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaChartLine } from "react-icons/fa";
import { getStageProgressApi } from "../../services/processService";
import { SearchContext } from "../../context/SearchContext";
import "../../styles/processModern.css";

const MODES = {
  final: {
    stage: "final_stage",
    title: "Final Stage",
    sub: "Clients exactly one stage away from completing their application",
    empty: "No clients are one stage away from completion.",
  },
  completed: {
    stage: "completed",
    title: "Completed Clients",
    sub: "Clients who have completed every stage of the process",
    empty: "No clients have completed the full process yet.",
  },
};

const fmt = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-";
};

/**
 * Final Stage / Completed Clients. Both read the same server-side classification
 * (GET /processperson/stage-progress): the number of stages comes from the configured
 * workflow, and a client is in exactly one of the two lists, never both.
 */
const ProcessStagePage = ({ mode = "final", load = getStageProgressApi }) => {
  const cfg = MODES[mode] || MODES.final;
  const navigate = useNavigate();
  const { searchQuery } = useContext(SearchContext) || {};
  const [state, setState] = useState({ loading: true, error: "", clients: [], total: 0 });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    load()
      .then((data) => alive && setState({ loading: false, error: "", clients: data.clients || [], total: data.totalStages || 0 }))
      .catch((err) => alive && setState({ loading: false, error: err.message || "Could not load clients.", clients: [], total: 0 }));
    return () => {
      alive = false;
    };
  }, [load]);

  const rows = useMemo(() => {
    const q = `${query} ${searchQuery || ""}`.trim().toLowerCase();
    return state.clients
      .filter((c) => c.stage === cfg.stage)
      .filter((c) => !q || [c.fullName, c.email, c.phone, c.country].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [state.clients, cfg.stage, query, searchQuery]);

  return (
    <div className="pp-page">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">{cfg.title}</h1>
          <p className="pp-page__sub">{state.loading ? "Loading…" : `${rows.length} client${rows.length === 1 ? "" : "s"} · ${cfg.sub}`}</p>
        </div>
      </header>

      <div className="pp-toolbar">
        <div className="pp-search">
          <FaSearch aria-hidden="true" className="pp-search__icon" />
          <input className="pp-search__input" type="search" placeholder="Search by name, email, phone or country" aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {state.error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {state.error}
        </div>
      )}

      {!state.loading && !state.error && rows.length === 0 && (
        <div className="pp-empty">
          <h3>{cfg.empty}</h3>
        </div>
      )}

      {rows.length > 0 && (
        <div className="pp-tablewrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Country</th>
                <th>Stage</th>
                {mode === "completed" && <th>Final stage</th>}
                {mode === "completed" && <th>Completed on</th>}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.customerId}>
                  <td data-label="Client">{c.fullName}</td>
                  <td data-label="Contact">
                    <div>{c.email || "-"}</div>
                    <div className="pp-page__sub">{c.phone || ""}</div>
                  </td>
                  <td data-label="Country">{c.country || "-"}</td>
                  <td data-label="Stage">
                    <span className="pp-badge pp-badge--under_review">
                      {c.currentStage} of {c.totalStages}
                    </span>
                  </td>
                  {mode === "completed" && <td data-label="Final stage">Stage {c.totalStages}</td>}
                  {mode === "completed" && <td data-label="Completed on">{fmt(c.completedAt)}</td>}
                  <td>
                    <button
                      type="button"
                      className="pp-btn"
                      onClick={() => navigate(`/processperson/client/dashboard/${c.customerId}`, { state: { clientId: c.customerId, clientName: c.fullName } })}
                    >
                      <FaChartLine aria-hidden="true" /> Dashboard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProcessStagePage;

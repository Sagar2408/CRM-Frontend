import React, { useContext, useEffect, useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { getRejectedClientsApi } from "../../services/processService";
import { SearchContext } from "../../context/SearchContext";
import "../../styles/processModern.css";

export const KIND_LABEL = {
  client_withdrawal: "Client withdrew",
  internal_rejection: "Rejected internally",
  unspecified: "Rejected (type not recorded)",
};

const fmt = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-";
};

/**
 * Rejected / withdrawn applications for the signed-in Process Person's own clients.
 * The reason shown is the one actually recorded when the application ended; when none
 * was recorded the page says so instead of inventing text.
 */
const ProcessRejectedClients = ({ load = getRejectedClientsApi }) => {
  const { searchQuery } = useContext(SearchContext) || {};
  const [state, setState] = useState({ loading: true, error: "", clients: [] });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setState({ loading: false, error: "", clients: data.clients || [] }))
      .catch((err) => alive && setState({ loading: false, error: err.message || "Could not load rejected clients.", clients: [] }));
    return () => {
      alive = false;
    };
  }, [load]);

  const rows = useMemo(() => {
    const q = `${query} ${searchQuery || ""}`.trim().toLowerCase();
    return state.clients
      .filter((c) => kind === "all" || c.kind === kind)
      .filter((c) => !q || [c.fullName, c.email, c.phone, c.reason].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [state.clients, query, searchQuery, kind]);

  return (
    <div className="pp-page">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">Rejected Leads</h1>
          <p className="pp-page__sub">{state.loading ? "Loading…" : `${rows.length} application${rows.length === 1 ? "" : "s"} withdrawn or rejected`}</p>
        </div>
      </header>

      <div className="pp-toolbar">
        <div className="pp-search">
          <FaSearch aria-hidden="true" className="pp-search__icon" />
          <input className="pp-search__input" type="search" placeholder="Search by name, contact or reason" aria-label="Search rejected clients" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="pp-chips" role="group" aria-label="Filter by type">
          {[["all", "All"], ["client_withdrawal", "Client withdrew"], ["internal_rejection", "Rejected internally"]].map(([k, label]) => (
            <button key={k} type="button" className={`pp-chip ${kind === k ? "is-active" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {state.error}
        </div>
      )}
      {!state.loading && !state.error && rows.length === 0 && (
        <div className="pp-empty">
          <h3>No rejected or withdrawn applications</h3>
        </div>
      )}

      {rows.length > 0 && (
        <div className="pp-tablewrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Stage reached</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Responsible</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <React.Fragment key={c.customerId}>
                  <tr>
                    <td data-label="Client">
                      <div>{c.fullName}</div>
                      <div className="pp-page__sub">{c.email || c.phone || ""}</div>
                    </td>
                    <td data-label="Type">
                      <span className={`pp-badge ${c.kind === "client_withdrawal" ? "pp-badge--pending" : ""}`}>{KIND_LABEL[c.kind] || KIND_LABEL.unspecified}</span>
                    </td>
                    <td data-label="Stage reached">{c.stageReached > 0 ? `Stage ${c.stageReached} of ${c.totalStages}` : "Before stage 1"}</td>
                    <td data-label="Date">{fmt(c.withdrawnAt)}</td>
                    <td data-label="Reason">{c.reason || <em>No reason recorded</em>}</td>
                    <td data-label="Responsible">{c.responsible || "-"}</td>
                    <td>
                      {c.followUps.length > 0 && (
                        <button type="button" className="pp-btn" aria-expanded={open === c.customerId} onClick={() => setOpen(open === c.customerId ? null : c.customerId)}>
                          {open === c.customerId ? "Hide" : "Follow-ups"} ({c.followUps.length})
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === c.customerId && (
                    <tr className="pp-table__expand">
                      <td colSpan={7}>
                        <ol className="pp-timeline">
                          {c.followUps.map((f) => (
                            <li key={f.id} className="pp-timeline__item">
                              <div className="pp-timeline__head">
                                <strong>{f.by || "Process Person"}</strong>
                                <span className="pp-badge">{f.type}</span>
                              </div>
                              <p className="pp-page__sub">
                                {fmt(f.date)} {f.time ? String(f.time).slice(0, 5) : ""} · {f.via}
                              </p>
                              {f.comments && <p className="pp-timeline__comment">{f.comments}</p>}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProcessRejectedClients;

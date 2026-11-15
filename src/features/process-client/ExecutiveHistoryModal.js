import React, { useEffect, useState } from "react";
import { FaTimes, FaHistory } from "react-icons/fa";
import { getExecutiveHistoryApi } from "../../services/processService";
import "../../styles/processModern.css";

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(+d) ? String(v) : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");

const fmtStamp = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(+d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/**
 * Read-only history of what Executives did with an ASSIGNED client before it reached
 * the Process Person. Data comes from GET /processperson/customers/:id/executive-history
 * (the backend only answers for the signed-in Process Person's own clients). There is
 * deliberately no edit or delete control anywhere in this component.
 */
const ExecutiveHistoryModal = ({ customerId, clientName, onClose, load = getExecutiveHistoryApi }) => {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "", data: null });
    load(customerId)
      .then((data) => alive && setState({ loading: false, error: "", data }))
      .catch((err) => alive && setState({ loading: false, error: err.message || "Could not load history.", data: null }));
    return () => {
      alive = false;
    };
  }, [customerId, load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const entries = state.data?.entries || [];

  return (
    <div className="pp-modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-modal" role="dialog" aria-modal="true" aria-label={`Executive follow-up history for ${clientName || "client"}`}>
        <header className="pp-modal__head">
          <div>
            <h2 className="pp-modal__title">Executive follow-up history</h2>
            <p className="pp-page__sub">
              {clientName || "Client"}
              {state.data?.executive ? ` · Executive: ${state.data.executive}` : ""}
            </p>
          </div>
          <button type="button" className="pp-btn" onClick={onClose} aria-label="Close history">
            <FaTimes aria-hidden="true" />
          </button>
        </header>

        <div className="pp-modal__body">
          {state.loading && <p className="pp-page__sub">Loading history…</p>}
          {state.error && (
            <div className="pp-alert pp-alert--error" role="alert">
              {state.error}
            </div>
          )}
          {!state.loading && !state.error && entries.length === 0 && (
            <div className="pp-empty">
              <h3>No Executive follow-ups recorded</h3>
              <p>No communication with this client was logged before it was assigned to you.</p>
            </div>
          )}
          {entries.length > 0 && (
            <ol className="pp-timeline">
              {entries.map((e, i) => (
                <li key={`${e.source}-${i}`} className="pp-timeline__item">
                  <div className="pp-timeline__head">
                    <strong>{e.executive || "Executive"}</strong>
                    <span className={`pp-badge ${e.status === "Current" ? "pp-badge--under_review" : ""}`}>{e.status || "Previous"}</span>
                    {e.outcome && <span className="pp-badge">{e.outcome}</span>}
                  </div>
                  <dl className="pp-timeline__meta">
                    <div><dt>Contact</dt><dd>{e.via || "-"}</dd></div>
                    <div><dt>Type</dt><dd>{e.type || "-"}</dd></div>
                    <div><dt>Follow-up date</dt><dd>{fmtDate(e.followUpDate)} {fmtTime(e.followUpTime)}</dd></div>
                    {e.nextFollowUpDate && <div><dt>Next follow-up</dt><dd>{fmtDate(e.nextFollowUpDate)} {fmtTime(e.followUpTime)}</dd></div>}
                    {e.recordedAt && <div><dt>Recorded</dt><dd>{fmtStamp(e.recordedAt)}</dd></div>}
                  </dl>
                  {e.comments && <p className="pp-timeline__comment">{e.comments}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export const HistoryIcon = FaHistory;
export default ExecutiveHistoryModal;

import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone, faPenToSquare, faClockRotateLeft, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { SearchContext } from "../../context/SearchContext";
import { useProcessService } from "../../context/ProcessServiceContext";
import ExecutiveHistoryModal from "../process-client/ExecutiveHistoryModal";
import "../../styles/processModern.css";

const FILTER_TYPES = {
  "Document collection": "document collection",
  "Payment follow-up": "payment follow-up",
  "Visa filing": "visa filing",
};

const STALE_DAYS = 3;

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-";
};

const daysSince = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? Math.floor((Date.now() - d.getTime()) / 86400000) : null;
};

const ratingClass = (r) => ({ aggressive: "pp-badge--pending", calm: "pp-badge--under_review", neutral: "" }[(r || "").toLowerCase()] || "");

// Follow-ups of the signed-in Process Person's assigned clients (status "under review").
// The API already scopes the list to Customer.process_person_id; nothing here can
// edit another employee's records - "Update" opens the Process Person's own follow-up form
// and "Executive history" is read-only.
const ProcessClientTable = ({ filter = "All Follow Ups" }) => {
  const navigate = useNavigate();
  const { searchQuery, setActivePage } = useContext(SearchContext);
  const { fetchCustomers, customers } = useProcessService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [popover, setPopover] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  useEffect(() => {
    setActivePage("follow-up");
  }, [setActivePage]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCustomers()
      .catch((err) => {
        console.error("❌ Error fetching clients:", err);
        if (alive) setError("Could not load follow-ups. Please try again.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchCustomers]);

  const rows = useMemo(() => {
    const q = `${query} ${searchQuery || ""}`.trim().toLowerCase();
    const wanted = FILTER_TYPES[filter];
    return (Array.isArray(customers) ? customers : [])
      .filter((c) => c.status === "under_review")
      .filter((c) => {
        const latest = c.processfollowuphistories?.[0];
        if (wanted && (latest?.follow_up_type || "").toLowerCase().trim() !== wanted) return false;
        if (!q) return true;
        return [c.fullName, c.phone, c.email, c.freshLead?.name].some((v) => String(v || "").toLowerCase().includes(q));
      });
  }, [customers, filter, query, searchQuery]);

  const handleEdit = (client) => {
    const freshLeadId = client.freshLead?.id || client.fresh_lead_id;
    if (!freshLeadId) {
      console.error("Fresh Lead ID is missing or incorrect");
      return;
    }
    navigate(`/process/clients/details/${encodeURIComponent(freshLeadId)}/${freshLeadId}`, {
      state: { client: { ...client.freshLead, fresh_lead_id: freshLeadId, id: client.id }, createFollowUp: false, from: "followup" },
    });
  };

  const digits = (p) => String(p || "").replace(/[^\d]/g, "");

  return (
    <div className="pp-page" style={{ paddingTop: 0 }}>
      <div className="pp-toolbar">
        <div className="pp-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="pp-search__icon" />
          <input className="pp-search__input" type="search" placeholder="Search by name, phone or email" aria-label="Search follow-ups" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="pp-page__sub">{loading ? "Loading…" : `${rows.length} follow-up${rows.length === 1 ? "" : "s"}`}</span>
      </div>

      {error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="pp-empty">
          <h3>No follow-up clients found</h3>
          <p>{query || searchQuery || filter !== "All Follow Ups" ? "Try clearing the search or choosing another tab." : "Clients move here after you add their first follow-up."}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="pp-tablewrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Last follow-up</th>
                <th>Type</th>
                <th>Interaction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const latest = c.processfollowuphistories?.[0];
                const age = daysSince(latest?.follow_up_date || latest?.createdAt);
                const stale = age !== null && age >= STALE_DAYS;
                return (
                  <tr key={c.id} className={stale ? "pp-row--stale" : ""}>
                    <td data-label="Client">
                      <strong>{c.fullName || "No Name"}</strong>
                    </td>
                    <td data-label="Contact">
                      <div>{c.phone || "No phone"}</div>
                      <div className="pp-page__sub">{c.email || "N/A"}</div>
                    </td>
                    <td data-label="Last follow-up">
                      {latest ? fmtDate(latest.follow_up_date || latest.createdAt) : "-"}
                      {stale && <span className="pp-badge pp-badge--stale">{age}d ago</span>}
                    </td>
                    <td data-label="Type">{latest?.follow_up_type ? <span className="pp-badge">{latest.follow_up_type}</span> : "-"}</td>
                    <td data-label="Interaction">{latest?.interaction_rating ? <span className={`pp-badge ${ratingClass(latest.interaction_rating)}`}>{latest.interaction_rating}</span> : "-"}</td>
                    <td data-label="Actions">
                      <div className="pp-actions">
                        <button type="button" className="pp-btn pp-btn--primary" onClick={() => handleEdit(c)}>
                          <FontAwesomeIcon icon={faPenToSquare} /> Update
                        </button>
                        <button type="button" className="pp-icon-btn" title="Executive follow-up history" aria-label={`Executive follow-up history for ${c.fullName}`} onClick={() => setHistoryFor(c)}>
                          <FontAwesomeIcon icon={faClockRotateLeft} />
                        </button>
                        <div className="pp-popwrap">
                          <button type="button" className="pp-icon-btn" aria-label={`Contact ${c.fullName}`} aria-expanded={popover === c.id} onClick={() => setPopover(popover === c.id ? null : c.id)}>
                            <FontAwesomeIcon icon={faPhone} />
                          </button>
                          {popover === c.id && (
                            <div className="pp-pop" role="menu">
                              <button type="button" role="menuitem" onClick={() => { window.location.href = `whatsapp://send?phone=91${digits(c.phone)}`; setPopover(null); }}>
                                <FontAwesomeIcon icon={faWhatsapp} style={{ color: "#25D366" }} /> WhatsApp
                              </button>
                              <button type="button" role="menuitem" onClick={() => { window.open(`tel:${digits(c.phone)}`); setPopover(null); }}>
                                <FontAwesomeIcon icon={faPhone} /> Normal Call
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {historyFor && <ExecutiveHistoryModal customerId={historyFor.id} clientName={historyFor.fullName} onClose={() => setHistoryFor(null)} />}
    </div>
  );
};

export default ProcessClientTable;

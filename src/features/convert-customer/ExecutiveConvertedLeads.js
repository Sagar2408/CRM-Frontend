import React, { useContext, useEffect, useMemo, useState } from "react";
import { FaHistory } from "react-icons/fa";
import { useApi } from "../../context/ApiContext";
import { SearchContext } from "../../context/SearchContext";
import useCopyNotification from "../../hooks/useCopyNotification";
import LoadingSpinner from "../spinner/LoadingSpinner";
import "../../styles/customer.css";
import "../../styles/convertedLeads.css";

export const CONVERTED_BANNER =
  "Thank you for converting this lead! All leads converted by you are now managed by the Admin and Process Person teams. No further action is required from your side.";

const PAGE_SIZE = 10;

const fmtDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(+d) ? "N/A" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// Executive "Converted Leads": a READ-ONLY list of the leads this executive converted.
// There are deliberately no edit, select or invoice actions here - converted leads
// are handled by the Admin and Process Person teams. (The Process panel keeps its own
// converted-customers page and its invoice tools.)
const ExecutiveConvertedLeads = () => {
  const {
    convertedClients,
    convertedClientsLoading,
    fetchConvertedClientsAPI,
    fetchNotifications,
    createCopyNotification,
    fetchFollowUpHistoriesAPI,
    setConvertedCustomerCount,
  } = useApi();
  const { searchQuery, setSearchQuery } = useContext(SearchContext) || { searchQuery: "" };
  useCopyNotification(createCopyNotification, fetchNotifications);

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchConvertedClientsAPI();
  }, [fetchConvertedClientsAPI]);

  const customers = useMemo(() => {
    const list = Array.isArray(convertedClients) ? convertedClients.filter((c) => c.status === "Converted") : [];
    return [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [convertedClients]);

  useEffect(() => {
    setConvertedCustomerCount?.(customers.length);
  }, [customers.length, setConvertedCustomerCount]);

  const query = (searchQuery || "").trim().toLowerCase();
  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          !query ||
          c.name?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.phone?.toString().includes(query)
      ),
    [customers, query]
  );

  useEffect(() => setPage(1), [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openHistory = async (customer) => {
    setSelected(customer);
    setHistoryLoading(true);
    try {
      const raw = await fetchFollowUpHistoriesAPI();
      const leadId = customer.fresh_lead_id || customer.freshLead?.id || customer.lead?.id || customer.id;
      const rows = (Array.isArray(raw) ? raw : [])
        .filter((item) => String(item.fresh_lead_id || item.followUp?.fresh_lead_id) === String(leadId))
        .map((item) => ({
          date: item.follow_up_date || item.followUp?.follow_up_date || "N/A",
          time: item.follow_up_time || item.followUp?.follow_up_time || "N/A",
          reason: item.reason_for_follow_up || item.followUp?.reason_for_follow_up || "No reason provided",
          tags: [
            item.connect_via || item.followUp?.connect_via || "",
            item.follow_up_type || item.followUp?.follow_up_type || "",
            item.interaction_rating || item.followUp?.interaction_rating || "",
          ].filter(Boolean),
        }))
        .sort((a, b) => {
          const da = new Date(`${a.date} ${a.time}`);
          const db = new Date(`${b.date} ${b.time}`);
          return !isNaN(da) && !isNaN(db) ? db - da : `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
        });
      setHistory(rows);
    } catch (err) {
      console.error("Failed to load follow-up history:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="conv-page">
      <div className="conv-banner" role="status">
        <span className="conv-banner__icon" aria-hidden="true">
          &#10003;
        </span>
        <p>{CONVERTED_BANNER}</p>
      </div>

      <header className="conv-head">
        <div>
          <h2>Converted Leads</h2>
          <p>Read-only record of the leads you converted.</p>
        </div>
        <span className="conv-count" aria-label="Total converted leads">
          Total: {customers.length}
        </span>
      </header>

      {query && (
        <div className="conv-filter">
          Showing results for &ldquo;{searchQuery.trim()}&rdquo;
          <button type="button" onClick={() => setSearchQuery?.("")}>
            Clear
          </button>
        </div>
      )}

      {convertedClientsLoading && customers.length === 0 ? (
        <LoadingSpinner text="Loading converted leads..." />
      ) : filtered.length === 0 ? (
        <div className="conv-empty">{customers.length === 0 ? "No converted leads yet." : "No converted leads match your search."}</div>
      ) : (
        <>
          <div className="conv-table-wrap">
            <table className="conv-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Converted on</th>
                  <th>History</th>
                </tr>
              </thead>
              <tbody>
                {current.map((c) => (
                  <tr key={c.id ?? c.fresh_lead_id ?? c.email}>
                    <td data-label="Name">{c.name || "N/A"}</td>
                    <td data-label="Phone">{c.phone || "N/A"}</td>
                    <td data-label="Email">{c.email || "N/A"}</td>
                    <td data-label="Converted on">{fmtDate(c.updatedAt || c.createdAt)}</td>
                    <td data-label="History">
                      <button type="button" className="follow-history-btn" onClick={() => openHistory(c)} title="View follow-up history">
                        <FaHistory aria-hidden="true" /> Follow History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="c-pagination-wrapper">
            <div className="c-pagination">
              <button type="button" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
                Prev
              </button>
              <span style={{ margin: "0 10px" }}>
                Page {page} of {totalPages}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="h-followup-modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="h-followup-modal" role="dialog" aria-modal="true" aria-label={`Follow-up history for ${selected.name}`}>
            <div className="h-followup-modal-header">
              <h3>{selected.name}</h3>
              <button type="button" className="h-close-btn" aria-label="Close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className="h-followup-modal-body">
              {historyLoading ? (
                <p>Loading history...</p>
              ) : history.length > 0 ? (
                history.map((entry, idx) => (
                  <div className="h-followup-entry-card" key={idx}>
                    <div className="h-followup-date">
                      <span>{entry.date}</span>
                      <span>{entry.time}</span>
                      {idx === 0 && <span className="h-latest-tag">LATEST</span>}
                    </div>
                    <div className="h-followup-tags">
                      {entry.tags.map((tag, i) => (
                        <span key={i} className={`h-tag ${tag === "Hot" ? "hot" : ""}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="h-followup-reason-box">
                      <p>Follow-Up Reason</p>
                      <div className="h-reason-text">{entry.reason}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p>No follow-up history found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveConvertedLeads;

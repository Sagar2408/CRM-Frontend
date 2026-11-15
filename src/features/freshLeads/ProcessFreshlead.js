import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/processModern.css";
import "../../styles/processPortal.css";
import { useApi } from "../../context/ApiContext";
import { useProcessService } from "../../context/ProcessServiceContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faClockRotateLeft, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import useCopyNotification from "../../hooks/useCopyNotification";
import { SearchContext } from "../../context/SearchContext";
import LoadingSpinner from "../spinner/LoadingSpinner";
import ExecutiveHistoryModal from "../process-client/ExecutiveHistoryModal";

const PAGE_SIZE = 9;

// Fresh Leads for the signed-in Process Person: assigned clients that have no follow-up
// yet. The table turns into stacked cards on narrow screens (see .pp-table in
// processPortal.css), so nothing is clipped or hidden at 390px. "Add Follow-up" and
// "Executive History" stay visible at every width; there is no call button here.
function ProcessFreshlead() {
  const { fetchCustomers, customers } = useProcessService();
  const { fetchNotifications, createCopyNotification } = useApi();
  const { searchQuery } = useContext(SearchContext);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [historyFor, setHistoryFor] = useState(null);

  const navigate = useNavigate();

  useCopyNotification(createCopyNotification, fetchNotifications);

  // Only this Process Person's assigned clients come back from the API.
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      await fetchCustomers();
    } catch (err) {
      setError("Failed to load data. Please try again.");
      console.error("❌ Error loading data:", err);
    } finally {
      setIsLoading(false);
      setCurrentPage(1);
    }
  }, [fetchCustomers]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const leadData = useMemo(() => {
    const q = `${query} ${searchQuery || ""}`.trim().toLowerCase();
    return (Array.isArray(customers) ? customers : [])
      .filter((client) => client.status === "pending")
      .filter(
        (lead) =>
          !q ||
          lead.fullName?.toLowerCase().includes(q) ||
          lead.phone?.toString().includes(q) ||
          lead.email?.toLowerCase().includes(q)
      );
  }, [customers, query, searchQuery]);

  useEffect(() => setCurrentPage(1), [query, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(leadData.length / PAGE_SIZE));
  const paginatedLeads = leadData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddFollowUp = (lead) => {
    const clientLead = lead.freshLead?.lead?.clientLead || {};
    const clientData = {
      name: lead.fullName || clientLead.fullName || "",
      email: lead.email || clientLead.email || "",
      phone: lead.phone || clientLead.phone || "",
      altPhone: lead.altPhone || clientLead.altPhone || "",
      education: lead.education || clientLead.education || "",
      experience: lead.experience || clientLead.experience || "",
      state: lead.state || clientLead.state || "",
      dob: lead.dob || clientLead.dob || "",
      country: lead.country || clientLead.country || "",
      assignDate: lead.assignDate || lead.assignmentDate || "",
      freshLeadId: lead.fresh_lead_id,
      id: lead.id,
    };

    navigate(`/process/clients/processperson/${encodeURIComponent(lead.fullName)}/${lead.fresh_lead_id}`, {
      state: { client: clientData, createFollowUp: true, clientId: clientData.id },
    });
  };

  return (
    <div className="pp-page fresh-leads-main-content" style={{ position: "relative", minWidth: 0 }}>
      {isLoading && <LoadingSpinner text="Loading Fresh Leads..." />}
      <header className="pp-page__head">
        <div style={{ minWidth: 0 }}>
          <h1 className="pp-page__title">Fresh Leads</h1>
          <p className="pp-page__sub">
            {leadData.length} assigned lead{leadData.length === 1 ? "" : "s"} awaiting your first follow-up
          </p>
        </div>
      </header>

      <div className="pp-toolbar">
        <div className="pp-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="pp-search__icon" />
          <input
            className="pp-search__input"
            type="search"
            placeholder="Search by name, phone or email"
            aria-label="Search fresh leads"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {error}
        </div>
      )}

      {!error && (
        <>
          {leadData.length === 0 && !isLoading ? (
            <div className="pp-empty">
              <h3>No assigned leads available</h3>
              <p>{query || searchQuery ? "Try clearing the search." : "New clients assigned to you will appear here."}</p>
            </div>
          ) : (
            <div className="pp-tablewrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Add follow-up</th>
                    <th>Executive history</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead, index) => (
                    <tr key={lead.id ?? index}>
                      <td data-label="Name" style={{ overflowWrap: "anywhere" }}>
                        <strong>{lead.fullName}</strong>
                        {lead.profession && <div className="pp-page__sub">{lead.profession}</div>}
                      </td>
                      <td data-label="Phone">{lead.phone || "-"}</td>
                      <td data-label="Email" style={{ overflowWrap: "anywhere" }}>{lead.email || "-"}</td>
                      <td data-label="Add follow-up">
                        <button type="button" className="pp-btn pp-btn--primary" onClick={() => handleAddFollowUp(lead)}>
                          <FontAwesomeIcon icon={faPenToSquare} /> Add Follow-up
                        </button>
                      </td>
                      <td data-label="Executive history">
                        <button
                          type="button"
                          className="pp-btn"
                          aria-label={`View Executive follow-up history for ${lead.fullName}`}
                          onClick={() => setHistoryFor(lead)}
                        >
                          <FontAwesomeIcon icon={faClockRotateLeft} /> Executive History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pp-pager" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" className="pp-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                « Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button type="button" className="pp-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next »
              </button>
            </div>
          )}
        </>
      )}

      {historyFor && <ExecutiveHistoryModal customerId={historyFor.id} clientName={historyFor.fullName} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

export default ProcessFreshlead;

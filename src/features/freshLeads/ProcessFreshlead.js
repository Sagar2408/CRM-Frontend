import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/freshlead.css";
import "../../styles/processModern.css";
import { useApi } from "../../context/ApiContext";
import { useProcessService } from "../../context/ProcessServiceContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone, faPenToSquare, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import useCopyNotification from "../../hooks/useCopyNotification";
import { SearchContext } from "../../context/SearchContext";
import LoadingSpinner from "../spinner/LoadingSpinner";
import ExecutiveHistoryModal from "../process-client/ExecutiveHistoryModal";

function ProcessFreshlead() {
  const { fetchCustomers, customers } = useProcessService();
  const { fetchNotifications, createCopyNotification } = useApi();
  const { searchQuery } = useContext(SearchContext);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activePopoverIndex, setActivePopoverIndex] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const itemsPerPage = 9;
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
    const query = (searchQuery || "").toLowerCase();
    return (Array.isArray(customers) ? customers : [])
      .filter((client) => client.status === "pending")
      .filter(
        (lead) =>
          lead.fullName?.toLowerCase().includes(query) ||
          lead.phone?.toString().includes(query) ||
          lead.email?.toLowerCase().includes(query)
      );
  }, [customers, searchQuery]);

  useEffect(() => setCurrentPage(1), [searchQuery]);

  const totalPages = Math.ceil(leadData.length / itemsPerPage);
  const paginatedLeads = leadData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    <div className="fresh-leads-main-content pp-page" style={{ position: "relative" }}>
      {isLoading && <LoadingSpinner text="Loading Fresh Leads..." />}
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">Fresh Leads</h1>
          <p className="pp-page__sub">{leadData.length} assigned lead{leadData.length === 1 ? "" : "s"} awaiting your first follow-up</p>
        </div>
      </header>

      {error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="fresh-leads-table-container">
            <table className="fresh-leads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Add follow-ups</th>
                  <th>Executive history</th>
                  <th>Call</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.length > 0 ? (
                  paginatedLeads.map((lead, index) => (
                    <tr key={lead.id ?? index}>
                      <td>
                        <div className="fresh-leads-name">
                          <div className="fresh-lead-detail">
                            <div>{lead.fullName}</div>
                            <div className="fresh-leads-profession">{lead.profession}</div>
                          </div>
                        </div>
                      </td>
                      <td>{lead.phone}</td>
                      <td>{lead.email}</td>
                      <td>
                        <button
                          className="followup-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddFollowUp(lead);
                          }}
                        >
                          Add Follow Up
                          <FontAwesomeIcon icon={faPenToSquare} className="icon" />
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pp-icon-btn"
                          title="View Executive follow-up history"
                          aria-label={`View Executive follow-up history for ${lead.fullName}`}
                          onClick={() => setHistoryFor(lead)}
                        >
                          <FontAwesomeIcon icon={faClockRotateLeft} />
                        </button>
                      </td>
                      <td className="call-cell">
                        <button
                          className="call-button"
                          aria-label={`Contact ${lead.fullName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopoverIndex(activePopoverIndex === index ? null : index);
                          }}
                        >
                          📞
                        </button>
                        {activePopoverIndex === index && (
                          <div className="popover">
                            <button
                              className="popover-option"
                              onClick={() => {
                                localStorage.setItem("activeClient", JSON.stringify({ name: lead.fullName, phone: lead.phone }));
                                const cleaned = String(lead.phone || "").replace(/[^\d]/g, "");
                                window.location.href = `whatsapp://send?phone=91${cleaned}`;
                                setActivePopoverIndex(null);
                              }}
                            >
                              <FontAwesomeIcon icon={faWhatsapp} style={{ color: "#25D366", marginRight: "6px", fontSize: "18px" }} />
                              WhatsApp
                            </button>
                            <button
                              className="popover-option"
                              onClick={() => {
                                const cleaned = String(lead.phone || "").replace(/[^\d]/g, "");
                                window.open(`tel:${cleaned}`);
                                setActivePopoverIndex(null);
                              }}
                            >
                              <FontAwesomeIcon icon={faPhone} style={{ color: "#4285F4", marginRight: "6px", fontSize: "16px" }} />
                              Normal Call
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="no-leads-text">
                      {isLoading ? "Loading…" : "No assigned leads available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="fresh-pagination">
              <button className="fresh-pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>« Prev</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button className="fresh-pagination-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next »</button>
            </div>
          )}
        </>
      )}

      {historyFor && (
        <ExecutiveHistoryModal customerId={historyFor.id} clientName={historyFor.fullName} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

export default ProcessFreshlead;

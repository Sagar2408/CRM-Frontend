




import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/freshlead.css";
import { useApi } from "../../context/ApiContext";
import { useExecutiveActivity } from "../../context/ExecutiveActivityContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faPenToSquare,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import useCopyNotification from "../../hooks/useCopyNotification";
import { SearchContext } from "../../context/SearchContext";
import LoadingSpinner from "../spinner/LoadingSpinner";
import Chat from "../chatbot/Chat"; // Import the Chat component
import { useRef } from "react";

function FreshLead() {
  const {
    fetchFreshLeadsAPI,
    executiveInfo,
    fetchExecutiveData,
    executiveLoading,
    fetchNotifications,
    createCopyNotification,
    getFollowUpHistory,
  } = useApi();

  const { leadtrack } = useExecutiveActivity();
  const { searchQuery } = useContext(SearchContext);
  const [setChatbotPopoverIndex] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [leadsData, setLeadsData] = useState([]);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activePopoverIndex, setActivePopoverIndex] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showChatbotPopup, setShowChatbotPopup] = useState(false); // New state for chatbot popup
  const [selectedLead, setSelectedLead] = useState(null); // Store selected lead for chatbot
  const itemsPerPage = 10;
  const navigate = useNavigate();

  // Ensure this line ends with a semicolon
  useCopyNotification(createCopyNotification, fetchNotifications);

  const isLeadOld = (assignmentDate) => {
    if (!assignmentDate) return false;
    const today = new Date();
    const assignDate = new Date(assignmentDate);
    const diffTime = Math.abs(today - assignDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 3;
  };

  const popupRef = useRef(null);
  const headerRef= useRef(null);

  useEffect(() => {
    if (!showChatbotPopup || !popupRef.current || !headerRef.current) return;

    const popup = popupRef.current;
    const header = headerRef.current;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      const rect = popup.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      popup.style.position = "absolute";
      popup.style.zIndex = 99999;
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        popup.style.left = `${e.clientX - offsetX}px`;
        popup.style.top = `${e.clientY - offsetY}px`;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    header.style.cursor = "move";
    header.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      header.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [showChatbotPopup]);

  // Function to open chatbot popup
  const openChatbotPopup = (lead) => {
    console.log("Opening chatbot popup for:", lead.name); // Debug log
    setSelectedLead(lead);
    localStorage.setItem(
      "activeClient",
      JSON.stringify({
        name: lead.name,
        phone: lead.phone,
      })
    );
    setShowChatbotPopup(true);
    setActivePopoverIndex(null); // Close the call options popover
    console.log("Chatbot popup state set to true"); // Debug log
  };

  // Function to close chatbot popup
  const closeChatbotPopup = () => {
    setShowChatbotPopup(false);
    setSelectedLead(null);
  };

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user"));
    const executiveId = userData?.id;
    if (executiveId) {
      leadtrack(executiveId);
    }
  }, [leadtrack]);

  useEffect(() => {
    const loadLeads = async () => {
      if (hasLoaded) return;
      setIsLoading(true);
      try {
        if (!executiveInfo && !executiveLoading) {
          await fetchExecutiveData();
        }

        const data = await fetchFreshLeadsAPI();

        let leads = [];
        if (Array.isArray(data)) {
          leads = data;
        } else if (data && Array.isArray(data.data)) {
          leads = data.data;
        } else {
          setError("Invalid leads data format.");
          return;
        }

        const filteredLeads = leads
          .filter(
            (lead) =>
              lead.clientLead?.status === "New" ||
              lead.clientLead?.status === "Assigned"
          )
          .sort((a, b) => {
            const dateA = new Date(
              a.assignDate ||
                a.lead?.assignmentDate ||
                a.clientLead?.assignDate ||
                0
            );
            const dateB = new Date(
              b.assignDate ||
                b.lead?.assignmentDate ||
                b.clientLead?.assignDate ||
                0
            );
            return dateB - dateA;
          });

        setLeadsData(filteredLeads);
        setCurrentPage(1);
        setHasLoaded(true);
      } catch (err) {
        setError("Failed to load leads. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadLeads();
}, [executiveInfo, executiveLoading, hasLoaded, fetchExecutiveData, fetchFreshLeadsAPI]);


  const filteredLeadsData = leadsData.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.phone?.toString().includes(query) ||
      lead.email?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredLeadsData.length / itemsPerPage);
  const currentLeads = filteredLeadsData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handleAddFollowUp = async (lead) => {
    const clientLead = lead.clientLead || {};
    const clientData = {
      name: lead.name || clientLead.name || "",
      email: lead.email || clientLead.email || "",
      phone: lead.phone || clientLead.phone || "",
      altPhone: lead.altPhone || clientLead.altPhone || "",
      education: lead.education || clientLead.education || "",
      experience: lead.experience || clientLead.experience || "",
      state: lead.state || clientLead.state || "",
      dob: lead.dob || clientLead.dob || "",
      country: lead.country || clientLead.country || "",
      assignDate: lead.assignDate || lead.assignmentDate || "",
      freshLeadId: lead.id,
      id: clientLead.id || lead.id,
    };
  
    let followUpHistory = [];
  
    try {
      followUpHistory = await getFollowUpHistory(lead.id);
    } catch (error) {
      console.error("Failed to fetch follow-up history:", error);
    }
  
    navigate(`/executive/clients/${encodeURIComponent(clientData.id)}`, {
      state: {
        client: clientData,
        createFollowUp: true,
        followUpHistory: followUpHistory,
        clientId: clientData.id,
      },
    });
  };
  

  if (executiveLoading) return <p>Loading executive data...</p>;

  return (
    <div className="fresh-leads-main-content" style={{ position: "relative" }}>
      {isLoading && <LoadingSpinner text="Loading Fresh Leads..." />}
      <div className="fresh-leads-header">
        <h2 className="fresh-leads-title">Fresh leads list</h2>
        <h4 className="fresh-leads-subtitle">
          Click on Add followup to view details
        </h4>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!error && (
        <>
          <div className="fresh-leads-table-container">
            <table className="fresh-leads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Actions</th>
                  <th>Call</th>
                </tr>
              </thead>
              <tbody>
                {currentLeads.length > 0 ? (
                  currentLeads.map((lead, index) => {
                    const assignmentDate =
                      lead.assignDate ||
                      lead.lead?.assignmentDate ||
                      lead.clientLead?.assignDate;
                    const isOld = isLeadOld(assignmentDate);

                    return (
                      <tr
                        key={index}
                        className={isOld ? "old-lead-row" : ""}
                        style={
                          isOld
                            ? {
                                backgroundColor: "#ffebee",
                                borderLeft: "4px solid #f44336",
                              }
                            : {}
                        }
                      >
                        <td>
                          <div className="fresh-leads-name">
                            <div className="fresh-lead-detail">
                              <div
                                style={
                                  isOld
                                    ? { color: "#c62828", fontWeight: "bold" }
                                    : {}
                                }
                              >
                                {lead.name}
                              </div>
                              <div className="fresh-leads-profession">
                                {lead.profession}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={isOld ? { color: "#c62828", fontWeight: "bold" } : {}}>
                          {lead.phone}
                        </td>
                        <td style={isOld ? { color: "#c62828", fontWeight: "bold" } : {}}>
                          {lead.email}
                        </td>
                        <td>
                          <button
                            className={`followup-badge ${
                              isOld ? "old-lead-button" : ""
                            }`}
                            onClick={() => handleAddFollowUp(lead)}
                            style={
                              isOld
                                ? {
                                    borderColor: "#d32f2f",
                                    color: "#d32f2f",
                                  }
                                : {}
                            }
                          >
                            Add Follow Up
                            <FontAwesomeIcon
                              icon={faPenToSquare}
                              className="icon"
                            />
                          </button>
                        </td>
                        <td className="call-cell">
                          <button
                            className={`call-button ${
                              isOld ? "old-lead-call" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePopoverIndex(
                                activePopoverIndex === index ? null : index
                              );
                              setChatbotPopoverIndex(null); // Close chatbot if already open
                            }}
                            style={
                              isOld
                                ? {
                                    color: "#d32f2f",
                                    border: "3px solid #d32f2f",
                                  }
                                : {}
                            }
                          >
                            📞
                          </button>

                          {/* Primary Call Popover */}
                          {activePopoverIndex === index && (
                            <div className="popover">
                              <button
                                className="popover-option"
                                onClick={() => {
                                  localStorage.setItem(
                                    "activeClient",
                                    JSON.stringify({
                                      name: lead.name,
                                      phone: lead.phone,
                                    })
                                  );
                                  const cleaned = lead.phone.replace(
                                    /[^\d]/g,
                                    ""
                                  );
                                  window.location.href = `whatsapp://send?phone=${cleaned}`;
                                  setActivePopoverIndex(null);
                                  // Open chatbot popup immediately
                                  openChatbotPopup(lead);
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={faWhatsapp}
                                  style={{
                                    color: "#25D366",
                                    marginRight: "6px",
                                    fontSize: "18px",
                                  }}
                                />
                                WhatsApp
                              </button>
                              <button
                                className="popover-option"
                                onClick={() => {
                                  const cleaned = lead.phone.replace(
                                    /[^\d]/g,
                                    ""
                                  );
                                  window.open(`tel:${cleaned}`);
                                  setActivePopoverIndex(null);
                                  // Open chatbot popup immediately
                                  openChatbotPopup(lead);
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={faPhone}
                                  style={{
                                    color: "#4285F4",
                                    marginRight: "6px",
                                    fontSize: "16px",
                                  }}
                                />
                                Normal Call
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="no-leads-text">
                      No assigned leads available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="fl-unique-pagination-wrapper">
  <div className="fl-unique-pagination">
    <button
      className="fl-unique-pagination-btn"
      onClick={handlePrevPage}
      disabled={currentPage === 1}
    >
      Prev
    </button>
    <span className="fl-unique-pagination-span">
      Page {currentPage} of {totalPages}
    </span>
    <button
      className="fl-unique-pagination-btn"
      onClick={handleNextPage}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>
</div>

        </>
      )}

      {/* Enhanced Responsive Chatbot Popup Modal */}
      {showChatbotPopup && (
        <div
          className="chatbot-popup-overlay"
          onClick={closeChatbotPopup}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chatbot-title"
          aria-describedby="chatbot-description"
        >
          <div
            className="chatbot-popup-container"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            ref={popupRef}
          >
            <div className="chatbot-popup-header" ref={headerRef}>
              <h3 id="chatbot-title">
                Chat with {selectedLead?.name || "AI Assistant"}
              </h3>
              <button
                className="chatbot-close-btn"
                onClick={closeChatbotPopup}
                aria-label="Close chat"
                title="Close chat"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="chatbot-popup-content" id="chatbot-description">
              <Chat
                isCallActive={false}
                token={localStorage.getItem("token")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FreshLead;
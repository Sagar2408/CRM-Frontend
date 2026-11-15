import React, { useState, useEffect, useCallback, useMemo } from "react";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faSearch,
  faCalendarAlt,
  faClock as farClockRegular,
  faEnvelope,
  faPhone,
  faComments,
  faVideo,
  faStar,
  faTimes,
  faHistory,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useProcessService } from "../../context/ProcessServiceContext";
import ProcessMeetingItem from "./ProcessMeetingItem";
import RejectionKindPicker from "./RejectionKindPicker";
import "../../styles/processModern.css";
import LoadingSpinner from "../spinner/LoadingSpinner";
import {  useNavigate } from "react-router-dom";
import "../../styles/schedule.css";

const ProcessScheduleMeeting = () => {
  const {
    getProcessPersonMeetings,
    getProcessFollowup,
    processCreateFollowUp,
    createMeetingApi,
    createFinalStage,
    createRejected
  } = useProcessService();


  const navigate = useNavigate();

  

  const [allMeetings, setAllMeetings] = useState([]);
  const [activeFilter, setActiveFilter] = useState("today");
  const [anchor, setAnchor] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectionKind, setRejectionKind] = useState("");

  const [selectedMeetingForFollowUp, setSelectedMeetingForFollowUp] = useState(null);
  const [selectedMeetingForHistory, setSelectedMeetingForHistory] = useState(null);
  const [followUpHistoryList, setFollowUpHistoryList] = useState([]);

  const [contactMethod, setContactMethod] = useState("");
  const [followUpType, setFollowUpType] = useState("");
  const [interactionRating, setInteractionRating] = useState("");
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().split("T")[0]);
  const [interactionTime, setInteractionTime] = useState("12:00");
  const [comments, setComments] = useState("");
  const [docName, setDocName] = useState("");


  function convertTo24HrFormat(timeStr) {
  const dateObj = new Date(`1970-01-01 ${timeStr}`);
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}:00`;
}
// Only this Process Person's own meetings come back from the API (scoped server-side by
// the JWT identity); one meeting per lead, and only leads currently in "meeting" status.
const loadMeetings = useCallback(async () => {
  setLoading(true);
  try {
    const response = await getProcessPersonMeetings();
    const list = Array.isArray(response) ? response : [];
    const unique = new Map();
    list
      .filter((m) => m?.freshLead?.CustomerStatus?.status === "meeting")
      .forEach((m) => {
        if (!unique.has(m.fresh_lead_id)) unique.set(m.fresh_lead_id, m);
      });
    setAllMeetings(Array.from(unique.values()));
  } catch (err) {
    console.error("Failed to fetch process meetings", err);
  } finally {
    setLoading(false);
  }
}, [getProcessPersonMeetings]);

useEffect(() => {
  loadMeetings();
}, [loadMeetings]);

// View window for the active tab, relative to the date being browsed.
const range = useMemo(() => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (activeFilter === "today") {
    end.setDate(end.getDate() + 1);
  } else if (activeFilter === "week") {
    start.setDate(start.getDate() - start.getDay()); // Sunday
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  }
  return { start, end };
}, [anchor, activeFilter]);

const meetings = useMemo(() => {
  const q = query.trim().toLowerCase();
  return allMeetings
    .filter((m) => {
      const t = new Date(m.startTime);
      if (Number.isNaN(+t) || t < range.start || t >= range.end) return false;
      if (!q) return true;
      return [m.clientName, m.clientEmail, m.clientPhone, m.reasonForFollowup].some((v) => String(v || "").toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}, [allMeetings, range, query]);

const shift = (dir) => {
  const next = new Date(anchor);
  if (activeFilter === "today") next.setDate(next.getDate() + dir);
  else if (activeFilter === "week") next.setDate(next.getDate() + 7 * dir);
  else next.setMonth(next.getMonth() + dir);
  setAnchor(next);
};

const rangeLabel = () => {
  const opt = { day: "numeric", month: "short", year: "numeric" };
  if (activeFilter === "today") return range.start.toLocaleDateString(undefined, { weekday: "long", ...opt });
  if (activeFilter === "month") return range.start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const last = new Date(range.end);
  last.setDate(last.getDate() - 1);
  return range.start.toLocaleDateString(undefined, opt) + " - " + last.toLocaleDateString(undefined, opt);
};

  const handleShowHistory = async (meeting) => {
    setSelectedMeetingForHistory(meeting);
    setLoading(true);
    try {
      const leadId = meeting?.fresh_lead_id 
      if (!leadId) {
        console.warn("❌ Missing leadId in meeting:", meeting);
        setFollowUpHistoryList([]);
        return;
      }

      const result = await getProcessFollowup(leadId);

      const sorted = Array.isArray(result?.data)
        ? [...result.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

      setFollowUpHistoryList(sorted);
    } catch (err) {
      console.error("Failed to fetch follow-up history", err);
      setFollowUpHistoryList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!contactMethod || !followUpType || !interactionRating || !interactionDate || !interactionTime) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Fields",
        text: "Please fill all fields before submitting.",
      });
    }

    const leadId =
      selectedMeetingForFollowUp?.fresh_lead_id 
     

    if (!leadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Lead ID",
        text: "Unable to determine fresh_lead_id from the selected meeting.",
      });
    }

    const payload = {
      fresh_lead_id: String(selectedMeetingForFollowUp.fresh_lead_id),
      connect_via: contactMethod,
      follow_up_type: followUpType,
      interaction_rating: interactionRating,
      follow_up_date: interactionDate,
      follow_up_time: interactionTime,
      comments: comments || "-",
        document_name:docName
    };

    try {
      await processCreateFollowUp(payload);
        const result=  await getProcessFollowup(leadId)
        setFollowUpHistoryList(result.data);
        loadMeetings();
     
      Swal.fire({ icon: "success", title: "Follow-Up Created" });
      setSelectedMeetingForFollowUp(null);
      setContactMethod("");
      setFollowUpType("");
      setInteractionRating("");
      setComments("");
    } catch (err) {
      console.error("Create Follow-Up error", err);
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Could not create follow-up.",
      });
    }
  };
 const handleCreateMeeting = async () => {
    const leadId =
      selectedMeetingForFollowUp?.fresh_lead_id 
     

    if (!leadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Lead ID",
        text: "Unable to determine fresh_lead_id from the selected meeting.",
      });
    }

    if (!comments) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Reason",
        text: "Please add a reason before creating a meeting.",
      });
    }

    try {
      

      
     const meetingPayload = {
          clientName: selectedMeetingForFollowUp.clientName,
          clientEmail: selectedMeetingForFollowUp.clientEmail,
          clientPhone: selectedMeetingForFollowUp.clientPhone,
          reasonForFollowup: comments,
          startTime: new Date(`${interactionDate}T${interactionTime}`).toISOString(),
          endTime: null,
          connect_via: contactMethod, 
        follow_up_type: followUpType, 
        interaction_rating: interactionRating, 
        follow_up_date: interactionDate, 
        follow_up_time: convertTo24HrFormat(interactionTime), 
          fresh_lead_id:  String(selectedMeetingForFollowUp.fresh_lead_id),
        };
      await createMeetingApi(meetingPayload);
       await getProcessFollowup(leadId);
     loadMeetings();

      Swal.fire({ icon: "success", title: "Meeting Created" });

    } catch (err) {
      console.error("Meeting Creation Error:", err);
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Something went wrong. Please try again.",
      });
    }
  };
   const handleFollowUpAction = async () => {
     const leadId =
      selectedMeetingForFollowUp?.fresh_lead_id 
     

    if (!leadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Lead ID",
        text: "Unable to determine fresh_lead_id from the selected meeting.",
      });
    }

    if (!comments) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Reason",
        text: "Please add a reason before creating a meeting.",
      });
    }
  
      try {
       if (followUpType === "final") {
          const payload={
        //  follow_up_id: clientInfo.followUpId || clientInfo.id, 
          connect_via: contactMethod, 
          follow_up_type: followUpType, 
          interaction_rating: interactionRating, 
          comments: comments, 
          follow_up_date: interactionDate, 
          follow_up_time: interactionTime, 
          fresh_lead_id:  String(selectedMeetingForFollowUp.fresh_lead_id), 
        }
      
          await createFinalStage(payload);
          await getProcessFollowup(leadId);
           loadMeetings();
        
   Swal.fire({ icon: "success", title: "Lead Moved to Final Stage" });
    setTimeout(() => {
    navigate("/process/process-follow-up"); // Replace the current URL with the new one
  }, 1000);
        }
        
        else if (followUpType === "rejected") {
        if (!rejectionKind) {
          return Swal.fire({ icon: "warning", title: "Select a reason type", text: "Choose whether the client withdrew or the application was rejected internally." });
        }
        const payload={
          rejection_kind: rejectionKind,
        //  follow_up_id: clientInfo.followUpId || clientInfo.id, 
          connect_via:contactMethod, 
          follow_up_type: followUpType, 
          interaction_rating:interactionRating, 
          comments: comments, 
          follow_up_date: interactionDate, 
          follow_up_time: interactionTime, 
          fresh_lead_id:  String(selectedMeetingForFollowUp.fresh_lead_id), 
        }
        await createRejected(payload);
         await getProcessFollowup(leadId);
           loadMeetings();
        
         Swal.fire({ icon: "success", title: "Lead Moved to Rejected Leads" });
          setTimeout(() => {
   navigate("/process/process-follow-up"); // Replace the current URL with the new one
  }, 1000);
      }
        else {
          return; // Do nothing for other types; handled by specific buttons
        }
  
       
      } catch (err) {
        console.error("Follow-up Action Error:", err);
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: "Something went wrong. Please try again.",
        });
      }
    };
  return (
    <div className="task-management-container">
      {loading && <LoadingSpinner text="Loading Process Meetings..." />}

      <div className="task-management-wrapper">
        <header className="pp-page__head">
          <div>
            <h1 className="pp-page__title">Scheduled Meetings</h1>
            <p className="pp-page__sub">{loading ? "Loading…" : meetings.length + " meeting" + (meetings.length === 1 ? "" : "s") + " · " + rangeLabel()}</p>
          </div>
        </header>

        <div className="pp-toolbar">
          <div className="pp-chips" role="group" aria-label="Meeting view">
            {["today", "week", "month"].map((key) => (
              <button key={key} type="button" className={"pp-chip " + (activeFilter === key ? "is-active" : "")} aria-pressed={activeFilter === key} onClick={() => setActiveFilter(key)}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <div className="pp-datenav">
            <button type="button" className="pp-btn" onClick={() => shift(-1)} aria-label="Previous"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <button type="button" className="pp-btn" onClick={() => setAnchor(new Date())}>Today</button>
            <button type="button" className="pp-btn" onClick={() => shift(1)} aria-label="Next"><FontAwesomeIcon icon={faChevronRight} /></button>
          </div>
          <div className="pp-search">
            <FontAwesomeIcon icon={faSearch} className="pp-search__icon" />
            <input type="search" className="pp-search__input" placeholder="Search client, email, phone or reason" aria-label="Search meetings" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <ul className="meetings-list">
          {meetings.length > 0 ? (
            meetings.map((m) => (
              <ProcessMeetingItem
                key={m.id}
                meeting={m}
                onAddFollowUp={() => setSelectedMeetingForFollowUp(m)}
                onShowHistory={() => handleShowHistory(m)}
              />
            ))
          ) : (
            <li className="pp-empty">
              <h3>{loading ? "Loading meetings…" : "No meetings in this period"}</h3>
              {!loading && <p>Try another day, week or month, or clear the search.</p>}
            </li>
          )}
        </ul>
      </div>

      {/* Follow-Up Modal */}
      {selectedMeetingForFollowUp && (
        <div className="followup-form-overlay">
          <div className="followup-form-modal">
            <div className="followup-form-header">
              <h3>Add Follow-Up for {selectedMeetingForFollowUp.clientName || "Unnamed Client"}</h3>
              <button className="close-form-btn" onClick={() => setSelectedMeetingForFollowUp(null)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="create-followup-container" style={{cursor:"pointer"}}>
              <div style={{ margin: "20px" }}>
                <label>Reason for Followup</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Reason for followup"
                  rows="4"
                  style={{ width: "100%", marginTop: "5px",padding:"20px" }}
                />
              </div>
              <h4 style={{ margin: "20px" }}>Connected Via</h4>
<div className="radio-group"  style={{cursor:"pointer"}}>
  {["Call", "Email", "Call/Email"].map((method) => (
    <label key={method} style={{ marginRight: "15px" }}>
      <input
        type="radio"
        name="contactMethod"
        value={method}
        checked={contactMethod === method}
        onChange={() => setContactMethod(method)}
      />
      {method}
    </label>
  ))}
</div>

<h4 style={{ margin: "20px" }}>Follow-Up Type</h4>
<div className="radio-group"  style={{cursor:"pointer"}}>
  {["document collection", "payment follow-up", "visa filing", "other", "meeting","rejected","final"].map((type) => (
    <label key={type} style={{ marginRight: "15px" }}>
      <input
        type="radio"
        name="followUpType"
        value={type}
        checked={followUpType === type}
        onChange={() => setFollowUpType(type)}
      />
      {type}
    </label>
  ))}
</div>
          {followUpType === "document collection" && (
  <div className="doc-dropdown" style={{ marginBottom: "20px",cursor:"ponter" }}>
  <label style={{marginTop:"20px",fontWeight:"700"}}>Select Document:</label>
  <select
    value={docName}
    onChange={(e) => setDocName(e.target.value)}
    style={{ padding: "8px", borderRadius: "5px", width: "50%", cursor: "pointer", display: "block", marginTop: "8px" }}
  >
    <option value="">Select Document</option>
    <option value="aadharcard">Aadhar Card</option>
    <option value="pancard">Pan Card</option>
    <option value="10th">10th Marksheet</option>
    <option value="12th">12th Marksheet</option>
    <option value="passport">Passport</option>
    <option value="other">Other</option>
  </select>

  {docName === "other" && (
    <input
      type="text"
      placeholder="Enter custom document name"
      value={docName}
      onChange={(e) => setDocName(e.target.value)}
      style={{
        marginTop: "10px",
        padding: "8px",
        borderRadius: "5px",
        width: "50%",
        border: "1px solid #ccc",
        display: "block",
      }}
    />
  )}
</div>


  )}
<h4 style={{ margin: "20px" }}>Interaction Rating</h4>
<div className="radio-group"  style={{cursor:"pointer"}}>
  {["Aggressive", "Calm", "Neutral"].map((rating) => (
    <label key={rating} style={{ marginRight: "15px" }}>
      <input
        type="radio"
        name="interactionRating"
        value={rating}
        checked={interactionRating === rating}
        onChange={() => setInteractionRating(rating)}
      />
      {rating}
    </label>
  ))}
</div>

<h4 style={{ margin: "20px" }}>Interaction Date & Time</h4>
<div style={{ display: "flex", alignItems: "center", gap: "20px", margin: "10px" }}>
  <div>
    <label style={{ marginRight: "5px" }}>Date:</label>
    <input
      type="date"
      value={interactionDate}
      onChange={(e) => setInteractionDate(e.target.value)}
    />
  </div>

  <div>
    <label style={{ marginRight: "5px" }}>Time:</label>
    <input
      type="time"
      value={interactionTime}
      onChange={(e) => setInteractionTime(e.target.value)}
    />
  </div>
</div>

              

      {followUpType === "rejected" && <RejectionKindPicker value={rejectionKind} onChange={setRejectionKind} />}
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "20px" }}>
  <button
    onClick={
      followUpType === "meeting"
        ? handleCreateMeeting
        : followUpType === "rejected" || followUpType === "final"
        ? handleFollowUpAction
        : handleCreateFollowUp
    }
    style={{
      backgroundColor: "#4CAF50",
      color: "white",
      padding: "10px 18px",
      border: "none",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      transition: "background-color 0.3s ease",
    }}
    onMouseOver={(e) => (e.target.style.backgroundColor = "#45a049")}
    onMouseOut={(e) => (e.target.style.backgroundColor = "#4CAF50")}
  >
    {followUpType === "meeting"
      ? "Update Meeting"
      : followUpType === "rejected"
      ? "Rejected Leads"
      : followUpType === "final"
      ? "Final Stage Leads"
      : "Create Follow-Up"}
  </button>
</div>



            </div>
          </div>
        </div>
      )}
{selectedMeetingForHistory && (
  <div className="followup-history-overlay">
    <div className="followup-history-modal">
      <div className="followup-history-header">
        <div className="header-content">
          <div className="client-info">
            <div className="client-avatar">
              <FontAwesomeIcon icon={faUser} />
            </div>
            <div className="client-details">
              <h3>{selectedMeetingForHistory.clientName || "Unnamed Client"}</h3>
              <p className="subtitle">Follow-up History</p>
            </div>
          </div>
          <button
            className="close-history-btn"
            onClick={() => {
              setSelectedMeetingForHistory(null);
              setFollowUpHistoryList([]);
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>

      <div className="followup-history-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading follow-up history...</p>
          </div>
        ) : followUpHistoryList.length > 0 ? (
          <div className="history-timeline">
            {followUpHistoryList.map((history, index) => (
              <div key={history.id || index} className="timeline-item">
                <div className="timeline-marker">
                  <div className="timeline-dot">
                    <FontAwesomeIcon icon={faStar} className="history-icon" />
                  </div>
                </div>

                <div className="timeline-content">
                  <div className="history-card">
                    <div className="card-header">
                      <div className="date-time-info">
                        <div className="main-date">
                          <FontAwesomeIcon icon={faCalendarAlt} />
                          <span>
                            {new Date(history.follow_up_date || history.created_at).toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {history.follow_up_time && (
                          <div className="time-info">
                            <FontAwesomeIcon icon={farClockRegular} />
                            <span>
                              {(() => {
                                const [h, m] = history.follow_up_time.split(":");
                                let hour = parseInt(h);
                                const ampm = hour >= 12 ? "PM" : "AM";
                                hour = hour % 12 || 12;
                                return `${hour}:${m} ${ampm}`;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                      {index === 0 && (
                        <div className="latest-badge">
                          <span>Latest</span>
                        </div>
                      )}
                    </div>

                    <div className="card-content">
                      <div className="interaction-tags">
                        {history.connect_via && (
                          <div className="tag connect-via-tag">
                            <FontAwesomeIcon
                              icon={
                                history.connect_via === "call"
                                  ? faPhone
                                  : history.connect_via === "email"
                                  ? faEnvelope
                                  : history.connect_via === "video"
                                  ? faVideo
                                  : faComments
                              }
                            />
                            <span>{history.connect_via}</span>
                          </div>
                        )}

                        {history.follow_up_type && (
                          <div className="tag follow-up-type-tag">
                            <span>{history.follow_up_type}</span>
                          </div>
                        )}

                        {history.interaction_rating && (
                          <div
                            className={`tag rating-tag ${
                              history.interaction_rating.toLowerCase() === "hot"
                                ? "rating-hot"
                                : history.interaction_rating.toLowerCase() === "warm"
                                ? "rating-warm"
                                : history.interaction_rating.toLowerCase() === "cold"
                                ? "rating-cold"
                                : "rating-neutral"
                            }`}
                          >
                            <FontAwesomeIcon icon={faStar} />
                            <span>{history.interaction_rating}</span>
                          </div>
                        )}
                      </div>

                      <div className="follow-up-reason">
                        <h4>Follow-Up Reason</h4>
                        <p>{history.comments || "No comments provided"}</p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-history">
            <div className="empty-state">
              <FontAwesomeIcon icon={faHistory} className="empty-icon" />
              <h4>No Follow-up History</h4>
              <p>No follow-up history available for this client.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default ProcessScheduleMeeting;
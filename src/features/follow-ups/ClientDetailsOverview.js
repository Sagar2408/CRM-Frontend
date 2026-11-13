import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApi } from "../../context/ApiContext";
import Swal from "sweetalert2";
import useCopyNotification from "../../hooks/useCopyNotification";
import { STATUS_LABELS } from "./FollowUpWorkspace";
import "../../styles/followUpWorkspace.css";

const CONTACT_METHODS = ["Call", "Email", "Call/Email"];
const FOLLOW_UP_TYPES = ["interested", "appointment", "no response", "converted", "not interested", "close"];
const RATINGS = ["hot", "warm", "cold"];

const CLIENT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "altPhone", label: "Alt phone" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Experience" },
  { key: "state", label: "State" },
  { key: "dob", label: "Date of birth" },
  { key: "country", label: "Country" },
];

function convertTo24HrFormat(timeStr) {
  const dateObj = new Date(`1970-01-01 ${timeStr}`);
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "");
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const errText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

// Follow-up editor for one lead: lead details, full history, and the form that
// records the interaction (type, status, rating, notes, next reminder). All
// existing workflows are kept: update follow-up (+ history entry), schedule a
// reminder notification, create a meeting, convert, and close.
const ClientDetailsOverview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    fetchFollowUpHistoriesAPI,
    updateFollowUp,
    createConvertedClientAPI,
    createCloseLeadAPI,
    createMeetingAPI,
    fetchFreshLeadsAPI,
    fetchMeetings,
    refreshMeetings,
    followUpLoading,
    createFollowUpHistoryAPI,
    executiveInfo,
    fetchNotifications,
    createCopyNotification,
    scheduleFollowUpNotificationAPI,
  } = useApi();

  useCopyNotification(createCopyNotification, fetchNotifications);
  const client = useMemo(() => location.state?.client || {}, [location.state?.client]);

  const now = useMemo(() => new Date(), []);
  const todayStr = now.toISOString().split("T")[0];
  const maxDate = useMemo(() => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().split("T")[0];
  }, [now]);

  const [clientInfo, setClientInfo] = useState(client);
  const [contactMethod, setContactMethod] = useState("");
  const [followUpType, setFollowUpType] = useState("");
  const [interactionRating, setInteractionRating] = useState("");
  const [reasonDesc, setReasonDesc] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [reminderTime, setReminderTime] = useState(hhmm(now));
  const [interactionDate, setInteractionDate] = useState(todayStr);
  const [timeOnly, setTimeOnly] = useState(hhmm(now));
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (interactionDate === new Date().toISOString().split("T")[0]) setTimeOnly(hhmm(new Date()));
  }, [interactionDate]);

  const interactionTime = useMemo(() => `${timeOnly}:00`, [timeOnly]);

  // Speech-to-text for the notes field.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return undefined;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setReasonDesc((prev) => `${prev} ${transcript}`.trim());
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      Swal.fire({ icon: "error", title: "Speech error", text: `Speech recognition error: ${event.error}` });
    };
    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (_) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch (_) {
        /* not started */
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      Swal.fire({
        icon: "info",
        title: "Voice input unavailable",
        text: "Speech recognition is not supported in this browser. Please use a supported browser such as Google Chrome.",
      });
      return;
    }
    if (isListening) {
      setIsListening(false);
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  };

  const populateFormWithHistory = (history) => {
    setContactMethod(history.connect_via?.toLowerCase() || "");
    setFollowUpType(history.follow_up_type || "");
    setInteractionRating(history.interaction_rating?.toLowerCase() || "");
    setReasonDesc(history.reason_for_follow_up || "");
    setInteractionDate(history.follow_up_date || "");
    const [hour = "12", minute = "00"] = (history.follow_up_time || "12:00:00").split(":");
    setTimeOnly(`${hour}:${minute}`);
  };

  const loadFollowUpHistories = useCallback(
    async (freshLeadId) => {
      if (!freshLeadId) return;
      setIsLoading(true);
      try {
        const response = await fetchFollowUpHistoriesAPI();
        if (Array.isArray(response)) {
          const mine = response
            .filter((history) => history.fresh_lead_id === freshLeadId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setHistories(mine);
          if (mine.length > 0) populateFormWithHistory(mine[0]);
        } else {
          setHistories([]);
        }
      } catch (error) {
        console.error("Error fetching follow-up histories:", error);
        setHistories([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchFollowUpHistoriesAPI]
  );

  useEffect(() => {
    if (!client || !Object.keys(client).length) {
      setIsLoading(false);
      return;
    }
    const freshLeadId = client.freshLead?.id || client.fresh_lead_id || client.id;
    setClientInfo({
      ...client,
      ...(client.freshLead || {}),
      fresh_lead_id: freshLeadId,
      followUpId: client.followUpId || client.id,
    });
    loadFollowUpHistories(freshLeadId);
  }, [client, loadFollowUpHistories]);

  const handleChange = (field, value) => setClientInfo((prev) => ({ ...prev, [field]: value }));

  const freshLeadIdOf = () => clientInfo.fresh_lead_id || clientInfo.freshLeadId || clientInfo.id;

  const historyPayload = (freshLeadId) => ({
    connect_via: capitalize(contactMethod),
    follow_up_type: followUpType,
    interaction_rating: capitalize(interactionRating),
    reason_for_follow_up: reasonDesc,
    follow_up_date: interactionDate,
    follow_up_time: convertTo24HrFormat(interactionTime),
    fresh_lead_id: freshLeadId,
  });

  const validateForm = () => {
    if (!contactMethod) return "Choose how you connected (Call, Email or Call/Email).";
    if (!followUpType) return "Choose the follow-up status.";
    if (!interactionRating) return "Choose the interaction rating.";
    if (!reasonDesc.trim()) return "Add notes about this interaction.";
    if (!interactionDate) return "Choose a date.";
    return null;
  };

  const updateFollowUpDetails = async (freshLeadId, followUpId) => {
    const payload = historyPayload(freshLeadId);
    await updateFollowUp(followUpId, payload);
    // A new history entry records this version of the follow-up.
    await createFollowUpHistoryAPI({ follow_up_id: followUpId, ...payload });
  };

  const refreshAfterSave = async (freshLeadId) => {
    await fetchFreshLeadsAPI();
    await fetchMeetings();
    await refreshMeetings();
    loadFollowUpHistories(freshLeadId);
    setTimeout(() => navigate("/executive/follow-up"), 800);
  };

  const failure = (err, title = "Failed") =>
    Swal.fire({ icon: "error", title, text: errText(err, "Something went wrong. Please try again.") });

  const handleScheduleReminder = async () => {
    const freshLeadId = freshLeadIdOf();
    if (!freshLeadId || !clientInfo.name || !interactionDate || !reminderTime) {
      return Swal.fire({
        icon: "error",
        title: "Missing information",
        text: "Please ensure the client name, date and reminder time are filled.",
      });
    }
    try {
      const userId = executiveInfo?.id;
      if (!userId) throw new Error("User ID not found.");
      await scheduleFollowUpNotificationAPI({
        userId,
        clientName: clientInfo.name,
        date: interactionDate,
        time: convertTo24HrFormat(reminderTime),
        targetRole: "executive",
      });
      Swal.fire({
        icon: "success",
        title: "Reminder scheduled",
        text: `Follow-up reminder for ${clientInfo.name} has been scheduled.`,
      });
      await fetchNotifications({ userId, userRole: "executive" });
    } catch (error) {
      console.error("Error scheduling reminder:", error);
      failure(error, "Failed to schedule reminder");
    }
  };

  const handleUpdateFollowUp = async () => {
    const freshLeadId = freshLeadIdOf();
    if (!freshLeadId) {
      return Swal.fire({ icon: "error", title: "Missing lead", text: "Unable to find the lead. Please reload and try again." });
    }
    const problem = validateForm();
    if (problem) return Swal.fire({ icon: "warning", title: "Incomplete", text: problem });
    try {
      await updateFollowUpDetails(freshLeadId, clientInfo.followUpId || clientInfo.id);
      Swal.fire({ icon: "success", title: "Follow-up updated" });
      await refreshAfterSave(freshLeadId);
    } catch (err) {
      console.error("Follow-Up Update Error:", err);
      failure(err);
    }
  };

  const handleCreateMeeting = async () => {
    const freshLeadId = freshLeadIdOf();
    if (!freshLeadId) {
      return Swal.fire({ icon: "error", title: "Missing lead", text: "Unable to find the lead. Please reload and try again." });
    }
    const problem = validateForm();
    if (problem) return Swal.fire({ icon: "warning", title: "Incomplete", text: problem });

    try {
      await updateFollowUpDetails(freshLeadId, clientInfo.followUpId || clientInfo.id);
      await createMeetingAPI({
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        reasonForFollowup: reasonDesc,
        startTime: new Date(`${interactionDate}T${convertTo24HrFormat(interactionTime)}`).toISOString(),
        endTime: null,
        fresh_lead_id: freshLeadId,
      });
      Swal.fire({ icon: "success", title: "Meeting created" });
      await refreshAfterSave(freshLeadId);
    } catch (err) {
      console.error("Meeting Creation Error:", err);
      failure(err, "Meeting not created");
    }
  };

  const handleFollowUpAction = async () => {
    const freshLeadId = freshLeadIdOf();
    if (!freshLeadId) {
      return Swal.fire({ icon: "error", title: "Missing lead", text: "Unable to find the lead. Please reload and try again." });
    }
    if (followUpType !== "converted" && followUpType !== "close") return;
    const problem = validateForm();
    if (problem) return Swal.fire({ icon: "warning", title: "Incomplete", text: problem });

    try {
      if (followUpType === "converted") await createConvertedClientAPI({ fresh_lead_id: freshLeadId });
      else await createCloseLeadAPI({ fresh_lead_id: freshLeadId });
      await createFollowUpHistoryAPI({ follow_up_id: clientInfo.followUpId || clientInfo.id, ...historyPayload(freshLeadId) });
      Swal.fire({ icon: "success", title: followUpType === "converted" ? "Client converted" : "Lead closed" });
      await refreshAfterSave(freshLeadId);
    } catch (err) {
      console.error("Follow-up Action Error:", err);
      failure(err);
    }
  };

  const isMeetingInPast = useMemo(() => {
    if (followUpType !== "appointment" || !interactionDate || !interactionTime) return false;
    return new Date(`${interactionDate}T${interactionTime}`) < new Date();
  }, [followUpType, interactionDate, interactionTime]);

  if (!Object.keys(client).length) {
    return (
      <div className="fue">
        <div className="fue__card">
          <p>No lead selected. Open a lead from the Follow-ups page to update it.</p>
          <button type="button" className="fue__back" onClick={() => navigate("/executive/follow-up")}>
            Back to follow-ups
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fue">
      <div className="fue__top">
        <button type="button" className="fue__back" onClick={() => navigate("/executive/follow-up")}>
          &larr; Back
        </button>
        <h2>Update follow-up &middot; {clientInfo.name || "Lead"}</h2>
      </div>

      <div className="fue__cols">
        <div className="fue__card">
          <h3>Lead details</h3>
          <div className="fue__fields">
            {CLIENT_FIELDS.map(({ key, label }) => (
              <label className="fue__field" key={key}>
                {label}
                <input type="text" value={clientInfo[key] || ""} onChange={(e) => handleChange(key, e.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <div className="fue__card">
          <h3>Follow-up history</h3>
          {isLoading ? (
            <p>Loading follow-up history...</p>
          ) : histories.length === 0 ? (
            <p>No follow-up history available.</p>
          ) : (
            <div className="fue__history">
              {histories.map((h, i) => (
                <div key={h.id ?? i} className={`fue__entry ${i === 0 ? "is-latest" : ""}`}>
                  <div className="fue__entry-top">
                    <strong>{STATUS_LABELS[h.follow_up_type] || h.follow_up_type}</strong>
                    {i === 0 && <span className="fuw__chip fuw__chip--latest">Latest</span>}
                    <span className="fuw__chip">{h.connect_via || "Call"}</span>
                    {h.interaction_rating && (
                      <span className={`fuw__chip fuw__chip--${h.interaction_rating.toLowerCase()}`}>{h.interaction_rating}</span>
                    )}
                    <time dateTime={h.createdAt}>
                      {new Date(h.createdAt).toLocaleDateString()}{" "}
                      {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                  <p>{h.reason_for_follow_up || "No notes."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fue__card">
        <h3>Record this interaction</h3>

        <div className="fue__group">
          <h4>Interaction type (connected via)</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Connected via">
            {CONTACT_METHODS.map((method) => (
              <label key={method} className={`fue__choice ${contactMethod === method.toLowerCase() || contactMethod === method ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="contactMethod"
                  checked={contactMethod.toLowerCase() === method.toLowerCase()}
                  onChange={() => setContactMethod(method)}
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        <div className="fue__group">
          <h4>Status</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Follow-up status">
            {FOLLOW_UP_TYPES.map((type) => (
              <label key={type} className={`fue__choice ${followUpType === type ? "is-selected" : ""}`}>
                <input type="radio" name="followUpType" checked={followUpType === type} onChange={() => setFollowUpType(type)} />
                {STATUS_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        <div className="fue__group">
          <h4>Rating</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Interaction rating">
            {RATINGS.map((rating) => (
              <label key={rating} className={`fue__choice ${interactionRating === rating ? "is-selected" : ""}`}>
                <input type="radio" name="interactionRating" checked={interactionRating === rating} onChange={() => setInteractionRating(rating)} />
                {capitalize(rating)}
              </label>
            ))}
          </div>
        </div>

        <div className="fue__group">
          <label className="fue__field">
            Notes
            <textarea
              value={reasonDesc}
              onChange={(e) => setReasonDesc(e.target.value)}
              placeholder="What was discussed, what the client needs next..."
            />
          </label>
          <button type="button" className={`fue__mic ${isListening ? "is-live" : ""}`} onClick={toggleListening} aria-pressed={isListening}>
            {isListening ? "Stop dictation" : "Dictate notes"}
          </button>
        </div>

        <div className="fue__group fue__row">
          <label className="fue__field">
            Date
            <input type="date" value={interactionDate} min={todayStr} max={maxDate} onChange={(e) => setInteractionDate(e.target.value)} />
          </label>
          <label className="fue__field">
            Time
            <input type="time" value={timeOnly} onChange={(e) => setTimeOnly(e.target.value)} />
          </label>
          <div className="fue__reminder">
            <label className="fue__field">
              Reminder time
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
            </label>
            <button type="button" className="fue__back" onClick={handleScheduleReminder}>
              Set reminder
            </button>
          </div>
        </div>
      </div>

      {followUpType === "appointment" && isMeetingInPast && (
        <div className="fue__warn" role="alert">
          Please select a <strong>future date or time</strong> to schedule the meeting.
        </div>
      )}

      <div className="fue__actions">
        <button type="button" onClick={handleUpdateFollowUp} className="fue__btn fue__btn--save" disabled={followUpLoading}>
          {followUpLoading ? "Processing..." : "Update follow-up"}
        </button>
        {followUpType === "converted" && (
          <button type="button" onClick={handleFollowUpAction} className="fue__btn fue__btn--convert" disabled={followUpLoading}>
            Create converted
          </button>
        )}
        {followUpType === "close" && (
          <button type="button" onClick={handleFollowUpAction} className="fue__btn fue__btn--close" disabled={followUpLoading}>
            Create close
          </button>
        )}
        {followUpType === "appointment" && (
          <button type="button" onClick={handleCreateMeeting} className="fue__btn fue__btn--meeting" disabled={followUpLoading || isMeetingInPast}>
            Create meeting
          </button>
        )}
      </div>
    </div>
  );
};

export default ClientDetailsOverview;

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../context/ApiContext";
import Swal from "sweetalert2";
import useCopyNotification from "../../hooks/useCopyNotification";
import "../../styles/followUpWorkspace.css";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import EmailIcon from "@mui/icons-material/Email";
import CallMadeIcon from "@mui/icons-material/CallMade";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WbSunnyIcon from "@mui/icons-material/WbSunny";

function convertTo24HrFormat(timeStr) {
  const dateObj = new Date(`1970-01-01 ${timeStr}`);
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  const seconds = "00";
  return `${hours}:${minutes}:${seconds}`;
}

const ClientOverview = () => {
  const { clientId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    updateFreshLeadFollowUp,
    createFollowUp,
    followUpLoading,
    createMeetingAPI,
    fetchFreshLeads,
    executiveInfo,
    fetchNotifications,
    createCopyNotification,
    createFollowUpHistoryAPI,
    createConvertedClientAPI,
    createCloseLeadAPI,
    updateClientLead,
    scheduleFollowUpNotificationAPI,
  } = useApi();

  useCopyNotification(createCopyNotification, fetchNotifications);

  const getCurrentTime24Hour = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    return `${currentHour.toString().padStart(2, "0")}:${currentMinute
      .toString()
      .padStart(2, "0")}`;
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const hour12 = currentHour % 12 || 12;
  const currentTime12Hour = `${hour12
    .toString()
    .padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
  const [clientInfo, setClientInfo] = useState(location.state?.client || {});
  const [contactMethod, setContactMethod] = useState("");
  const [followUpType, setFollowUpType] = useState("");
  const [interactionRating, setInteractionRating] = useState("");
  const [reasonDesc, setReasonDesc] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interactionDate, setInteractionDate] = useState(todayStr);
  const [timeOnly, setTimeOnly] = useState(currentTime12Hour);
  const [isSaving, setIsSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // One submit at a time: a double click can no longer create two follow-ups / meetings.
  const runSubmit = async (fn) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  };
  const [reminderTime, setReminderTime] = useState(getCurrentTime24Hour());

  const contactIcons = {
    Call: <CallRoundedIcon fontSize="small" />,
    Email: <EmailIcon fontSize="small" />,
    "Call/Email": <CallMadeIcon fontSize="small" />,
  };

  const followUpIcons = {
    interested: <ThumbUpAltIcon fontSize="small" />,
    appointment: <EventAvailableIcon fontSize="small" />,
    "no response": <PersonOffIcon fontSize="small" />,
    converted: <CheckCircleIcon fontSize="small" />,
    "not interested": (
      <ThumbDownIcon fontSize="small" style={{ marginTop: 4 }} />
    ),
    close: <LockPersonIcon fontSize="small" />,
  };

  const ratingIcons = {
    hot: <LocalFireDepartmentIcon fontSize="small" />,
    warm: <WbSunnyIcon fontSize="small" />,
    cold: <AcUnitIcon fontSize="small" />,
  };

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(isListening);

  const minDate = todayStr;
  const maxDate = (() => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().split("T")[0];
  })();

  const clientFields = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "altPhone", label: "Alt Phone" },
    { key: "education", label: "Education" },
    { key: "experience", label: "Experience" },
    { key: "state", label: "State" },
    { key: "dob", label: "Date of Birth" },
    { key: "country", label: "Country" },
  ];

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript =
          event.results[event.results.length - 1][0].transcript;
        setReasonDesc((prev) => `${prev} ${transcript}`);
      };

      recognition.onerror = (event) => {
        Swal.fire({
          icon: "error",
          title: "Speech Error",
          text: `Speech recognition error: ${event.error}`,
        });
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          recognition.start();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (interactionDate === todayStr) {
      setTimeOnly(getCurrentTime24Hour());
    }
  }, [interactionDate, todayStr]);

  const handleUseCurrentTime = () => {
    setTimeOnly(getCurrentTime24Hour());
  };

  const interactionTime = useMemo(() => {
    return `${timeOnly}:00`;
  }, [timeOnly]);

  const handleChange = (field, value) => {
    setClientInfo((prev) => ({ ...prev, [field]: value }));
  };

  const capitalize = (text) => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const [followUpHistory, setFollowUpHistory] = useState([]);

  useEffect(() => {
    if (location.state?.followUpHistory?.length) {
      setFollowUpHistory(location.state.followUpHistory);
    }
  }, [location.state]);

  const handleSaveClientDetails = async () => {
    if (!clientId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Client ID",
        text: "Unable to save client details without a valid client ID.",
      });
    }

    setIsSaving(true);
    try {
      const updateFields = {
        name: clientInfo.name || "",
        email: clientInfo.email || "",
        phone: clientInfo.phone || "",
        altPhone: clientInfo.altPhone || "",
        education: clientInfo.education || "",
        experience: clientInfo.experience || "",
        state: clientInfo.state || "",
        dob: clientInfo.dob || "",
        country: clientInfo.country || "",
      };

      await updateClientLead(clientId, updateFields);
      await Swal.fire({
        icon: "success",
        title: "Client Updated",
        text: "Client details have been updated successfully!",
      });
    } catch (error) {
      console.error("❌ Error updating client details:", error);
      await Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: "Failed to update client details. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextUpdate = async () => {
    if (!followUpType || !interactionDate || !interactionTime) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please select a follow-up type, date and time before updating.",
      });
    }

    const freshLeadId = clientInfo.freshLeadId || clientInfo.id;
    if (!freshLeadId) {
      console.error("Missing fresh lead ID on clientInfo:", clientInfo);
      return Swal.fire({
        icon: "error",
        title: "Missing Record ID",
        text: "Unable to find the record to update. Please reload and try again.",
      });
    }

    try {
      let followUpId = clientInfo.followUpId;

      if (!followUpId) {
        const newFollowUpData = {
          connect_via: capitalize(contactMethod),
          follow_up_type: followUpType,
          interaction_rating: capitalize(interactionRating),
          reason_for_follow_up: reasonDesc,
          follow_up_date: interactionDate,
          follow_up_time: convertTo24HrFormat(interactionTime),
          fresh_lead_id: freshLeadId,
        };

        const followUpResponse = await createFollowUp(newFollowUpData);
        followUpId =
          followUpResponse?.id ||
          followUpResponse?.data?.id ||
          followUpResponse?.followUp?.id ||
          followUpResponse?.data?.followUp?.id;

        if (!followUpId) {
          console.error(
            "Failed to get follow-up ID from response:",
            followUpResponse
          );
          throw new Error("Missing follow-up ID in response");
        }
      }

      const followUpHistoryPayload = {
        follow_up_id: followUpId,
        connect_via: capitalize(contactMethod),
        follow_up_type: followUpType,
        interaction_rating: capitalize(interactionRating),
        reason_for_follow_up: reasonDesc,
        follow_up_date: interactionDate,
        follow_up_time: convertTo24HrFormat(interactionTime),
        fresh_lead_id: freshLeadId,
      };

      if (followUpType === "appointment") {
        const meetingPayload = {
          clientName: clientInfo.name,
          clientEmail: clientInfo.email,
          clientPhone: clientInfo.phone,
          reasonForFollowup: reasonDesc,
          startTime: new Date(
            `${interactionDate}T${interactionTime}`
          ).toISOString(),
          endTime: null,
          fresh_lead_id: freshLeadId,
        };
        await createMeetingAPI(meetingPayload);
        await createFollowUpHistoryAPI(followUpHistoryPayload);

        await Swal.fire({
          icon: "success",
          title: "Appointment Created",
          text: "Appointment created and lead moved to Meeting",
        });

        setTimeout(() => navigate("/executive/freshlead"), 1000);
        return;
      } else if (followUpType === "converted") {
        await createConvertedClientAPI({ fresh_lead_id: freshLeadId });
        await createFollowUpHistoryAPI(followUpHistoryPayload);
        await Swal.fire({
          icon: "success",
          title: "Client Converted",
          text: "Lead has been converted successfully!",
        });
        try {
          await fetchFreshLeads();
        } catch (fetchError) {
          console.warn(
            "Warning: Failed to fetch fresh leads after conversion:",
            fetchError
          );
        }
        setTimeout(() => navigate("/executive/freshlead"), 1000);
        return;
      } else if (followUpType === "close") {
        await createCloseLeadAPI({ fresh_lead_id: freshLeadId });
        await createFollowUpHistoryAPI(followUpHistoryPayload);
        await Swal.fire({
          icon: "success",
          title: "Lead Closed",
          text: "Lead has been closed successfully!",
        });
        try {
          await fetchFreshLeads();
        } catch (fetchError) {
          console.warn(
            "Warning: Failed to fetch fresh leads after closing:",
            fetchError
          );
        }
        setTimeout(() => navigate("/executive/freshlead"), 1000);
        return;
      } else {
        const updatedData = {
          followUpStatus: followUpType,
          followUpDate: interactionDate,
        };

        await updateFreshLeadFollowUp(freshLeadId, updatedData);
        await createFollowUpHistoryAPI(followUpHistoryPayload);

        await Swal.fire({
          icon: "success",
          title: "Follow-up Updated",
          text: "Follow-up status updated successfully",
        });

        try {
          await fetchFreshLeads();
        } catch (fetchError) {
          console.warn(
            "Warning: Failed to fetch fresh leads after update:",
            fetchError
          );
        }
        setTimeout(() => navigate("/executive/freshlead"), 2000);
      }

      setFollowUpType("");
      setInteractionDate("");
      setTimeOnly("12:00");
      setReasonDesc("");
      setContactMethod("");
      setInteractionRating("");
    } catch (error) {
      console.error("Error in handleTextUpdate:", error);
      await Swal.fire({
        icon: "error",
        title: "Operation Failed",
        text: error.response?.data?.message || "Something went wrong. Please try again.",
      });
    }
  };

  const handleScheduleReminder = async () => {
    const freshLeadId =
      clientInfo.fresh_lead_id || clientInfo.freshLeadId || clientInfo.id;

    if (!freshLeadId || !clientInfo.name || !interactionDate || !reminderTime) {
      return Swal.fire({
        icon: "error",
        title: "Missing Information",
        text: "Please ensure all required fields (client name, date, and time) are filled.",
      });
    }

    try {
      const userId = executiveInfo?.id;
      if (!userId) {
        throw new Error("User ID not found.");
      }

      await scheduleFollowUpNotificationAPI({
        userId,
        clientName: clientInfo.name,
        date: interactionDate,
        time: convertTo24HrFormat(reminderTime),
        targetRole: "executive",
      });

      Swal.fire({
        icon: "success",
        title: "Reminder Scheduled",
        text: `Follow-up reminder for ${clientInfo.name} has been scheduled.`,
      });

      await fetchNotifications({ userId, userRole: "executive" });
    } catch (error) {
      console.error("Error scheduling reminder:", error);
      Swal.fire({
        icon: "error",
        title: "Failed to Schedule Reminder",
        text: error.message || "Something went wrong. Please try again.",
      });
    }
  };

  const handleCreateFollowUp = async () => {
    if (
      !contactMethod ||
      !followUpType ||
      !interactionRating ||
      !reasonDesc ||
      !interactionDate ||
      !interactionTime
    ) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill out all required fields before creating follow-up.",
      });
    }

    const freshLeadId = clientInfo.freshLeadId || clientInfo.id;
    if (!freshLeadId) {
      console.error("Missing fresh lead ID on clientInfo:", clientInfo);
      return Swal.fire({
        icon: "error",
        title: "Missing Record ID",
        text: "Unable to find the record to create follow-up. Please reload and try again.",
      });
    }

    const newFollowUpData = {
      connect_via: capitalize(contactMethod),
      follow_up_type: followUpType,
      interaction_rating: capitalize(interactionRating),
      reason_for_follow_up: reasonDesc,
      follow_up_date: interactionDate,
      follow_up_time: convertTo24HrFormat(interactionTime),
      fresh_lead_id: freshLeadId,
    };

    try {
      const response = await createFollowUp(newFollowUpData);
      let followUpId =
        response?.id ||
        response?.data?.id ||
        response?.followUp?.id ||
        response?.data?.followUp?.id;

      if (!followUpId) {
        console.error("Failed to get follow-up ID from response:", response);
        throw new Error("Missing follow-up ID in response");
      }

      const followUpHistoryData = {
        follow_up_id: followUpId,
        connect_via: capitalize(contactMethod),
        follow_up_type: followUpType,
        interaction_rating: capitalize(interactionRating),
        reason_for_follow_up: reasonDesc,
        follow_up_date: interactionDate,
        follow_up_time: convertTo24HrFormat(interactionTime),
        fresh_lead_id: freshLeadId,
      };

      await createFollowUpHistoryAPI(followUpHistoryData);

      Swal.fire({
        icon: "success",
        title: "Follow-up Created",
        text: "Follow-up and history created successfully!",
      });

      setReasonDesc("");
      setContactMethod("");
      setFollowUpType("");
      setInteractionRating("");
      setInteractionDate(todayStr);
      setTimeOnly("12:00");
      setTimeout(() => navigate("/executive/freshlead"), 2000);
    } catch (error) {
      console.error("Error creating Follow-up or history:", error.message, {
        status: error.response?.status,
        url: error.config?.url,
        payload: newFollowUpData,
      });
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: error.response?.data?.message || "Failed to create follow-up or history. Please try again.",
      });
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      return Swal.fire({
        icon: "error",
        title: "Speech Recognition Not Supported",
        text: "Speech recognition is not supported in this browser. Please use a supported browser like Google Chrome.",
      });
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const isMeetingInPast = useMemo(() => {
    if (followUpType !== "appointment" || !interactionDate || !interactionTime)
      return false;
    const selectedDateTime = new Date(`${interactionDate}T${interactionTime}`);
    const now = new Date();
    return selectedDateTime < now;
  }, [followUpType, interactionDate, interactionTime]);

  const missing = [];
  if (!contactMethod) missing.push("how you connected");
  if (!followUpType) missing.push("the status");
  if (!interactionRating) missing.push("a rating");
  if (!reasonDesc.trim()) missing.push("notes");
  const canCreate = missing.length === 0 && !isMeetingInPast;
  const busy = submitting || followUpLoading;
  const isFirstFollowUp = !!location.state?.createFollowUp;
  const contextAction = ["appointment", "converted", "close"].includes(followUpType)
    ? {
        label: followUpType === "appointment" ? "Create meeting" : followUpType === "converted" ? "Convert lead" : "Close lead",
        hint:
          followUpType === "appointment"
            ? "Schedules a meeting for the date and time above and moves the lead to Meeting."
            : followUpType === "converted"
            ? "Moves this lead to Converted clients."
            : "Moves this lead to Closed leads.",
        cls: followUpType === "converted" ? "fue__btn--convert" : followUpType === "close" ? "fue__btn--close" : "fue__btn--meeting",
      }
    : null;

  const choice = (name, value, current, setter, icon, label) => (
    <label key={value} className={`fue__choice ${current === value ? "is-selected" : ""}`}>
      <input type="radio" name={name} checked={current === value} onChange={() => setter(value)} />
      {icon}
      {label}
    </label>
  );

  return (
    <div className="fue">
      <div className="fue__top">
        <button type="button" className="fue__back" onClick={() => navigate("/executive/freshlead")}>
          &larr; Fresh leads
        </button>
        <div>
          <h2>Add follow-up &middot; {clientInfo.name || "Lead"}</h2>
          <p className="fue__sub">
            {[clientInfo.phone, clientInfo.email, clientInfo.country].filter(Boolean).join(" · ") || "Record the first interaction with this lead."}
          </p>
        </div>
      </div>

      <div className="fue__cols">
        <section className="fue__card" aria-labelledby="fue-lead-title">
          <h3 id="fue-lead-title">Lead details</h3>
          <div className="fue__fields">
            {clientFields.map(({ key, label }) => (
              <label className="fue__field" key={key}>
                {label}
                <input type="text" value={clientInfo[key] || ""} onChange={(e) => handleChange(key, e.target.value)} />
              </label>
            ))}
          </div>
          <button type="button" className="fue__btn fue__btn--save fue__btn--block" onClick={handleSaveClientDetails} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save client details"}
          </button>
        </section>

        <section className="fue__card" aria-labelledby="fue-history-title">
          <h3 id="fue-history-title">Follow-up history</h3>
          {followUpHistory.length === 0 ? (
            <p className="fue__empty">No earlier follow-ups. This will be the first interaction recorded for this lead.</p>
          ) : (
            <div className="fue__history">
              {followUpHistory.map((history, index) => (
                <div key={history.id ?? index} className={`fue__entry ${index === 0 ? "is-latest" : ""}`}>
                  <div className="fue__entry-top">
                    <strong>{index === 0 ? "Last follow-up" : "Earlier"}</strong>
                    {history.connect_via && <span className="fuw__chip">{history.connect_via}</span>}
                    {history.interaction_rating && (
                      <span className={`fuw__chip fuw__chip--${String(history.interaction_rating).toLowerCase()}`}>{history.interaction_rating}</span>
                    )}
                    <time>
                      {new Date(history.follow_up_date).toLocaleDateString()} {String(history.follow_up_time || "").slice(0, 5)}
                    </time>
                  </div>
                  <p>{history.reason_for_follow_up || "No notes."}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="fue__card" aria-labelledby="fue-interaction-title">
        <h3 id="fue-interaction-title">Record this interaction</h3>

        <div className="fue__group">
          <h4>How did you connect?</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Connected via">
            {["Call", "Email", "Call/Email"].map((method) => choice("contactMethod", method, contactMethod, setContactMethod, contactIcons[method], method))}
          </div>
        </div>

        <div className="fue__group">
          <h4>Status</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Follow-up status">
            {["interested", "appointment", "no response", "converted", "not interested", "close"].map((type) =>
              choice("followUpType", type, followUpType, setFollowUpType, followUpIcons[type], capitalize(type))
            )}
          </div>
        </div>

        <div className="fue__group">
          <h4>Rating</h4>
          <div className="fue__choices" role="radiogroup" aria-label="Interaction rating">
            {["hot", "warm", "cold"].map((rating) => choice("interactionRating", rating, interactionRating, setInteractionRating, ratingIcons[rating], capitalize(rating)))}
          </div>
        </div>

        <div className="fue__group">
          <label className="fue__field">
            Notes
            <textarea value={reasonDesc} onChange={(e) => setReasonDesc(e.target.value)} placeholder="What was discussed, and what does the client need next?" />
          </label>
          <button type="button" className={`fue__mic ${isListening ? "is-live" : ""}`} onClick={toggleListening} aria-pressed={isListening}>
            {isListening ? "Stop dictation" : "Dictate notes"}
          </button>
        </div>

        <div className="fue__group">
          <h4>{followUpType === "appointment" ? "Meeting date and time" : "Date and time of this follow-up"}</h4>
          <div className="fue__row">
            <label className="fue__field">
              Date
              <input type="date" value={interactionDate} min={minDate} max={maxDate} onChange={(e) => setInteractionDate(e.target.value)} />
            </label>
            <label className="fue__field">
              Time
              <div className="fue__reminder">
                <input type="time" value={timeOnly} onChange={(e) => setTimeOnly(e.target.value)} />
                <button type="button" className="fue__back" onClick={handleUseCurrentTime} title="Use current time">
                  Now
                </button>
              </div>
            </label>
            <div className="fue__reminder">
              <label className="fue__field">
                Remind me at
                <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
              </label>
              <button type="button" className="fue__back" onClick={handleScheduleReminder}>
                Set reminder
              </button>
            </div>
          </div>
          {followUpType === "appointment" && isMeetingInPast && (
            <div className="fue__warn" role="alert">
              Please select a <strong>future date or time</strong> to schedule the meeting.
            </div>
          )}
        </div>
      </section>

      <div className="fue__bar">
        <p className="fue__hint" role="status">
          {missing.length > 0 ? `Still needed: ${missing.join(", ")}.` : contextAction ? contextAction.hint : "Ready to save."}
        </p>
        <div className="fue__actions">
          {contextAction && (
            <button type="button" className={`fue__btn ${contextAction.cls}`} onClick={() => runSubmit(handleTextUpdate)} disabled={busy || !canCreate}>
              {busy ? "Saving..." : contextAction.label}
            </button>
          )}
          {isFirstFollowUp && (
            <button type="button" className="fue__btn fue__btn--save" onClick={() => runSubmit(handleCreateFollowUp)} disabled={busy || !canCreate}>
              {busy ? "Saving..." : "Create follow-up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientOverview;

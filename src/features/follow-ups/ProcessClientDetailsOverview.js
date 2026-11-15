import React, { useState, useEffect,useMemo,useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useProcessService } from "../../context/ProcessServiceContext";
import { useApi } from "../../context/ApiContext";
import { useExecutiveActivity } from "../../context/ExecutiveActivityContext";
import Swal from "sweetalert2";
import useCopyNotification from "../../hooks/useCopyNotification";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";
import SendEmailProcess from '../process-client/SendEmailProcess';
import RejectionKindPicker from '../process-client/RejectionKindPicker';

function convertTo24HrFormat(timeStr) {
  const dateObj = new Date(`1970-01-01 ${timeStr}`);
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

const ProcessClientDetailsOverview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const {createFinalStage,
    getProcessFollowupHistory,
    processCreateFollowUp,
    createMeetingApi,
    createRejected,
    getProcessFollowup,
    getComments,
    createStages,
    getProcessHistory,
    createReminder}=useProcessService();
  const {
    createConvertedClientAPI,
    followUpLoading,
    createFollowUpHistoryAPI,
    fetchNotifications,
    createCopyNotification,
  } = useApi();

  useCopyNotification(createCopyNotification, fetchNotifications);
const client = useMemo(() => location.state?.client || {}, [location.state?.client]);
  
  // Initialize current time properly
   const now = useMemo(() => new Date(), []);
  const todayStr = now.toISOString().split("T")[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const ampmValue = currentHour >= 12 ? "PM" : "AM";
  const hour12 = currentHour % 12 || 12;
  const currentTime12Hour = `${hour12.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
  
  const [clientInfo, setClientInfo] = useState(client);
  const [contactMethod, setContactMethod] = useState("");
  const [followUpType, setFollowUpType] = useState("");
  const [interactionRating, setInteractionRating] = useState("");
  const [reasonDesc, setReasonDesc] = useState("");
  const [rejectionKind, setRejectionKind] = useState("");
  const [interactionDate, setInteractionDate] = useState(todayStr);
  const [timeOnly, setTimeOnly] = useState(currentTime12Hour);
  const [ampm, setAmPm] = useState(ampmValue);
  const [selectedStage, setSelectedStage] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [emailBody, setEmailBody] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [clientEmail, setClientEmail] = useState("");
     const [showToast, setShowToast] = useState(false);
const [docName, setDocName] = useState("");
    const userData = JSON.parse(localStorage.getItem("user"));
const name = userData?.fullName || "";
const email = userData?.email || "";

  // Add time conversion functions
  const convertTo24Hour = (time12h, amPm) => {
    let [hours, minutes] = time12h.split(':').map(Number);
    if (amPm === 'PM' && hours !== 12) hours += 12;
    if (amPm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const convertTo12Hour = (time24h) => {
    let [hours, minutes] = time24h.split(':').map(Number);
    const amPm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return {
      time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      amPm: amPm
    };
  };

  const interactionTime = useMemo(() => {
    let [hr, min] = timeOnly.split(":").map(Number);
    if (ampm === "PM" && hr !== 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    return `${hr.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;
  }, [timeOnly, ampm]);

  // Add date constraints
  const minDate = useMemo(() => todayStr, [todayStr]);
   const maxDate = useMemo(() => {
     const d = new Date(now);
     d.setFullYear(d.getFullYear() + 5);
     return d.toISOString().split("T")[0];
   }, [now]);

  const [ , setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

 const capitalize = (text) => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  useEffect(() => {
    console.log("FollowUp Type Changed:", followUpType);
  }, [followUpType]);

  const clientFields = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "altPhone", label: "Alt Phone" },
    { key: "education", label: "Education" },
    { key: "experience", label: "Experience" },
    { key: "state", label: "State" },
    { key: "dob", label: "DOB" },
    { key: "country", label: "Country" },
    // { key: "assignDate", label: "Assign Date" },
  ];


 const[historyData,setHistoryData]=useState();
  useEffect(() => {
  const fetchFollowups = async () => {
    try {
      const response = await getProcessFollowupHistory(id);
      setHistoryData(response)
      console.log("Raw response:", response);

      const data = Array.isArray(response) ? response : response?.data || [];

      // Ensure types match
      const filteredHistories = data.filter(
        (history) => Number(history.fresh_lead_id) === Number(id)
      );

      console.log("Filtered Histories:", filteredHistories);

      const sortedHistories = [...filteredHistories].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      console.log("Sorted Histories:", sortedHistories);

      if (sortedHistories.length > 0) {
        setHistories([sortedHistories[0]]);
        populateFormWithHistory(sortedHistories[0]);
      } else {
        setHistories([]);
      }
    } catch (err) {
      console.error("❌ Failed to load follow-ups:", err.message);
    }
  };

  fetchFollowups();
}, [id,getProcessFollowupHistory]);


const[followupHistory,setFollowupHistory]=useState();
  useEffect(() => {
  const fetchFollowups = async () => {
    try {
      const response = await getProcessHistory(id);
      setFollowupHistory(response)
      
    } catch (err) {
      console.error("❌ Failed to load follow-ups:", err.message);
    }
  };

  fetchFollowups();
}, [id,getProcessHistory]);

const loadFollowUpHistories = useCallback(async (freshLeadId) => {
  if (!freshLeadId) return;
  setIsLoading(true);
  try {
    const response = await getProcessFollowupHistory(id);
    if (Array.isArray(response)) {
      const filteredHistories = response.filter(
        (history) => history.fresh_lead_id === freshLeadId
      );
      filteredHistories.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setHistories(response.data);
      if (filteredHistories.length > 0) {
        populateFormWithHistory(filteredHistories[0]);
      } else {
        setHistories([]);
      }
    } else {
      setHistories([]);
    }
  } catch (error) {
    console.error("Error fetching follow-up histories:", error);
    setHistories([]);
  } finally {
    setIsLoading(false);
  }
}, [id, getProcessFollowupHistory]);
  useEffect(() => {
    if (client) {
      const freshLeadId =
        client.freshLead?.id || client.fresh_lead_id || client.id;
      const normalizedClient = {
        ...client,
        fresh_lead_id: freshLeadId,
        followUpId: client.followUpId || client.id,
      };
      setClientInfo(normalizedClient);
      loadFollowUpHistories(freshLeadId);
    }
  }, [client,loadFollowUpHistories]);

useEffect(() => {
  if (historyData?.data?.length > 0) {
    const latest = historyData.data[0];
    const freshLead = latest.freshLead || {};

    // Build a new clientInfo object using the keys you expect
    const newClientInfo = {
      name: freshLead.name || "",
      phone: freshLead.phone || "",
      email: freshLead.email || "",
    fresh_lead_id: latest.fresh_lead_id,
      // You can optionally add hardcoded or default fields:
      altPhone: freshLead.lead.clientLead.altPhone||"",
      education:freshLead.lead.clientLead.education || "",
      experience: freshLead.lead.clientLead.experience || "",
      state: freshLead.lead.clientLead.state || "",
      dob: freshLead.lead.clientLead.dob || "",
      country: freshLead.lead.clientLead.country || "",
    };

    setClientInfo(newClientInfo);
  }
}, [historyData]);

  const populateFormWithHistory = (history) => {
      setContactMethod(history.connect_via?.trim() || "");
    setFollowUpType(history.follow_up_type || "");
    setInteractionRating(history.interaction_rating || "");
    setReasonDesc(history.comments || "");
    setInteractionDate(history.follow_up_date || "");
    setDocName(history.document_name || "")
    const [hour, minute] = (history.follow_up_time || "12:00").split(":");
    let hr = parseInt(hour, 10);
    const ampmValue = hr >= 12 ? "PM" : "AM";
    if (hr === 0) hr = 12;
    if (hr > 12) hr -= 12;
  
    setTimeOnly(`${hr.toString().padStart(2, "0")}:${minute}`);
    setAmPm(ampmValue);
    };


  const handleChange = (field, value) => {
    setClientInfo((prev) => ({ ...prev, [field]: value }));
  };

 const handleCreateFollowUp =async () => {
  const freshLeadId =
      clientInfo.fresh_lead_id || clientInfo.freshLeadId || clientInfo.id;
     if (
       !contactMethod ||
       !reasonDesc||
       !followUpType ||
       !interactionRating ||
       !interactionDate ||
       !interactionTime
     ) {
       return Swal.fire({
         icon: "warning",
         title: "Missing Information",
         text: "Please fill out all required fields before creating follow-up.",
       });
     }
    try{ 
  const newFollowUpData= {
    fresh_lead_id: freshLeadId,
      connect_via: contactMethod,
      follow_up_date: interactionDate,
       follow_up_time: convertTo24HrFormat(interactionTime),
         follow_up_type: followUpType,
    comments: reasonDesc,
    interaction_rating:interactionRating,
   document_name:docName
  
 }
 
 
    await processCreateFollowUp(newFollowUpData);
  const result=  await getProcessFollowup(id);

    setHistoryFollowup(result.data);
     setTimeout(() => {
 navigate("/process/process-follow-up"); // Replace the current URL with the new one
}, 1000);
   Swal.fire({ 
             icon: "success", 
             title: "Follow-up Created",
             text: "Follow-up and history created successfully!"
           });
           
   }catch (error) {
       
         Swal.fire({
           icon: "error",
           title: "Update Failed",
           text: "Something went wrong. Please try again.",
         });
       }  } 

 

  const handleCreateMeeting = async () => {
    const freshLeadId =
      clientInfo.fresh_lead_id || clientInfo.freshLeadId || clientInfo.id;

    if (!freshLeadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Lead ID",
        text: "Unable to find the lead. Please reload and try again.",
      });
    }

    if (!reasonDesc) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Reason",
        text: "Please add a reason before creating a meeting.",
      });
    }

    try {
     
     const meetingPayload = {
          clientName: clientInfo.name,
          clientEmail: clientInfo.email,
          clientPhone: clientInfo.phone,
          reasonForFollowup: reasonDesc,
          startTime: new Date(`${interactionDate}T${interactionTime}`).toISOString(),
          endTime: null,
          connect_via: capitalize(contactMethod), 
        follow_up_type: followUpType, 
        interaction_rating: capitalize(interactionRating), 
        follow_up_date: interactionDate, 
        follow_up_time: convertTo24HrFormat(interactionTime), 
          fresh_lead_id: clientInfo.fresh_lead_id,
        };
      await createMeetingApi(meetingPayload);
       await getProcessFollowup(id);

      Swal.fire({ icon: "success", title: "Meeting Created" });
      loadFollowUpHistories(freshLeadId);
 setTimeout(() => {
 navigate("/process/process-follow-up"); // Replace the current URL with the new one
}, 1000);
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
    const freshLeadId =
      clientInfo.fresh_lead_id || clientInfo.freshLeadId || clientInfo.id;
 if (
       !contactMethod ||
       !reasonDesc||
       !followUpType ||
       !interactionRating ||
       !interactionDate ||
       !interactionTime
     ) {
       return Swal.fire({
         icon: "warning",
         title: "Missing Information",
         text: "Please fill out all required fields before creating follow-up.",
       });
     }
    if (!freshLeadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing Lead ID",
        text: "Unable to find the lead. Please reload and try again.",
      });
    }

    try {
      if (followUpType === "converted") {
        await createConvertedClientAPI({ fresh_lead_id: freshLeadId });
        await createFollowUpHistoryAPI({ 
        follow_up_id: clientInfo.followUpId || clientInfo.id, 
        connect_via: capitalize(contactMethod), 
        follow_up_type: followUpType, 
        interaction_rating: capitalize(interactionRating), 
        reason_for_follow_up: reasonDesc, 
        follow_up_date: interactionDate, 
        follow_up_time: convertTo24HrFormat(interactionTime), 
        fresh_lead_id: freshLeadId, 
      });
        Swal.fire({ icon: "success", title: "Client Converted" });
      } else if (followUpType === "final") {
        const payload={
      //  follow_up_id: clientInfo.followUpId || clientInfo.id, 
        connect_via: capitalize(contactMethod), 
        follow_up_type: followUpType, 
        interaction_rating: capitalize(interactionRating), 
        comments: reasonDesc, 
        follow_up_date: interactionDate, 
        follow_up_time: convertTo24HrFormat(interactionTime), 
        fresh_lead_id: freshLeadId, 
      }
    
        await createFinalStage(payload);
        await getProcessFollowup(id);
      
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
        connect_via: capitalize(contactMethod),
        follow_up_type: followUpType, 
        interaction_rating: capitalize(interactionRating), 
        comments: reasonDesc, 
        follow_up_date: interactionDate, 
        follow_up_time: convertTo24HrFormat(interactionTime), 
        fresh_lead_id: freshLeadId, 
      }
      await createRejected(payload);
      
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

 const { handleSendEmail } = useExecutiveActivity();                                                                                             //Getting Email templates

  const [sendingEmail, setSendingEmail] = useState(false);
 
  const isMeetingInPast = useMemo(() => {
    if (followUpType !== "meeting" || !interactionDate || !interactionTime) return false;
    const selectedDateTime = new Date(`${interactionDate}T${interactionTime}`);
    const now = new Date();
    return selectedDateTime < now;
  }, [followUpType, interactionDate, interactionTime]);
  const[historyFollowup,setHistoryFollowup]=useState();
    useEffect(() => {
      const fetchHistory = async () => {
       
        try {
          const result = await getProcessFollowup(id);
          setHistoryFollowup(result.data);
          if (result.data.document_name) {
      setDocName(result.data.document_name); } // The backend sends { message, data }
          console.log(result.data);
        } catch (err) {
          console.error("Failed to load follow-up history", err.message);
         
        } finally {
       
        }
      };
  
      if (id) {
        fetchHistory();
      }
    }, [id,getProcessFollowup]);
console.log(clientInfo,"id")
 const [latestComment, setLatestComment] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Load latest comment when stage is selected
  const handleStageChange = async (e) => {
    const stage = e.target.value;
    setSelectedStage(stage);

    const stageNumber = Number(stage.split(" ")[1]);
    try {
      const result = await getComments(client.id, stageNumber);
      const comments = result.comments || [];

      if (comments.length) {
        setLatestComment({
          [stage]: comments[comments.length - 1]
        });
        setHistory(comments);
      } else {
        setLatestComment({
          [stage]: { comment: "-", timestamp: "" }
        });
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load comments", err.message);
    }
  };

  // Open view history modal
  const handleViewHistory = async () => {
    setShowHistoryModal(true);
  };

  // Submit new comment
  const handleAddCommentSubmit = async () => {
    const stageNumber = Number(selectedStage.split(" ")[1]);
    try {
      await createStages(client.id, stageNumber, newComment);

      // Refresh latest comment
      const result = await getComments(client.id, stageNumber);
      const comments = result.comments || [];

      if (comments.length) {
        setLatestComment({
          [selectedStage]: comments[comments.length - 1]
        });
        setHistory(comments);
      }

      setNewComment("");
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add comment", err.message);
    }
  };
const handleSubmit = async () => {
  const stageNumber = Number(selectedStage.split(" ")[1]);

  const latest = latestComment[selectedStage]?.comment;

  if (!latest) {
    console.warn("No comment found to send as reminder.");
    return;
  }

  try {
    await createReminder(client.id, stageNumber, latest); // ✅ Send latest comment

   
    const result = await getComments(client.id, stageNumber);
    const comments = result.comments || [];

    if (comments.length) {
      const sorted = [...comments].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setLatestComment((prev) => ({
        ...prev,
        [selectedStage]: sorted[0],
      }));
    }
setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setNewComment("");

  } catch (err) {
    console.error("Failed to add reminder:", err.message);
  }
};
console.log(clientInfo,"id");
   const handleTemplateSelect = (template, clientEmail) => {
    if (template) {
      setSelectedTemplate(template);
      setEmailBody(template.body);
      setEmailSubject(template.subject);
      setClientEmail(clientEmail);
      setShowEmailModal(true);
    } else {
      setShowEmailModal(false);
      setSelectedTemplate(null);
      setEmailBody("");
      setEmailSubject("");
      setClientEmail("");
    }
  };
  useEffect(() => {
    console.log("Template selected:", selectedTemplate);
    console.log("Show Email Modal?", showEmailModal);
  }, [selectedTemplate, showEmailModal]);
  
  const handleEmailSubmit = async () => {
    setSendingEmail(true);

    try {
      const emailPayload = {
        templateId: selectedTemplate.id,
        executiveName: name,
        executiveEmail: email,
        clientEmail: clientInfo.email,
        emailBody: emailBody,
        emailSubject: emailSubject,
      };

      await handleSendEmail(emailPayload);
      alert("Email sent successfully!");
      setShowEmailModal(false);
      setSelectedTemplate(null);
      setEmailBody("");
      setEmailSubject("");
      setClientEmail("");
    } catch (err) {
      console.error(err);
      alert("Failed to send email.");
    } finally {
      setSendingEmail(false);
    }
  };
  return (
    <>
    <div className="client-overview-wrapper">
      {/* Client Details */}
      <div className="c-container">
     
        <h2 style={{marginLeft:"9px",marginBottom:"30px"}}>Client Details</h2>
       
        <div className="c-content">
          <div className="c-layout">
            <div className="client-info-column">
              <div className="c-profile">
                <div className="c-info">
                  {clientFields.map(({ key, label }) => (
                    <div className="info-item" key={key}>
                      <span className="label">{label}:</span>
                      <input
                        type="text"
                        className="client-input"
                        value={clientInfo[key] || ""}
                        onChange={(e) => handleChange(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="follow-up-column">
  <div className="follow-up-box">
    <div className="last-follow-up">
      <h3>Last Follow-up</h3>
      {isLoading ? (
        <p>Loading follow-up history...</p>
      ) : 
    Array.isArray(historyFollowup) && historyFollowup.length > 0 ? (
  historyFollowup.map((client, index) => (
    <div key={index} className="followup-item">
      {/* Reason for follow-up */}
      <div className="followup-reason">
        {client.comments|| "N/A"}
      </div>

      {/* Follow-up Date and Time */}
      <div className="followup-datetime">
        <span className="followup-date">{client.follow_up_date}</span>
        <span className="followup-time">{client.follow_up_time}</span>
      </div>
    </div>
  ))
) : (
  <div className="no-data-text">No follow-up texts</div>
)}

 

    </div>

    {Array.isArray(followupHistory) && followupHistory.length> 0 && (
      <div className="follow-up-history-summary">
        <div className="history-list" style={{ maxHeight: "200px", overflowY: "auto" }}>
        {followupHistory.slice(1).map((history, index) => (
  <div key={index} className="followup-entry-plain">
    <p className="followup-reason">{history.reason_for_follow_up}</p>
    <p className="followup-time">
      {new Date(history.follow_up_date).toLocaleDateString()} - {history.follow_up_time}
    </p>
  </div>
))}

        </div>
      </div>
    )}
    </div>

            </div>
          </div>
        </div>
      </div>

      {/* Client Interaction */}
      <div className="client-interaction-container">
        <div className="interaction-form">
       <div style={{ position: "relative" }}>
                <SendEmailProcess clientInfo={clientInfo} onTemplateSelect={handleTemplateSelect}/>
                      {showEmailModal && (
                        <div
                          style={{
                            position: "absolute",
                            left: 800,
                            width: "400px",
                            backgroundColor: "#f5f7fa",
                            border: "1px solid #e0e0e0",
                            borderRadius: "5px",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                            zIndex: 6,
                            padding: "15px",
                            height: "auto",
                            marginTop: "-60px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderBottom: "1px solid #e0e0e0",
                              paddingBottom: "5px",
                              marginBottom: "10px",
                            }}
                          >
                            <h4 style={{ margin: 0, fontSize: "16px" }}>New Message</h4>
                            <div>
                              <button
                                onClick={() => setShowEmailModal(false)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "16px",
                                  marginLeft: "10px",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>
                              To
                            </label>
                            <input
                              type="email"
                              value={clientEmail}
                              readOnly
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0",
                                fontSize: "14px",
                              }}
                            />
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>
                              Subject
                            </label>
                            <input
                              type="text"
                              value={emailSubject}
                              onChange={(e) => setEmailSubject(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0",
                                fontSize: "14px",
                              }}
                            />
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            <textarea
                              value={emailBody}
                              onChange={(e) => setEmailBody(e.target.value)}
                              style={{
                                width: "100%",
                                height: "150px",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0",
                                fontSize: "14px",
                                resize: "vertical",
                              }}
                              placeholder="Email body"
                            />
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={handleEmailSubmit}
                              disabled={sendingEmail}
                              style={{
                                backgroundColor: "#28a745",
                                color: "white",
                                padding: "8px 16px",
                                borderRadius: "5px",
                                border: "none",
                                cursor: sendingEmail ? "not-allowed" : "pointer",
                                opacity: sendingEmail ? 0.6 : 1,
                              }}
                            >
                              {sendingEmail ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      )}
          
                    </div>

          <div className="connected-via">
            <h4 style={{marginBottom:"10px"}}>Connected Via</h4>
            <div className="radio-group">
              {["Call", "Email", "Call/Email"].map((method) => (
                <label key={method} className="radio-container">
                  <input
                    type="radio"
                    name="contactMethod"
                    checked={contactMethod === method}
                    onChange={() => setContactMethod(method)}
                  />
                  <span className="radio-label">
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="follow-up-type" >
            <h4 style={{marginBottom:"10px"}}>Follow-Up Type</h4>
            <div className="radio-group">
              {[
               "document collection","payment follow-up","visa filing","meeting","rejected",
                "final",
              ].map((type) => (
              <label key={type} className="radio-container">
                  <input
                    type="radio"
                    name="followUpType"
                 checked={followUpType === type}
                    onChange={() => setFollowUpType(type.toLowerCase())}
                  />
                  <span className="radio-label">{type.replace("-", " ")}</span>
                </label>
              ))}
            </div>
            {followUpType === "document collection" && (
  <div className="doc-dropdown" style={{ marginBottom: "20px" }}>
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

  {/* Show input when 'other' is selected */}
 
</div>
       

          <div className="interaction-rating">
            <h4 style={{marginBottom:"10px"}}>Interaction Rating</h4>
            <div className="radio-group">
              {["Aggressive", "Calm", "Neutral"].map((rating) => (
                <label key={rating} className="radio-container">
                  <input
                    type="radio"
                    name="interactionRating"
                    checked={interactionRating === rating}
                    onChange={() => setInteractionRating(rating)}
                  />
                  <span className="radio-label">
                    {rating.charAt(0).toUpperCase() + rating.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
 <h4 style={{marginTop:"20px"}}>Add Comments based on Stages</h4>
   <div className="stage-comments-container">
      <div className="stage-select-container">
        <select
          value={selectedStage}
          onChange={handleStageChange}
          className="stage-select"
        >
          <option value="" disabled>Select stages</option>
          {Array.from({ length: 15 }, (_, i) => (
            <option key={i + 1} value={`Stage ${i + 1}`}>
              Stage {i + 1}
            </option>
          ))}
        </select>
       <div className="reminder-action-wrapper">
  <div className="reminder-tooltip-wrapper">
     <span className="reminder-inline-label">Send the latest comment as a reminder</span>
    <button onClick={handleSubmit} className="reminder-button">⏰</button>
    {/* <span className="reminder-tooltip">Send the latest comment as a reminder</span> */}
  </div>
 

  {showToast && (
    <span className="reminder-toast-inline">Reminder sent successfully!</span>
  )}
</div>

 
      </div>

      {selectedStage && (
        <table className="stage-comments-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Comment</th>
              <th>View History</th>
              <th>Add Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{selectedStage}</td>
                {latestComment[selectedStage]?.comment ? (
          <>
          {(latestComment[selectedStage]?.comment || "")
  .split(/(\/processperson\/client\/upload\/\w+)/g)
  .map((part, idx) => {
    const isUploadLink = /^\/processperson\/client\/upload\/\w+$/.test(part);

    if (isUploadLink) {
      return (
        <span
          key={idx}
          onClick={() => {
            const fullComment = latestComment[selectedStage]?.comment || "";

            // Extract comment text before the link
            const commentOnly = fullComment
              .split(/\/processperson\/client\/upload\/\w+/)[0]
              .trim();

            const idMatch = part.match(/\/processperson\/client\/upload\/(\w+)/);
            const extractedId = idMatch?.[1];

            navigate(`/processperson/client/upload/${extractedId}`, {
              state: {
                label: commentOnly,
                defaultFilename: commentOnly,
              },
            });
          }}
          style={{ color: "#007bff", textDecoration: "underline", cursor: "pointer" }}
        >
          {part}
        </span>
      );
    }

    return <span key={idx}>{part}</span>;
  })}


          </>
        ) : (
          "-"
        )}
              {/* <td>{latestComment[selectedStage]?.comment || "-"}</td> */}
              <td>
                <button
                  className="p-action-btn"
                  onClick={handleViewHistory}
                  disabled={!history.length}
                >
                  View History
                </button>
              </td>
              <td>
                <button
                  className="p-action-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Comment
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>History for {selectedStage}</h4>
            <button className="modal-close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            {history.length ? (
              <ul className="history-list">
                {history.map((c, idx) => (
                  <li key={idx}>
                    <strong>{new Date(c.timestamp).toLocaleString()}:</strong> {c.comment}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No history available</p>
            )}
          </div>
        </div>
      )}

      {/* Add Comment Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>Add Comment for {selectedStage}</h4>
            <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>×</button>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Enter your comment"
              className="comment-textarea"
            />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
       <button
  className="submit-btn"
  style={{ backgroundColor: "#0056b3", color: "white" }}
  onClick={() =>
    setNewComment((prev) => {
      const baseLink = `/processperson/client/upload/${client.id}`;
      return prev.includes(baseLink) ? prev : prev.trim() + " " + baseLink;
    })
  }
  disabled={!newComment.trim()}
>
  Generate Link
</button>

        <button
          className="submit-btn"
          onClick={handleAddCommentSubmit}
          disabled={!newComment.trim()}
        >
          Submit
        </button>

        
      </div>
           
          </div>
        </div>
      )}
    </div>
      {/* Follow-Up Detail */}
      <div className="followup-detail-theme">
        <div className="followup-detail-container">
          <div className="follow-up-reason">
            <h3>Reason for Follow-Up</h3>
            <div className="interaction-field">
              <div className="textarea-with-speech">
                <textarea
                  value={reasonDesc}
                  onChange={(e) => setReasonDesc(e.target.value)}
                  className="interaction-textarea"
                  placeholder="Type or speak your follow-up reason using the mic"
                />
                <button
                  type="button"
                  // className={`speech-btn ${isListening ? "listening" : ""}`}
                  // onClick={toggleListening}
                  // aria-label={isListening ? "Stop recording" : "Start recording"}
                >
                  {/* {isListening ? "⏹" : "🎤"} */}
                </button>
              </div>

              <div className="interaction-datetime" style={{ marginTop: "20px" }}>
                <h4>Interaction Schedule and Time</h4>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block" }}>Date:</label>
                    <input
                      type="date"
                      value={interactionDate}
                      min={minDate}
                      max={maxDate}
                      onChange={(e) => setInteractionDate(e.target.value)}
                      style={{ padding: "8px", borderRadius: "4px" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
  <label>Time:</label>
  <div
    style={{
      display: "flex",
      border: "1px solid #ccc",
      borderRadius: "6px",
      overflow: "hidden",
      backgroundColor: "white",
      height: "38px"
    }}
  >
    <div style={{ position: "relative", flex: 1 }}>
      <input
        type="time"
        value={convertTo24Hour(timeOnly, ampm)}
        onChange={(e) => {
          const time24 = e.target.value;
          if (time24) {
            const converted = convertTo12Hour(time24);
            setTimeOnly(converted.time);
            setAmPm(converted.amPm);
          }
        }}
        style={{
          border: "none",
          padding: "8px 4px",
          width: "100%",
          backgroundColor: "transparent",
          cursor: "text",
        }}
      />
    </div>
  </div>
  <button
    type="button"
    onClick={() => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const ampmValue = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      const currentTime12Hour = `${hour12.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      setTimeOnly(currentTime12Hour);
      setAmPm(ampmValue);
    }}
    style={{
      fontSize: "11px",
      color: "#007bff",
      background: "none",
      border: "none",
      cursor: "pointer",
      textDecoration: "underline",
    }}
  >
    Use Current Time
  </button>
</div>

                  </div>
                </div>
              </div>
              
              {followUpType === "meeting" && isMeetingInPast && (
                <div style={{
                  marginTop: "12px",
                  color: "#b71c1c",
                  background: "#fff4f4",
                  borderLeft: "4px solid #e57373",
                  padding: "10px 15px",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}>
                  ⚠ Please select a <strong>future date or time</strong> to schedule the meeting.
                </div>
              )}

              <div className="button-group" style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {/* Update Follow-Up button */}
                <button
                  onClick={handleCreateFollowUp}
                  className="crm-button update-follow-btn"
                  disabled={followUpLoading}
                  style={{
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "5px",
                    border: "none",
                    cursor: followUpLoading ? "not-allowed" : "pointer",
                    opacity: followUpLoading ? 0.6 : 1,
                  }}
                >
                  {followUpLoading ? "Processing..." : "Update Follow-Up"}
                </button>

                {/* Show these based on follow-up type */}
                {followUpType === "converted" && (
                  <button
                    onClick={handleFollowUpAction}
                    className="crm-button converted-btn"
                    disabled={followUpLoading}
                    style={{
                      backgroundColor: "#28a745",
                      color: "white",
                      padding: "10px 20px",
                      marginLeft: "10px",
                      borderRadius: "5px",
                      border: "none",
                    }}
                  >
                    Create Converted
                  </button>
                )}

                {followUpType === "final" && (
                  <button
                    onClick={handleFollowUpAction}
                    className="crm-button flw-close-btn"
                    disabled={followUpLoading}
                    style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      padding: "10px 20px",
                      marginLeft: "10px",
                      borderRadius: "5px",
                      border: "none",
                    }}
                  >
                    Final Stage
                  </button>
                )}
                 {followUpType === "rejected" && (
                  <>
                  <RejectionKindPicker value={rejectionKind} onChange={setRejectionKind} />
                  <button
                    onClick={handleFollowUpAction}
                    className="crm-button flw-close-btn"
                    disabled={followUpLoading}
                    style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      padding: "10px 20px",
                      marginLeft: "10px",
                      borderRadius: "5px",
                      border: "none",
                    }}
                  >
                   Rejected Leads
                  </button>
                  </>
                )}

                {followUpType === "meeting" && (
                  <button
                    onClick={handleCreateMeeting}
                    className="crm-button meeting-btn"
                    disabled={followUpLoading}
                    style={{
                      backgroundColor: "#17a2b8",
                      color: "white",
                      padding: "10px 20px",
                      marginLeft: "10px",
                      borderRadius: "5px",
                      border: "none",
                    }}
                  >
                    Create Meeting
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/* </div> */}
    </>
  );
};

export default ProcessClientDetailsOverview;
import React, { useState, useEffect, useCallback } from "react";
import { FaUserPlus, FaClipboardCheck, FaUsers, FaCheckCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { isSameDay } from "../../utils/helpers";
import { useProcessService } from "../../context/ProcessServiceContext";
import { getStageProgressApi } from "../../services/processService";
import "../../styles/processModern.css";

const ProcessReportCard = () => {
  const { customers, fetchCustomers, getProcessPersonMeetings } = useProcessService();
  const navigate = useNavigate();
  const [meetingData, setMeetingData] = useState();
  const [loaded, setLoaded] = useState(false);
  const [stageCounts, setStageCounts] = useState({ final: 0, completed: 0 });
  const [failed, setFailed] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      await fetchCustomers();
    } catch (err) {
      console.error("❌ Error fetching clients:", err);
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [fetchCustomers]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Final Stage / Completed come from the configured stage workflow, same source as those pages.
  useEffect(() => {
    let alive = true;
    getStageProgressApi()
      .then((d) => {
        const list = d.clients || [];
        if (alive) setStageCounts({ final: list.filter((c) => c.stage === "final_stage").length, completed: list.filter((c) => c.stage === "completed").length });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const loadMeetings = useCallback(async () => {
    try {
      const response = await getProcessPersonMeetings();
      const allMeetings = response.filter((m) => m?.freshLead?.CustomerStatus?.status === "meeting");

      const uniqueMeetingsMap = new Map();
      allMeetings.forEach((meeting) => {
        const leadId = meeting.fresh_lead_id;
        if (!uniqueMeetingsMap.has(leadId)) uniqueMeetingsMap.set(leadId, meeting);
      });

      const today = new Date();
      const todayCount = Array.from(uniqueMeetingsMap.values()).filter((m) => isSameDay(new Date(m.startTime), today)).length;
      setMeetingData(todayCount);
    } catch (err) {
      console.error("Failed to fetch process meetings", err);
    }
  }, [getProcessPersonMeetings]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const list = Array.isArray(customers) ? customers : [];
  const count = (status) => list.filter((client) => client.status === status).length;

  const cards = [
    { title: "Fresh Leads", value: count("pending"), route: "/process/freshlead", icon: <FaUserPlus /> },
    { title: "Follow-ups", value: count("under_review"), route: "/process/process-follow-up/", icon: <FaClipboardCheck /> },
    { title: "Scheduled Meetings", value: meetingData || 0, route: "/process/schedule", icon: <FaUsers /> },
    { title: "Final Stage", value: stageCounts.final, route: "/process/finalstage-leads", icon: <FaCheckCircle /> },
    { title: "Completed Clients", value: stageCounts.completed, route: "/process/completed-clients", icon: <FaCheckCircle /> },
  ];

  return (
    <section className="pp-dash" aria-label="Process dashboard overview">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">Dashboard</h1>
          <p className="pp-page__sub">Your assigned clients at a glance</p>
        </div>
      </header>

      {failed && (
        <div className="pp-alert pp-alert--error" role="alert">
          Some figures could not be loaded. They may be incomplete.
        </div>
      )}

      <div className="report-cards-exec">
        {cards.map((card, index) => (
          <div
            key={card.title}
            className={`report-card report-card-${index}`}
            role="link"
            tabIndex={0}
            aria-label={`${card.title}: ${loaded ? card.value : "loading"}. Open`}
            onClick={() => navigate(card.route)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(card.route);
              }
            }}
          >
            <div className="card-icon">{card.icon}</div>
            <div className="card-details">
              <h4>{card.title}</h4>
              <p className="card-value1">{loaded ? <span>{card.value}</span> : <span className="pp-skel pp-skel--value" aria-hidden="true" />}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProcessReportCard;

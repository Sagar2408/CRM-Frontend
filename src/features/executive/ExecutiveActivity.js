import React, { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoffee, faPlay } from "@fortawesome/free-solid-svg-icons";
import "../../styles/executiveTracker.css";
import { useWorkClock } from "../../context/ExecutiveActivityContext";
import { useApi } from "../../context/ApiContext";
import { useBreakTimer } from "../../context/breakTimerContext";

// Activity Tracker popup. Every number comes from the backend work session
// (via useWorkClock): work time pauses while a break is running and resumes
// when it ends; closing the browser and logging in again on the same date
// continues the same day's total.
const ExecutiveActivity = () => {
  const { startBreak, stopBreak, timerLoading } = useBreakTimer();
  const { workTimer, breakTimer, working, onBreak, loaded } = useWorkClock();
  const { executiveInfo, executiveLoading, fetchExecutiveData } = useApi();

  useEffect(() => {
    if (!executiveInfo && !executiveLoading) fetchExecutiveData();
  }, [executiveInfo, executiveLoading, fetchExecutiveData]);

  const statusText = !loaded ? "Connecting..." : onBreak ? "On break" : working ? "Working" : "Not started";

  const toggleBreak = () => {
    if (timerLoading || !loaded) return;
    (onBreak ? stopBreak() : startBreak()).catch?.(() => {});
  };

  return (
    <div className="activity-tracker-container">
      <div className="tracker-widget">
        <div className="tracker-header">
          <h3>Activity Tracker</h3>
        </div>

        <div className="tracker-content">
          <div className="exec-info">
            <div className="exec-avatar">
              <span className="initial">{executiveInfo?.username?.charAt(0).toUpperCase() || "U"}</span>
            </div>
            <div className="exec-details">
              <div className="execu-name">
                <strong>{executiveInfo?.username || "Loading..."}</strong>
              </div>
              <div className="exec-id">
                ID: <span>{executiveInfo?.id ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="exec-status-badge">
            <strong>Status:</strong> {statusText}
          </div>

          <div className="time-display">
            <div className="time-block">
              <span className="time-label">Work time today</span>
              <span className="time-value">{workTimer}</span>
            </div>
            <div className="time-block break-time">
              <span className="time-label">Break time today</span>
              <span className="time-value">{breakTimer}</span>
            </div>

            <div className="daily-summary">
              <h4 className="summary-text">How it works</h4>
              <ul>
                <li>Work time starts automatically when you log in.</li>
                <li>Taking a break pauses work time; ending it resumes work.</li>
                <li>Logging out saves your time, and logging back in today continues it.</li>
              </ul>
            </div>

            <div className="motivation-box">
              <blockquote>"Small consistent actions lead to big results."</blockquote>
              <small>- Ad Agency 360 Motivation</small>
            </div>
          </div>

          <div className="tracker-actions">
            <button
              className={`tracker-btn ${onBreak ? "active" : ""}`}
              onClick={toggleBreak}
              disabled={timerLoading || !loaded || (!onBreak && !working)}
            >
              <FontAwesomeIcon icon={onBreak ? faPlay : faCoffee} style={{ color: "white" }} />
              <p style={{ color: "white" }}>{onBreak ? "End Break" : "Take Break"}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveActivity;

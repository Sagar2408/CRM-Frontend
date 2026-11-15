import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoffee } from "@fortawesome/free-solid-svg-icons";
import "../../styles/executiveTracker.css";

// Process Person activity popover. Pure view over the server-backed work clock that
// ProcessLayout owns (useProcessWorkClock): same numbers as the header, one source.
const ProcessActivity = ({ clock }) => {
  let storedUser = {};
  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    storedUser = {};
  }
  const name = storedUser.fullName || "Unknown User";
  const { loaded, onBreak, workTimer, breakTimer, busy, toggleBreak } = clock || {};

  return (
    <div className="activity-tracker-container">
      <div className="tracker-widget">
        <div className="tracker-header">
          <h3>Activity Tracker</h3>
        </div>

        <div className="tracker-content">
          <div className="exec-info">
            <div className="exec-avatar">
              <span className="initial">{name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="exec-details">
              <div className="execu-name">
                <strong>{name}</strong>
              </div>
              <div className="exec-id">
                ID: <span>{storedUser.id || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="status-badge">
            <strong>Status:</strong> {!loaded ? "Connecting" : onBreak ? "Break" : "Working"}
          </div>

          <div className="time-display">
            <div className="time-block">
              <span className="time-label">Working Time:</span>
              <span className="time-value">{workTimer || "00:00:00"}</span>
            </div>

            <div className="daily-summary">
              <h4 className="summary-text">Today's Summary</h4>
              <ul>
                <li>Total Break Time: {breakTimer || "00:00:00"}</li>
                <li>Working Time So Far: {workTimer || "00:00:00"}</li>
              </ul>
            </div>
          </div>

          <div className="tracker-actions">
            <button className={`tracker-btn ${onBreak ? "active" : ""}`} onClick={toggleBreak} disabled={busy || !loaded}>
              <FontAwesomeIcon icon={faCoffee} style={{ color: "white" }} />
              <p style={{ color: "white" }}>{onBreak ? "End Break" : "Take Break"}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessActivity;

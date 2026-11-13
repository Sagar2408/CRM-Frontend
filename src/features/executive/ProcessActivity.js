import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoffee } from "@fortawesome/free-solid-svg-icons";
import {  getActivityStatus,} from "../../services/executiveService";
import { toast } from "react-toastify";
import "../../styles/executiveTracker.css";
import useWorkTimer from "./useLoginTimer";
import { useBreakTimer } from "../../context/breakTimerContext";

const ProcessActivity = () => {
  const {
    breakTimer,
    isBreakActive,
    processstartBreak,
    processstopBreak,
  } = useBreakTimer();

  const timer = useWorkTimer();
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [status, setStatus] = useState({
    onBreak: false,
    workingTime: 0,
    breakTime: 0,
    currentLeadId: "",
  });

  const [loading, setLoading] = useState(false);

  const fetchActivityStatus = async () => {
    try {
      setLoading(true);
      const data = await getActivityStatus();
      setStatus((prev) => ({
        ...prev,
        onBreak: data.onBreak || false,
        workingTime: data.workingTime || 0,
        breakTime: data.breakTime || 0,
        currentLeadId: data.currentLeadId || "",
      }));
    } catch (error) {
      console.error("Failed to fetch activity status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storedUser?.role === "processperson") {
      fetchActivityStatus();

      const backendInterval = setInterval(fetchActivityStatus, 30000);
      const uiInterval = setInterval(() => {
        setStatus((prev) => ({
          ...prev,
          workingTime: prev.workingTime + 1,
          breakTime: prev.onBreak ? prev.breakTime + 1 : prev.breakTime,
        }));
      }, 1000);

      return () => {
        clearInterval(backendInterval);
        clearInterval(uiInterval);
      };
    }
  }, [storedUser?.role]);

  const toggle = async () => {
    try {
      setLoading(true);
      if (!isBreakActive) {
        await processstartBreak(storedUser?.id);
        toast.success("Break started");
      } else {
        await processstopBreak(storedUser?.id);
        toast.success("Break ended");
      }
      await fetchActivityStatus();
    } catch (error) {
      console.error("Failed to toggle break:", error);
      toast.error("Failed to update break status");
    } finally {
      setLoading(false);
    }
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
              <span className="initial">
              {storedUser.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="exec-details">
              <div className="execu-name">
                <strong>{storedUser.fullName || "Unknown User"}</strong>
              </div>
              <div className="exec-id">
                ID: <span>{storedUser.id || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="status-badge">
            <strong>Status:</strong> {isBreakActive ? "Break" : "Working"}
          </div>

          <div className="time-display">
            <div className="time-block">
              <span className="time-label">Working Time:</span>
              <span className="time-value">{timer}</span>
            </div>

            <div className="daily-summary">
              <h4 className="summary-text">Today's Summary</h4>
              <ul>
                <li>Total Break Time: {breakTimer}</li>
                <li>Working Time So Far: {timer}</li>
              </ul>
            </div>

            <div className="motivation-box">
              <blockquote>"Small consistent actions lead to big results."</blockquote>
              <small>- Ad Agency 360 Motivation</small>
            </div>
          </div>

          <div className="tracker-actions">
            <button
              className={`tracker-btn ${status.onBreak ? "active" : ""}`}
              onClick={toggle}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faCoffee} style={{ color: "white" }} />
              <p style={{ color: "white" }}>
                {isBreakActive ? "End Break" : "Take Break"}
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessActivity;

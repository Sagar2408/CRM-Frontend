 import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoffee } from "@fortawesome/free-solid-svg-icons";
import {
  getActivityStatus,
} from "../../services/executiveService";
import "../../styles/executiveTracker.css";
import { useExecutiveActivity } from '../../context/ExecutiveActivityContext';
import useWorkTimer from "./useLoginTimer";
import { useApi } from "../../context/ApiContext";
import { useBreakTimer } from "../../context/breakTimerContext";

const ExecutiveActivity = () => {
  const { user } = useExecutiveActivity();
  const { breakTimer, startBreak, isBreakActive } = useBreakTimer()
  const timer = useWorkTimer();
  const { executiveInfo, executiveLoading, fetchExecutiveData, activityData, getExecutiveActivity } = useApi();
  
  useEffect(() => {
    fetchExecutiveData(); // Call it only once on mount
  }, [fetchExecutiveData,getExecutiveActivity]);

  // ✅ Fetch daily activity data when executiveInfo is available
  useEffect(() => {
    if (executiveInfo?.id) {
      getExecutiveActivity(executiveInfo.id);
    }
  }, [executiveInfo?.id,getExecutiveActivity]);
    
  const [status, setStatus] = useState({
    onBreak: false,
    workingTime: 0,
    breakTime: 0,
    currentLeadId: "",
  });

  const [loading, setLoading] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "00:00:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
    if (user?.role === "Executive") {
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
  }, [user?.role]);

  useEffect(() => {
    if (!executiveInfo && !executiveLoading) {
      fetchExecutiveData(); // only when necessary
    }
  }, [ executiveInfo, executiveLoading, fetchExecutiveData]);
  
  
  const toggle= async () => {
    if (!isBreakActive) {
      await startBreak();
    } 
  };
  
  // const toggleCallTracking = async () => {
  //   try {
  //     setLoading(true);

  //     if (!status.isOnCall) {
  //       if (!status.currentLeadId) {
  //         toast.warning("Please enter a Lead ID first");
  //         setLoading(false);
  //         return;
  //       }

  //       await startCall(status.currentLeadId);
  //       toast.info("Call tracking started");
  //     } else {
  //       await endCall(status.currentLeadId);
  //       toast.success("Call tracked successfully");
  //     }

  //     await fetchActivityStatus();
  //   } catch (error) {
  //     toast.error(`Failed to ${status.isOnCall ? "end" : "start"} call: ${error.message}`);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleLeadIdChange = (e) => {
  //   setStatus((prev) => ({
  //     ...prev,
  //     currentLeadId: e.target.value,
  //   }));
  // };

  // const handleManualRefresh = () => {
  //   fetchActivityStatus();
  //   // ✅ Also refresh daily activity data
  //   if (executiveInfo?.id) {
  //     getExecutiveActivity(executiveInfo.id);
  //   }
  //   toast.info("Activity data refreshed");
  // };
  
  // const toggleCall = (e) => {
  //   if (callText === 'Start Call') {
  //      handleStartCall();
  //     setCallText('End Call');
  //     // ✅ Save call status
  //   } else {
  //     handleEndCall();
  //     setCallText('Start Call');
  //       // ✅ Save call status
  //   }
  // }
  
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
                {executiveInfo?.username?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="exec-details">
              <div className="execu-name">
                <strong>{executiveInfo?.username || "Unknown User"}</strong>
              </div>
              <div className="exec-id">
                ID: <span>{executiveInfo?.id || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="exec-status-badge">
            <strong>Status:</strong>{" "}
            {isBreakActive ? "Break" : "Working"}
          </div>

          <div className="time-display">
            <div className="time-block">
              <span className="time-label">Working Time:</span>
              <span className="time-value">{formatTime(activityData.workTime)}</span>
            </div>

            <div className="daily-summary">
              <h4 className="summary-text">Today's Summary</h4>
              <ul>
                <li>Total Break Time: {breakTimer}</li>
                <li>Working Time So Far: {timer}</li>
                <li>Total Work Time Today: {formatTime(activityData.workTime)}</li>
                <li>Total Break Time Today: {formatTime(activityData.breakTime)}</li>
              </ul>
            </div>
            
            <div className="motivation-box">
              <blockquote>"Small consistent actions lead to big results."</blockquote>
              <small>- AtoZee Motivation</small>
            </div>
          </div>

          <div className="tracker-actions">
            <button
            className={`tracker-btn ${status.onBreak ? "active" : ""}`}
            onClick={toggle}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faCoffee} style={{color:"white"}}/>
          <p style={{color:"white"}}> {isBreakActive ? "End Break" : "Take Break"}</p>    
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveActivity;
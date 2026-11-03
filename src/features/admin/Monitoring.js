import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import SidebarToggle from "./SidebarToggle";
import "../../styles/monitoringLocked.css";

// Employee Monitoring is temporarily locked. This replaces the executive grid/filters/stream
// controls entirely rather than hiding them behind a flag, so that
// StreamPlayer.js — the only thing in this app that opens a Socket.IO
// connection to https://monitoring-w28p.onrender.com — is no longer
// imported anywhere and its connection is never created. Backend
// monitoring code/data is untouched; this is a frontend-only, reversible
// lock (restore by reinstating the previous component body).
function Monitoring() {
  return (
    <>
      <SidebarToggle />
      <div className="monlock-backdrop">
        <div className="monlock-card">
          <div className="monlock-icon">
            <FontAwesomeIcon icon={faLock} />
          </div>
          <h1 className="monlock-title">Employee Monitoring</h1>
          <p className="monlock-line">This page is currently locked by Master User AdAgency360.</p>
          <p className="monlock-line">We will be serving this functionality in the future.</p>
          <p className="monlock-thanks">Thank you for your patience.</p>
        </div>
      </div>
    </>
  );
}

export default Monitoring;

import React, { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { useLoading } from "../context/LoadingContext";
import LoadingSpinner from "../features/spinner/LoadingSpinner";
import "../styles/executive.css";
import "../styles/executiveShell.css";
import "../styles/executiveHeader.css";
import "../styles/processModern.css";
import "../styles/processPortal.css";
import ProcessSidebarNavbar from "./ProcessSidebarNavbar";
import useProcessWorkClock from "../features/process-client/useProcessWorkClock";

// Shares the Executive shell's collapse preference so the sidebar behaves the same
// across panels. `portal` renders the Manage Client menu (/processperson/*).
const PREF_KEY = "crm.exec.sidebarCollapsed";
const read = () => {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch (_) {
    return false;
  }
};

const ProcessLayout = ({ portal = false }) => {
  const { isLoading, loadingText } = useLoading();
  const [collapsed, setCollapsed] = useState(read);
  let userId;
  try {
    userId = JSON.parse(localStorage.getItem("user") || "{}")?.id;
  } catch (_) {
    userId = undefined;
  }
  const clock = useProcessWorkClock(userId); // one clock for the whole panel

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PREF_KEY, next ? "1" : "0");
      } catch (_) {
        /* preference only */
      }
      return next;
    });
  }, []);

  return (
    <div className={`executive-app-container exec-shell-root pp-shell ${collapsed ? "is-collapsed" : ""}`}>
      <ProcessSidebarNavbar clock={clock} collapsed={collapsed} onToggleCollapse={toggle} portal={portal} />
      <div className="executive-main-content">
        <div className="dashboard-container" style={{ position: "relative" }}>
          {isLoading && <LoadingSpinner text={loadingText || "Loading..."} />}
          <div className="dashboard-main-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessLayout;

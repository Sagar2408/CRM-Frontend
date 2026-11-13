import React, { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarandNavbar from "../layouts/SidebarandNavbar";
import { useLoading } from "../context/LoadingContext";
import LoadingSpinner from "../features/spinner/LoadingSpinner";
import "../styles/executive.css";
import "../styles/executiveShell.css"; // after the legacy sidebar/navbar rules: owns the shell geometry
import "../styles/executiveHeader.css"; // header bar + sidebar header look (after the shell)

export const SIDEBAR_PREF_KEY = "crm.exec.sidebarCollapsed";

const readPreference = () => {
  try {
    return localStorage.getItem(SIDEBAR_PREF_KEY) === "1";
  } catch (_) {
    return false; // storage blocked: default to expanded
  }
};

// The collapsed preference is read synchronously in the state initializer (before
// first paint), so a returning user never sees the sidebar jump from expanded to
// collapsed. Collapsing only changes --exec-sb-w; sidebar, header and content all
// read that one variable, so they move together.
const ExecutiveLayout = () => {
  const { isLoading, loadingText } = useLoading();
  const [collapsed, setCollapsed] = useState(readPreference);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_PREF_KEY, next ? "1" : "0");
      } catch (_) {
        /* preference only */
      }
      return next;
    });
  }, []);

  return (
    <div className={`executive-app-container exec-shell-root ${collapsed ? "is-collapsed" : ""}`}>
      <SidebarandNavbar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

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

export default ExecutiveLayout;

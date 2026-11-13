import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../styles/admin.css";
import HrSidebar from "./HrSidebar";
import HrNavbar from "./HrNavbar";
import { AccessGate } from "./PermissionedSidebar";
import { NAV } from "./navConfig";
import HrDashboard from "../features/hr/HrDashboard";
import RequirePermission from "../features/admin-settings/RequirePermission";

/**
 * HR panel shell. The landing page is the real-data HR dashboard (the old
 * executive/lead widgets were removed - they are not HR data). Nothing renders
 * unless the Admin enabled at least one page; the landing page itself needs the
 * `dashboard` key and otherwise redirects to the first page the user may open.
 */
const HrLayout = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/hr" || location.pathname === "/hr/";

  useEffect(() => {
    localStorage.setItem("adminSidebarExpanded", "false");
    window.dispatchEvent(new Event("sidebarToggle"));
  }, []);

  return (
    <div className="admin-dashboard-container">
      <HrSidebar className="admin-sidebar" />
      <main className="admin-main-content">
        <HrNavbar />
        <AccessGate config={NAV.hr} landing={isDashboard}>
          {isDashboard ? (
            <RequirePermission requiredKey="dashboard">
              <HrDashboard />
            </RequirePermission>
          ) : (
            <Outlet />
          )}
        </AccessGate>
      </main>
    </div>
  );
};

export default HrLayout;

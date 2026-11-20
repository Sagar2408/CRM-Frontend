import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../styles/admin.css";
import ManagerSidebar from "./ManagerSidebar";
import ManagerNavbar from "./ManagerNavbar";
import { AccessGate } from "./PermissionedSidebar";
import { NAV } from "./navConfig";
import ManagerDashboard from "../features/manager/ManagerDashboard";
import RequirePermission from "../features/admin-settings/RequirePermission";
import { usePermissions } from "../hooks/usePermissions";

/**
 * Manager panel shell. The landing page is the real-data Manager Overview (team
 * work/break time, lead funnel, performance, tasks and meetings from the manager's
 * own team); the old admin-wide widgets were removed. The landing page needs the
 * `dashboard` key and otherwise redirects to the first page the user may open.
 */
const ManagerLayout = () => {
  const location = useLocation();
  const { permissions } = usePermissions();
  const isDashboard = location.pathname === "/manager" || location.pathname === "/manager/";

  useEffect(() => {
    localStorage.setItem("adminSidebarExpanded", "false");
    window.dispatchEvent(new Event("sidebarToggle"));
  }, []);

  return (
    <div className="admin-dashboard-container">
      <ManagerSidebar className="admin-sidebar" />
      <main className="admin-main-content">
        <ManagerNavbar />
        <AccessGate config={NAV.manager} landing={isDashboard}>
          {isDashboard ? (
            <RequirePermission requiredKey="dashboard">
              <ManagerDashboard canSeeTasks={permissions?.executive_details === true} />
            </RequirePermission>
          ) : (
            <Outlet />
          )}
        </AccessGate>
      </main>
    </div>
  );
};

export default ManagerLayout;

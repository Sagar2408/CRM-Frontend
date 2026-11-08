import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../features/admin/Header";
import AdminDashboard from "../features/admin/dashboard/AdminDashboard";
import AdminSidebar from "../layouts/AdminSidebar";
import "../styles/admin.css";
import { useApi } from "../context/ApiContext";
import AdminNavbar from "./AdminNavbar";

const AdminLayout = () => {
  const { fetchExecutives } = useApi();
  const location = useLocation();
  const isDashboard = location.pathname === "/admin";

  useEffect(() => {
    localStorage.setItem("adminSidebarExpanded", "false");
    window.dispatchEvent(new Event("sidebarToggle"));
    fetchExecutives();
  }, [fetchExecutives]);

  return (
    <div className="admin-dashboard-container">
      <AdminSidebar className="admin-sidebar" />
      <main className="admin-main-content">
        <AdminNavbar />
        {isDashboard ? (
          <div className="dashboard-wrapper">
            <Header />
            <AdminDashboard />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
};

export default AdminLayout;

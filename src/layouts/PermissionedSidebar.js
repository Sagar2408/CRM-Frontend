import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ActivitySquare, CalendarCheck, CalendarDays, CalendarOff, ClipboardList, FolderOpen, Gauge, HelpCircle,
  LifeBuoy, MessageSquare, PieChart, Settings, UserCheck, UserCircle, UserCog, UserPlus, Users, Wallet,
} from "lucide-react";
import { MessagingSidebarItem } from "../features/Messaging/MessagingNav";
import { usePermissions } from "../hooks/usePermissions";
import { firstAllowedPath, itemPath, resolveNav } from "./navConfig";
import "../styles/adminsidebar.css";
import "../styles/hr.css";

const ICONS = {
  ActivitySquare, CalendarCheck, CalendarDays, CalendarOff, ClipboardList, FolderOpen, Gauge, HelpCircle,
  LifeBuoy, MessageSquare, PieChart, Settings, UserCheck, UserCircle, UserCog, UserPlus, Users, Wallet,
};

/** Sidebar shared by the HR and Manager panels. Shows only pages the Admin enabled. */
export const PermissionedSidebar = ({ config }) => {
  const { permissions, loading } = usePermissions();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(() => localStorage.getItem("adminSidebarExpanded") === "true");

  const toggleSidebar = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem("adminSidebarExpanded", String(next));
    window.dispatchEvent(new Event("sidebarToggle"));
  }, [isExpanded]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-expanded", isExpanded);
    document.body.classList.toggle("sidebar-collapsed", !isExpanded);
    document.body.classList.toggle("sidebar-mobile-active", !isExpanded);

    const sync = () => setIsExpanded(localStorage.getItem("adminSidebarExpanded") === "true");
    window.addEventListener("sidebarToggle", sync);
    let startX = 0;
    const onStart = (e) => { startX = e.changedTouches[0].screenX; };
    const onEnd = (e) => {
      const endX = e.changedTouches[0].screenX;
      if (startX - endX > 50 && isExpanded) toggleSidebar();
      if (endX - startX > 50 && !isExpanded) toggleSidebar();
    };
    window.addEventListener("touchstart", onStart);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("sidebarToggle", sync);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isExpanded, toggleSidebar]);

  const nav = resolveNav(config, permissions);
  const isActive = (item) => {
    const p = itemPath(config, item);
    return item.to ? location.pathname === p || location.pathname.startsWith(`${p}/`) : location.pathname === p;
  };

  const renderItem = (item) => {
    if (item.messaging) return <MessagingSidebarItem key={item.id} />;
    const Icon = ICONS[item.icon] || Gauge;
    return (
      <li key={item.id} className={isActive(item) ? "active" : ""}>
        <Link to={itemPath(config, item)} className="admin-aside-link" data-tooltip={item.label}>
          <Icon className="admin-aside-icon" />
          <span className="sidebar-label">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <section>
      <button className="admin-menu_toggle" onClick={toggleSidebar} aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}>
        <Gauge className="admin-aside-icon" />
      </button>
      <aside className={`admin-sidebar ${isExpanded ? "expanded active" : "collapsed"}`}>
        <div className="admin-header-wrapper">
          <h2>
            <span className="highlight">Atozee Visas</span>
          </h2>
        </div>
        <nav aria-label={`${config.title} navigation`}>
          {loading && <p className="sidebar-label hr-nav-note">Loading…</p>}
          {!loading && nav.total === 0 && (
            <p className="sidebar-label hr-nav-note" data-testid="nav-empty">
              No pages enabled for your account yet.
            </p>
          )}
          {nav.general.length > 0 && (
            <>
              <p className="sidebar-section sidebar-label" data-testid="nav-general">General</p>
              <ul>{nav.general.map(renderItem)}</ul>
            </>
          )}
          {nav.external.length > 0 && (
            <>
              <p className="sidebar-section sidebar-label" data-testid="nav-external">External</p>
              <ul>{nav.external.map(renderItem)}</ul>
            </>
          )}
        </nav>
      </aside>
    </section>
  );
};

/** Shown instead of any page when the Admin has enabled nothing for this user. */
export const NoPagesAssigned = ({ title = "your role" }) => (
  <div className="hr-restricted" role="status" data-testid="no-pages">
    <div className="hr-restricted-icon" aria-hidden="true">🔒</div>
    <h2>No pages are available yet</h2>
    <p>
      Your administrator hasn’t enabled any pages for {title} yet. Please ask them to grant access in
      Page Access Control, then refresh this page.
    </p>
  </div>
);

/**
 * Wraps a panel's content area. Nothing renders unless the user holds at least
 * one page permission; the landing page redirects to the first page the user
 * may actually open instead of showing "Access Denied" for the dashboard.
 */
export const AccessGate = ({ config, landing = false, children }) => {
  const { permissions, loading } = usePermissions();
  if (loading) return <div className="hr-loading">Loading permissions…</div>;
  const nav = resolveNav(config, permissions);
  if (nav.total === 0) return <NoPagesAssigned title={`the ${config.title} panel`} />;
  if (landing && permissions?.dashboard !== true) {
    const to = firstAllowedPath(config, permissions);
    if (to) return <Navigate to={to} replace />;
  }
  return <>{children}</>;
};

export default PermissionedSidebar;

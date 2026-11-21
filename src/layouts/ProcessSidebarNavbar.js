import React, { useEffect, useState, useRef, useContext } from "react";
import { MessagingSidebarItem } from "../features/Messaging/MessagingNav";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "../styles/sidebar.css";
import BeepNotification from "../BeepNotification";
import ProcessActivity from "../features/executive/ProcessActivity";
import ProcessClock from "../features/process-client/ProcessClock";
import ProfileAvatar from "../features/executive/ProfileAvatar";
import { useApi } from "../context/ApiContext";
import { ThemeContext } from "../features/admin/ThemeContext";
import { SearchContext } from "../context/SearchContext";
import { useProcess } from "../context/ProcessAuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars, faHouse, faUsers, faList, faCircleXmark, faCircleCheck, faFile, faRobot, faGear,
  faArrowLeft, faBell, faClock, faChevronDown, faRightFromBracket, faMugHot,
  faPersonWalking, faBed, faCouch, faUmbrellaBeach, faPeace, faBookOpen, faMusic, faHeadphones,
  faYinYang, faStopCircle, faSpinner, faMagnifyingGlass, faAddressBook, faGauge, faFlagCheckered,
} from "@fortawesome/free-solid-svg-icons";

const breakIcons = [faMugHot, faPersonWalking, faBed, faCouch, faUmbrellaBeach, faPeace, faBookOpen, faMusic, faHeadphones, faYinYang];
const MOBILE_QUERY = "(max-width: 991px)";

const useIsMobile = () => {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false);
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return mobile;
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch (_) {
    return {};
  }
};

/**
 * Sidebar + header for the Process Person panel. `portal` switches the menu to the
 * Manage Client portal (/processperson/client/*); the header is the same in both.
 * Menu items only link to routes the Process Person already had.
 */
const ProcessSidebarNavbar = ({ clock, collapsed = false, onToggleCollapse = () => {}, portal = false }) => {
  const { logout } = useProcess();
  const { executiveLoading, fetchNotifications, unreadCount, notifications, markNotificationReadAPI } = useApi();
  const { theme } = useContext(ThemeContext);
  const { setSearchQuery } = useContext(SearchContext) || {};
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [, setProfileVersion] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const popoverRef = useRef(null);
  const trackerRef = useRef(null);

  const userDetails = readUser();
  const { fullName, email } = userDetails;
  const name = (fullName || "").trim() || "Account";
  const initial = (name.charAt(0) || "?").toUpperCase();
  const home = portal ? "/processperson/client/all-clients" : "/process";

  const handleHamburger = () => (isMobile ? setIsActive((p) => !p) : onToggleCollapse());

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout(); // stops the work session first, then revokes the session server-side
    } catch (error) {
      console.error("Logout failed:", error.message);
      setIsLoggingOut(false);
    }
  };

  const handleBack = () => {
    let stack = [];
    try {
      stack = JSON.parse(sessionStorage.getItem("navStack")) || [];
    } catch (_) {
      stack = [];
    }
    stack.pop();
    while (stack.length > 0) {
      const prev = stack.pop();
      if (prev !== "/login" && prev !== "/signup") {
        sessionStorage.setItem("navStack", JSON.stringify(stack));
        navigate(prev);
        return;
      }
    }
    navigate(home);
  };

  useEffect(() => {
    const u = readUser();
    if (u?.id && u?.role) fetchNotifications({ userId: u.id, userRole: u.role });
  }, [fetchNotifications]);

  useEffect(() => {
    const currentPath = location.pathname;
    if (!["/login", "/signup"].includes(currentPath)) {
      let stack = [];
      try {
        stack = JSON.parse(sessionStorage.getItem("navStack")) || [];
      } catch (_) {
        stack = [];
      }
      if (stack[stack.length - 1] !== currentPath) {
        stack.push(currentPath);
        sessionStorage.setItem("navStack", JSON.stringify(stack));
      }
    }
  }, [location]);

  useEffect(() => {
    setIsActive(false);
    setShowUserPopover(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowUserPopover(false);
      if (trackerRef.current && !trackerRef.current.contains(e.target)) setShowTracker(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Settings saves the profile, then announces it so the header name updates immediately.
  useEffect(() => {
    const bump = () => setProfileVersion((v) => v + 1);
    window.addEventListener("pp-profile-updated", bump);
    return () => window.removeEventListener("pp-profile-updated", bump);
  }, []);

  const handleMarkAllAsRead = () => {
    (notifications || []).filter((n) => !n.is_read).forEach((n) => markNotificationReadAPI(n.id));
  };

  const isRoute = (to, exact) => (exact ? location.pathname === to || location.pathname === `${to}/` : location.pathname.startsWith(to));

  const navItem = (to, icon, label, { exact = false } = {}) => (
    <li key={to}>
      <Link to={to} className={`sidebar_nav ${isRoute(to, exact) ? "active" : ""}`} data-tip={label} aria-label={label}>
        <FontAwesomeIcon icon={icon} />
        <span className="sb-label">{label}</span>
      </Link>
    </li>
  );

  return (
    <>
      <section className="sidebar_navbar" data-theme={theme}>
        {isMobile && isActive && <div className="exec-backdrop" onClick={() => setIsActive(false)} aria-hidden="true" />}
        <section id="exec-sidebar" className={`sidebar_container ${isActive ? "active" : ""}`}>
          <div className="sidebar_heading">
            <button
              type="button"
              className="exec-hamburger exec-hamburger--sidebar"
              onClick={handleHamburger}
              aria-label={isMobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={isMobile ? isActive : !collapsed}
              aria-controls="exec-sidebar"
              data-tip={collapsed && !isMobile ? "Expand sidebar" : undefined}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <span className="sidebar_brand">CRM</span>
          </div>
          <nav className="navbar_container" aria-label="Main">
            <ul>
              {portal ? (
                <>
                  {navItem("/process", faGauge, "Process Dashboard", { exact: true })}
                  {navItem("/processperson/client/all-clients", faAddressBook, "All Clients")}
                </>
              ) : (
                <>
                  {navItem("/process", faHouse, "Dashboard", { exact: true })}
                  {navItem("/process/freshlead", faUsers, "Fresh Leads")}
                  {navItem("/process/process-follow-up", faList, "Follow-ups")}
                  {navItem("/process/rejected-leads", faCircleXmark, "Rejected Leads")}
                  {navItem("/process/finalstage-leads", faFlagCheckered, "Final Stage")}
                  {navItem("/process/completed-clients", faCircleCheck, "Completed Clients")}
                  <MessagingSidebarItem variant="exec" />
                  {navItem("/process/schedule", faFile, "Scheduled Meetings")}
                  {navItem("/process/elsa", faRobot, "ELSA AI")}
                  {navItem("/process/process-settings", faGear, "Settings")}
                </>
              )}
            </ul>
            {/* Manage Clients is pinned to the very bottom of the sidebar (margin-top: auto in manageClients.css). */}
            {!portal && (
              <ul className="pp-nav-bottom" aria-label="Clients">
                {navItem("/processperson/client", faAddressBook, "Manage Clients")}
              </ul>
            )}
          </nav>
        </section>

        <header className="navbar">
          <div className="menu_search">
            {isMobile && (
              <button type="button" className="exec-hamburger exec-hamburger--mobile" onClick={handleHamburger} aria-label="Open menu" aria-expanded={isActive} aria-controls="exec-sidebar">
                <FontAwesomeIcon icon={faBars} />
              </button>
            )}
            <button type="button" className="exec-iconbtn exec-back" onClick={handleBack} aria-label="Go back" title="Back">
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            {!portal && (
              <div className="lead-search">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="lead-search__icon" />
                <input
                  className="lead-search__input"
                  type="search"
                  placeholder="Search"
                  aria-label="Search"
                  onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          <ProcessClock clock={clock} />

          <div className="navbar_icons">
            <div className="notification-wrapper">
              <button type="button" className="exec-iconbtn" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"} title="Notifications" onClick={() => navigate("/process/notification")}>
                <FontAwesomeIcon icon={faBell} />
              </button>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </div>

            <div ref={trackerRef} style={{ position: "relative" }}>
              <button type="button" className="exec-iconbtn" aria-label="Activity tracker" aria-expanded={showTracker} title="Activity tracker" onClick={() => setShowTracker((p) => !p)}>
                <FontAwesomeIcon icon={faClock} />
              </button>
              {showTracker && (
                <div className="activity-tracker-wrapper">
                  <ProcessActivity clock={clock} />
                </div>
              )}
            </div>

            <span className="exec-divider" aria-hidden="true" />

            <div className="user-icon-wrapper" ref={popoverRef}>
              <button type="button" className="exec-profile" aria-haspopup="menu" aria-expanded={showUserPopover} onClick={() => setShowUserPopover((p) => !p)}>
                <ProfileAvatar className="exec-profile__avatar" url={null} initial={initial} alt="" />
                <span className="exec-profile__text">
                  <span className="exec-profile__name">{name}</span>
                  <span className="exec-profile__role">Process Person</span>
                </span>
                <FontAwesomeIcon icon={faChevronDown} className="exec-profile__caret" />
              </button>

              {showUserPopover && (
                <div className="user_popover" role="menu">
                  {executiveLoading ? (
                    <p>Loading user details...</p>
                  ) : (
                    <>
                      <div className="user_details">
                        <ProfileAvatar className="user_avatar" url={null} initial={initial} alt="" />
                        <div className="user_identity">
                          <p className="user_name">{name}</p>
                          {email && <p className="user_email">{email}</p>}
                          <p className="user_role">Process Person</p>
                        </div>
                      </div>
                      <Link to="/process/process-settings" className="exec-menu-link" role="menuitem" onClick={() => setShowUserPopover(false)}>
                        <FontAwesomeIcon icon={faGear} /> Settings
                      </Link>
                      <button className="logout_btns" role="menuitem" onClick={handleLogout} disabled={isLoggingOut} aria-label={isLoggingOut ? "Logging out, please wait" : "Logout"}>
                        <FontAwesomeIcon icon={isLoggingOut ? faSpinner : faRightFromBracket} className={isLoggingOut ? "logout-spinner" : ""} />
                        <span className="logout-text">{isLoggingOut ? "Logging out" : "Logout"}</span>
                        {isLoggingOut && <span className="loading-dots"></span>}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {clock?.onBreak && (
          <div className="blur-screen">
            <div className="floating-icons">
              {breakIcons.map((icon, index) => (
                <FontAwesomeIcon key={index} icon={icon} className="floating-icon" />
              ))}
            </div>
            <div className="break-message">
              <FontAwesomeIcon icon={faMugHot} /> You are on a break
            </div>
            <div className="timer-display">{clock?.breakTimer}</div>
            <button className="stop-break-btn" onClick={clock?.toggleBreak} disabled={clock?.busy}>
              <FontAwesomeIcon icon={faStopCircle} /> Stop break
            </button>
          </div>
        )}
      </section>

      <BeepNotification
        notifications={notifications}
        unreadCount={unreadCount}
        onDismissPopup={() => {}}
        onMarkAllRead={handleMarkAllAsRead}
        onViewNotification={() => navigate("/process/notification")}
      />
    </>
  );
};

export default ProcessSidebarNavbar;

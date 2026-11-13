import React, { useEffect, useState, useRef, useContext } from "react";
import { MessagingSidebarItem } from "../features/Messaging/MessagingNav";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "../styles/sidebar.css";
import BeepNotification from "../BeepNotification";
import ExecutiveActivity from "../features/executive/ExecutiveActivity";
import { useApi } from "../context/ApiContext";
import { useAuth } from "../context/AuthContext";
import { ThemeContext } from "../features/admin/ThemeContext";
import ExecutiveClock from "../features/executive/ExecutiveClock";
import { useBreakTimer } from "../context/breakTimerContext";
import { displayName, initialOf } from "../utils/userDisplay";
import LeadSearch from "../features/executive/LeadSearch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faHouse,
  faCircleCheck,
  faUsers,
  faList,
  faClock,
  faCircleXmark,
  faFile,
  faGear,
  faArrowLeft,
  faBell,
  faRobot,
  faChevronDown,
  faRightFromBracket,
  faMugHot,
  faPersonWalking,
  faBed,
  faCouch,
  faUmbrellaBeach,
  faPeace,
  faBookOpen,
  faMusic,
  faHeadphones,
  faYinYang,
  faStopCircle,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

// Break timer icons
const breakIcons = [
  faMugHot,
  faPersonWalking,
  faBed,
  faCouch,
  faUmbrellaBeach,
  faPeace,
  faBookOpen,
  faMusic,
  faHeadphones,
  faYinYang,
];

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

// collapsed / onToggleCollapse come from ExecutiveLayout (it owns the saved
// preference). On phones/tablets the hamburger opens the off-canvas drawer instead.
const SidebarandNavbar = ({ collapsed = false, onToggleCollapse = () => {} }) => {
  const { breakTimer, stopBreak, isBreakActive, resetBreakTimer } = useBreakTimer();
  const isMobile = useIsMobile();

  const { logout } = useAuth();
  const {
    executiveInfo,
    executiveLoading,
    fetchNotifications,
    unreadCount,
    notifications,
    markNotificationReadAPI,
  } = useApi();
  const { theme } = useContext(ThemeContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);

  const popoverRef = useRef(null);
  const userIconRef = useRef(null);
  const historyStackRef = useRef([]);

  // Hamburger: collapse / expand on desktop, open / close the drawer on mobile.
  const handleHamburger = () => (isMobile ? setIsActive((prev) => !prev) : onToggleCollapse());
  const closeDrawer = () => setIsActive(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // logout() saves the work session first (a break in progress is closed too).
      await logout();
      resetBreakTimer();
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  const handleBack = () => {
    let stack = JSON.parse(sessionStorage.getItem("navStack")) || [];
    stack.pop();
    while (stack.length > 0) {
      const prev = stack.pop();
      if (prev !== "/login" && prev !== "/signup") {
        sessionStorage.setItem("navStack", JSON.stringify(stack));
        navigate(prev);
        return;
      }
    }
    navigate("/executive");
  };
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.id && user?.role) {
      fetchNotifications({ userId: user.id, userRole: user.role });
    }
  }, [fetchNotifications]);

  // BeepNotification handlers
  const handleDismissBeepNotification = () => {
    console.log("BeepNotification dismissed");
  };

  useEffect(() => {
    const currentPath = location.pathname;
    if (!["/login", "/signup"].includes(currentPath)) {
      let stack = JSON.parse(sessionStorage.getItem("navStack")) || [];
      if (stack[stack.length - 1] !== currentPath) {
        stack.push(currentPath);
        sessionStorage.setItem("navStack", JSON.stringify(stack));
      }
      historyStackRef.current = stack;
    }
  }, [location]);

  useEffect(() => {
    setIsActive(false); // close the mobile drawer after navigating
  }, [location.pathname]);

  const handleMarkAllAsRead = () => {
    const unreadNotifications = notifications.filter((n) => !n.is_read);
    unreadNotifications.forEach((notification) => {
      markNotificationReadAPI(notification.id);
    });
  };
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close user popover if clicked outside
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        userIconRef.current &&
        !userIconRef.current.contains(event.target)
      ) {
        setShowUserPopover(false);
      }

      // Close tracker if clicked outside
      const trackerButton = document.querySelector(".fa-clock");
      const trackerWrapper = document.querySelector(
        ".activity-tracker-wrapper"
      );
      if (
        trackerWrapper &&
        !trackerWrapper.contains(event.target) &&
        trackerButton &&
        !trackerButton.contains(event.target)
      ) {
        setShowTracker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isRoute = (to, exact) => (exact ? location.pathname === to || location.pathname === to + "/" : location.pathname.startsWith(to));

  // One sidebar link: icon + label (label hidden when collapsed) + tooltip text.
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
        {isMobile && isActive && <div className="exec-backdrop" onClick={closeDrawer} aria-hidden="true" />}
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
              {navItem("/executive", faHouse, "Dashboard", { exact: true })}
              {navItem("/executive/freshlead", faUsers, "Fresh Leads")}
              {navItem("/executive/follow-up", faList, "Follow-ups")}
              {navItem("/executive/customer", faCircleCheck, "Converted Leads")}
              {navItem("/executive/close-leads", faCircleXmark, "Closed Leads")}
              <MessagingSidebarItem variant="exec" />
              {navItem("/executive/elsa", faRobot, "ELSA AI")}
              {navItem("/executive/schedule", faFile, "Scheduled Meetings")}
              {navItem("/executive/settings", faGear, "Settings")}
            </ul>
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
            <LeadSearch />
          </div>

          <ExecutiveClock />

          <div className="navbar_icons">
            <div className="notification-wrapper">
              <button type="button" className="exec-iconbtn" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"} title="Notifications" onClick={() => navigate("/executive/notification")}>
                <FontAwesomeIcon icon={faBell} />
              </button>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </div>

            <button type="button" className="exec-iconbtn" aria-label="Activity tracker" aria-expanded={showTracker} title="Activity tracker" onClick={() => setShowTracker((prev) => !prev)}>
              <FontAwesomeIcon icon={faClock} />
            </button>

            {showTracker && (
              <div className="activity-tracker-wrapper">
                <ExecutiveActivity />
              </div>
            )}

            <span className="exec-divider" aria-hidden="true" />

            <div className="user-icon-wrapper" ref={popoverRef}>
              <button
                type="button"
                ref={userIconRef}
                className="exec-profile"
                aria-haspopup="menu"
                aria-expanded={showUserPopover}
                onClick={() => setShowUserPopover((prev) => !prev)}
              >
                <span className="exec-profile__avatar" aria-hidden="true">
                  {initialOf(executiveInfo)}
                </span>
                <span className="exec-profile__text">
                  <span className="exec-profile__name">{displayName(executiveInfo) || "Account"}</span>
                  <span className="exec-profile__role">{executiveInfo?.role || "Executive"}</span>
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
                        <div className="user_avatar">{initialOf(executiveInfo)}</div>
                        <div className="user_identity">
                          <p className="user_name">{displayName(executiveInfo)}</p>
                          {executiveInfo?.email && <p className="user_email">{executiveInfo.email}</p>}
                          <p className="user_role">{executiveInfo?.role}</p>
                        </div>
                      </div>
                      <Link to="/executive/settings" className="exec-menu-link" role="menuitem" onClick={() => setShowUserPopover(false)}>
                        <FontAwesomeIcon icon={faGear} /> Settings
                      </Link>
                      <button
                        className="logout_btns"
                        role="menuitem"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        aria-label={isLoggingOut ? "Logging out, please wait" : "Logout"}
                      >
                        <FontAwesomeIcon icon={isLoggingOut ? faSpinner : faRightFromBracket} className={isLoggingOut ? "logout-spinner" : ""} />
                        <span className="logout-text">{isLoggingOut ? "Logging out" : "Logout"}</span>
                        {isLoggingOut && <span className="loading-dots"></span>}
                        {isLoggingOut && <span className="sr-only">Please wait while we log you out</span>}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Break timer overlay */}
        {isBreakActive && (
          <div className="blur-screen">
            <div className="floating-icons">
              {breakIcons.map((icon, index) => (
                <FontAwesomeIcon
                  key={index}
                  icon={icon}
                  className="floating-icon"
                />
              ))}
            </div>
            <div className="break-message">
              <FontAwesomeIcon icon={faMugHot} /> You are on a break
            </div>
            <div className="timer-display">{breakTimer}</div>
            <button className="stop-break-btn" onClick={stopBreak}>
              <FontAwesomeIcon icon={faStopCircle} /> Stop break
            </button>
          </div>
        )}

      </section>

      <BeepNotification
        notifications={notifications}
        unreadCount={unreadCount}
        onDismissPopup={handleDismissBeepNotification}
        onMarkAllRead={handleMarkAllAsRead}
        onViewNotification={() => navigate("/executive/notification")}
      />
    </>
  );
};

export default SidebarandNavbar;

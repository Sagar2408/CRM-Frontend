import React, { useEffect, useState, useRef, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "../styles/sidebar.css";
import BeepNotification from "../BeepNotification";
import ExecutiveActivity from "../features/executive/ExecutiveActivity";
import ChatbotAssistantModal from "../features/chatbot/ChatbotAssistantModal";
import { useApi } from "../context/ApiContext";
import { useAuth } from "../context/AuthContext";
import { ThemeContext } from "../features/admin/ThemeContext";
import useWorkTimer from "../features/executive/useLoginTimer";
import { useBreakTimer } from "../context/breakTimerContext";
import { SearchContext } from "../context/SearchContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faHouse,
  faUserPlus,
  faUsers,
  faList,
  faClock,
  faCircleXmark,
  faFile,
  faReceipt,
  faGear,
  faArrowLeft,
  faBell,
  faRobot,
  faCircleUser,
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
import { FaPlay, FaPause } from "react-icons/fa";

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

const SidebarandNavbar = () => {
  const { breakTimer, startBreak, stopBreak, isBreakActive, resetBreakTimer } =
    useBreakTimer();
  const timer = useWorkTimer();
  const chatbotRef = useRef(null);
  const chatbotHeaderRef = useRef(null);

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
  const { setSearchQuery } = useContext(SearchContext);
  const [isOpen, setIsOpen] = useState(
    () =>
      location.pathname.startsWith("/freshlead") ||
      location.pathname.startsWith("/follow-up") ||
      location.pathname.startsWith("/customer") ||
      location.pathname.startsWith("/close-leads")
  );
  const [isActive, setIsActive] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false); // New state for chatbot popup
  const [hourDeg, setHourDeg] = useState(0);
  const [minuteDeg, setMinuteDeg] = useState(0);
  const [secondDeg, setSecondDeg] = useState(0);

  const popoverRef = useRef(null);
  const userIconRef = useRef(null);
  const historyStackRef = useRef([]);

  const toggleSidebar = () => setIsActive((prev) => !prev);
  const toggle = async () => {
    if (!isBreakActive) {
      await startBreak();
    } else {
      await stopBreak();
    }
  };

  // New function to handle chatbot toggle
  const handleChatbotToggle = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login again");
      return;
    }
    setShowChatbot((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await stopBreak();
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
    if (!showChatbot || !chatbotRef.current || !chatbotHeaderRef.current)
      return;

    const popup = chatbotRef.current;
    const header = chatbotHeaderRef.current;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      const rect = popup.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      popup.style.position = "absolute";
      popup.style.zIndex = 10000;
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        popup.style.left = `${e.clientX - offsetX}px`;
        popup.style.top = `${e.clientY - offsetY}px`;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    header.style.cursor = "move";
    header.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      header.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [showChatbot]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.id && user?.role) {
      fetchNotifications({ userId: user.id, userRole: user.role });
    }
  }, [fetchNotifications]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setSecondDeg(now.getSeconds() * 6);
      setMinuteDeg(now.getMinutes() * 6 + now.getSeconds() * 0.1);
      setHourDeg((now.getHours() % 12) * 30 + now.getMinutes() * 0.5);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

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
    setIsOpen(false);
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

  return (
    <>
      <section className="sidebar_navbar" data-theme={theme}>
        <section className={`sidebar_container ${isActive ? "active" : ""}`}>
          <button className="menuToggle" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div className="sidebar_heading">
            <h1>CRM</h1>
          </div>
          <div>
            <h3 className="sidebar_crm">CRM</h3>
          </div>
          <nav className="navbar_container">
            <ul>
              <li>
                <Link to="/executive" className="sidebar_nav">
                  <FontAwesomeIcon icon={faHouse} /> Dashboard
                </Link>
              </li>
              <li style={{ position: "relative" }}>
                <Link
                  to="#"
                  className="sidebar_nav"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <FontAwesomeIcon icon={faUserPlus} /> Leads
                  <span style={{ marginLeft: "auto", fontSize: "12px" }}>
                    ▼
                  </span>
                </Link>
                {isOpen && (
                  <ul className="submenu_nav">
                    <li>
                      <Link
                        to="/executive/freshlead"
                        className="submenu_item"
                        onClick={() => setIsOpen(false)}
                      >
                        <FontAwesomeIcon icon={faUsers} /> Fresh Leads
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/executive/follow-up"
                        className="submenu_item"
                        onClick={() => setIsOpen(false)}
                      >
                        <FontAwesomeIcon icon={faList} /> Follow ups
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/executive/customer"
                        className="submenu_item"
                        onClick={() => setIsOpen(false)}
                      >
                        <FontAwesomeIcon icon={faClock} /> Convert
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/executive/close-leads"
                        className="submenu_item"
                        onClick={() => setIsOpen(false)}
                      >
                        <FontAwesomeIcon icon={faCircleXmark} /> Close
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <Link to="/executive/schedule" className="sidebar_nav">
                  <FontAwesomeIcon icon={faFile} /> Scheduled Meetings
                </Link>
              </li>
              <li>
                <Link to="/executive/invoice" className="sidebar_nav">
                  <FontAwesomeIcon icon={faReceipt} /> Invoice
                </Link>
              </li>
              <li>
                <Link to="/executive/settings" className="sidebar_nav">
                  <FontAwesomeIcon icon={faGear} /> Settings
                </Link>
              </li>
            </ul>
          </nav>
        </section>

        <section className="navbar">
          <div className="menu_search">
            <button className="menu_toggle" onClick={toggleSidebar}>
              <FontAwesomeIcon icon={faBars} />
            </button>
            <div className="search_bar">
              <FontAwesomeIcon
                icon={faArrowLeft}
                onClick={handleBack}
                style={{ fontSize: "20px", cursor: "pointer" }}
              />
              <input
                className="search-input-exec"
                placeholder="Search"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="compact-timer">
            <div className="timer-item">
              <button className="timer-btn-small">
                <FaPause />
              </button>
              <span className="timer-label-small">Work:</span>
              <span className="timer-box-small">{timer}</span>
            </div>

            <div className="analog-clock">
              <div
                className="hand hour"
                style={{ transform: `rotate(${hourDeg}deg)` }}
              ></div>
              <div
                className="hand minute"
                style={{ transform: `rotate(${minuteDeg}deg)` }}
              ></div>
              <div
                className="hand second"
                style={{ transform: `rotate(${secondDeg}deg)` }}
              ></div>
              <div className="center-dot"></div>
            </div>

            <div className="timer-item">
              <button className="timer-btn-small" onClick={toggle}>
                {isBreakActive ? <FaPause /> : <FaPlay />}
              </button>
              <span className="timer-label-small">Break:</span>
              <span className="timer-box-small">{breakTimer}</span>
            </div>
          </div>

          <div className="navbar_icons">
            <div className="navbar_divider"></div>
            <div className="notification-wrapper">
              <FontAwesomeIcon
                className="navbar_icon"
                icon={faBell}
                style={{ cursor: "pointer" }}
                title="Notifications"
                tabIndex="0"
                onClick={() => navigate("/executive/notification")}
              />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </div>

            {/* Updated chatbot icon to use popup instead of new window */}
            <FontAwesomeIcon
              className="navbar_icon bot_icon"
              icon={faRobot}
              onClick={handleChatbotToggle}
              title="Open ChatBot"
              style={{ cursor: "pointer" }}
            />
            <FontAwesomeIcon
              className="navbar_icon"
              icon={faClock}
              title="Toggle Activity Tracker"
              onClick={() => setShowTracker((prev) => !prev)}
              style={{ cursor: "pointer" }}
            />

            {showTracker && (
              <div className="activity-tracker-wrapper">
                <ExecutiveActivity />
              </div>
            )}

            <div className="user-icon-wrapper" ref={popoverRef}>
              <FontAwesomeIcon
                ref={userIconRef}
                className="navbar_icon"
                icon={faCircleUser}
                onClick={() => setShowUserPopover((prev) => !prev)}
              />

              {showUserPopover && (
                <div className="user_popover">
                  {executiveLoading ? (
                    <p>Loading user details...</p>
                  ) : (
                    <>
                      <div className="user_details">
                        <div className="user_avatar">
                          {executiveInfo.username?.charAt(0)}
                        </div>
                        <div>
                          <p className="user_name">{executiveInfo.username}</p>
                          <p className="user_role">{executiveInfo.role}</p>
                        </div>
                      </div>
                      <button
                        className="logout_btns"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        aria-label={
                          isLoggingOut ? "Logging out, please wait" : "Logout"
                        }
                      >
                        <FontAwesomeIcon
                          icon={isLoggingOut ? faSpinner : faRightFromBracket}
                          className={isLoggingOut ? "logout-spinner" : ""}
                        />
                        <span className="logout-text">
                          {isLoggingOut ? "Logging out" : "Logout"}
                        </span>
                        {isLoggingOut && <span className="loading-dots"></span>}
                        {isLoggingOut && (
                          <span className="sr-only">
                            Please wait while we log you out
                          </span>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

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

        {/* Chatbot Popup Overlay */}
        {showChatbot && (
          <ChatbotAssistantModal
            onClose={() => setShowChatbot(false)}
            token={localStorage.getItem("token")}
            popupRef={chatbotRef}
            headerRef={chatbotHeaderRef}
          />
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

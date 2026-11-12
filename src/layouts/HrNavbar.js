import React, { useState, useContext, useEffect, useRef,useCallback } from "react";
import { MessageNavIcon } from "../features/Messaging/MessagingNav";
import { useAuth } from "../context/AuthContext"; // using logoutManager from here
import { useApi } from "../context/ApiContext";
import { ThemeContext } from "../features/admin/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaSun,
  FaMoon,
  FaBell,
  FaUser,
  FaSpinner,
  FaSignOutAlt
} from "react-icons/fa";


function HrNavbar() {
  const [showPopover, setShowPopover] = useState(false);
  const { handleLogoutHr } = useAuth(); // ✅ Use the manager-specific logout
  const {getHrProfile}=useApi();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { changeTheme, theme } = useContext(ThemeContext);
  const {
    loading,
    fetchNotifications,
    notifications,
    unreadCount,
    unreadMeetingsCount,
  } = useApi();

  const navigate = useNavigate();
  const location = useLocation();
  const [localStorageUser, setLocalStorageUser] = useState(JSON.parse(localStorage.getItem("user")));
  const hoverTimeout = useRef(null);
  const isHovering = useRef(false);
  const badgeRef = useRef(null);
 
 
  useEffect(() => {
  const handleStorageChange = () => {
    setLocalStorageUser(JSON.parse(localStorage.getItem("user")));
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}, []);

  useEffect(() => {
    if (
      localStorageUser?.id &&
      localStorageUser?.role &&
      notifications.length === 0
    ) {
      fetchNotifications({
        userId: localStorageUser.id,
        userRole: localStorageUser.role,
      });
    }
}, [fetchNotifications, localStorageUser?.id, localStorageUser?.role, notifications.length]);

  useEffect(() => {
    if (unreadCount > 0 && badgeRef.current) {
      badgeRef.current.classList.add("bounce");
      const timer = setTimeout(() => {
        badgeRef.current.classList.remove("bounce");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [unreadCount,location.pathname]);
  const [hrProfile, setHrProfile] = useState(null);

  const fetchProfile = useCallback(async () => {
  try {
    const profile = await getHrProfile();
    console.log(profile, "p");
    setHrProfile(profile);
  } catch (err) {
    console.error("Failed to load profile:", err.response?.data?.error || err.message);
  }
}, [getHrProfile]);

const handleMouseEnter = useCallback(async () => {
  clearTimeout(hoverTimeout.current);
  isHovering.current = true;
  setShowPopover(true);

  if (!hrProfile && !loading) {
    console.log("Fetching profile on mouse enter");
    await fetchProfile();
  }
}, [hrProfile, loading, fetchProfile]);

  const handleMouseLeave = () => {
    isHovering.current = false;
    hoverTimeout.current = setTimeout(() => {
      if (!isHovering.current) {
        setShowPopover(false);
      }
    }, 200);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true); // Show spinner
      await handleLogoutHr(); // Your logout logic
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false); // Hide spinner
    }
  };
  

  const isLight = theme === "light";
  const handleToggle = () => {
    changeTheme(isLight ? "dark" : "light");
  };

  return (
    <div className="admin-navbar">
      <div className="header-icons" style={{ position: "relative" }}>
        {/* Theme Toggle */}
        <button
          onClick={handleToggle}
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          className="theme-toggle"
        >
          {isLight ? <FaMoon /> : <FaSun />}
        </button>

        <div className="admin-icons-group">
          <MessageNavIcon />

          <div
            className="icon-wrapper icon-bell"
            style={{ position: "relative" }}
            onClick={() => navigate("/hr/notification")}
          >
            <FaBell size={20} />
            {(unreadCount + unreadMeetingsCount) > 0 && (
              <span
                key={location.key}
                ref={badgeRef}
                className="admin-notification_badge bounce"
              >
                {unreadCount + unreadMeetingsCount}
              </span>
            )}
          </div>

          <div
            className="icon-wrapper icon-user"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <FaUser size={20} />
          </div>

          {showPopover && (
            <div
              className="admin_user_popover"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ position: "absolute", top: "100%", right: 0 }}
            >
              {loading ? (
                <div>Loading...</div>
              ) : (
                hrProfile && (
                  <div className="admin_user_details">
                    <div className="admin_user_avatar">
                      {hrProfile.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="admin_user_name">{hrProfile.name}</p>
                      <p className="admin_user_email">{hrProfile.email}</p>
                      <p className="admin_user_role">{hrProfile.role}</p>
                    </div>
                  </div>
                )
              )}
              <button className="logout_btn" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <>
                  <FaSpinner className="logout-spinner" />
                  <span className="logout-text">Logging out</span>
                </>
              ) : (
                <>
                  <FaSignOutAlt />
                  <span className="logout-text">Logout</span>
                </>
              )}
            </button>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HrNavbar;

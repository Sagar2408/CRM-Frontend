import React, { useState, useContext, useEffect, useRef,useCallback } from "react";
import { MessageNavIcon } from "../features/Messaging/MessagingNav";
import { useAuth } from "../context/AuthContext";
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

function TLNavbar() {
  const [showPopover, setShowPopover] = useState(false);
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { changeTheme, theme } = useContext(ThemeContext);
  const {
    getAllProfile,
    loading,
    fetchNotifications,
    notifications,
    unreadCount,
    unreadMeetingsCount
  } = useApi();

  const navigate = useNavigate();
  const location = useLocation();
  const hoverTimeout = useRef(null);
  const isHovering = useRef(false);
  const badgeRef = useRef(null);

  useEffect(() => {
      const localStorageUser = JSON.parse(localStorage.getItem("user"));

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
}, [fetchNotifications, notifications.length]);

  useEffect(() => {
    if (unreadCount > 0 && badgeRef.current) {
      badgeRef.current.classList.add("bounce");
      const timer = setTimeout(() => {
        badgeRef.current.classList.remove("bounce");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, unreadMeetingsCount,location.pathname]);


const[tlProfile,setTlProfile]=useState()
const fetchProfile = useCallback(async () => {
  try {
    const profile = await getAllProfile();
    const tl = profile.find((p) => p.role === "TL");
    setTlProfile(tl);
  } catch (err) {
    console.error("Failed to fetch TL profile", err);
  }
}, [getAllProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleMouseEnter = async () => {
    clearTimeout(hoverTimeout.current);
    isHovering.current = true;
    setShowPopover(true);

    if (!tlProfile && !loading) {
      await fetchProfile();
    }
  };

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
      setIsLoggingOut(true); // start spinner
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false); // stop spinner
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

        {/* Icon Group */}
        <div className="admin-icons-group">
  {/* 💬 Message Icon */}
  <MessageNavIcon />

  {/* 🔔 Bell Icon */}
  <div
    className="icon-wrapper icon-bell"
    style={{ position: "relative" }}
    onClick={() => navigate("/team-lead/notification")}
  >
    <FaBell size={20} />
    {(unreadCount + unreadMeetingsCount) > 0 && (
     <span
     key={location.key} // 👈 Forces re-render
     ref={badgeRef}
     className="admin-notification_badge bounce"
   >
     {unreadCount + unreadMeetingsCount}
   </span>
    )}
  </div>

  {/* 👤 User Icon */}
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
                tlProfile && tlProfile.role === "TL" &&(
                  <div className="admin_user_details">
                    <div className="admin_user_avatar">
                      {tlProfile.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="admin_user_name">{tlProfile.username}</p>
                      <p className="admin_user_email">{tlProfile.email}</p>
                      <p className="admin_user_role">{tlProfile.role}</p>
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

export default TLNavbar;

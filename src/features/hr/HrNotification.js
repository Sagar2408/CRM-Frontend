import React, { useEffect, useState, useMemo } from "react";
import { useApi } from "../../context/ApiContext";
import "../../styles/adminNotification.css";
import SidebarToggle from "../admin/SidebarToggle";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import useCanAssignLeads from "../../hooks/useCanAssignLeads";
import { NotificationsError } from "../../components/NotificationStatus";

function HrNotification() {
  const {
    notifications = [],
    notificationsLoading,
    notificationsError,
    fetchNotifications,
    markNotificationReadAPI,
    fetchExecutivesAPI,
    adminMeeting,
    readMeetings,
    markMeetingAsRead,
  } = useApi();

  const { isLoading, variant, showLoader, hideLoader } = useLoading();
  const canListExecutives = useCanAssignLeads();
  const [hasFetchedMeetings, setHasFetchedMeetings] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");
  const [currentPage, setCurrentPage] = useState(1);
  const [executiveMap, setExecutiveMap] = useState({});
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingPage, setMeetingPage] = useState(1);
  const itemsPerPage = 8;
  const meetingsPerPage = 8;

  const user = useMemo(() => JSON.parse(localStorage.getItem("user")), []);
  const sidebarCollapsed = localStorage.getItem("adminSidebarExpanded") === "false";

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        showLoader("Loading notifications...", "admin");

        if (user?.id && user?.role) {
          await fetchNotifications({ userId: user.id, userRole: user.role });
        }
      } catch (err) {
        console.error("❌ Failed to load notifications:", err);
      } finally {
        hideLoader();
      }
    };

    loadInitialData();
}, [fetchNotifications, hideLoader, showLoader, user.id, user.role]);

  // Executive names come from the lead-assignment list: only requested by someone allowed
  // to read it (Admin, or HR / Manager with Task Management).
  useEffect(() => {
    if (!canListExecutives) {
      // forget names read earlier (same object when already empty, so no re-render loop)
      setExecutiveMap((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    (async () => {
      try {
        const map = {};
        (await fetchExecutivesAPI()).forEach((exec) => {
          map[String(exec.id)] = exec.username;
        });
        setExecutiveMap(map);
      } catch (err) {
        console.error("❌ Failed to load executive names:", err);
      }
    })();
  }, [canListExecutives, fetchExecutivesAPI]);

  useEffect(() => {
    const loadMeetings = async () => {
      if (activeTab === "meetings" && !hasFetchedMeetings) {
        setMeetingsLoading(true);
        try {
          const data = await adminMeeting();
          setMeetings(data || []);
          setHasFetchedMeetings(true);
        } catch (error) {
          console.error("❌ Failed to fetch meetings:", error);
          setMeetings([]);
        } finally {
          setMeetingsLoading(false);
        }
      }
    };
    loadMeetings();
  }, [activeTab, adminMeeting, hasFetchedMeetings]);

  const currentNotifications = notifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(notifications.length / itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handleMeetingPrev = () => {
    if (meetingPage > 1) setMeetingPage((prev) => prev - 1);
  };

  const handleMeetingNext = () => {
    if (meetingPage < meetingTotalPages) setMeetingPage((prev) => prev + 1);
  };

  const handleMarkAsRead = (notificationId) => {
    markNotificationReadAPI(notificationId);
  };

  // ✅ Simply return the message as-is from the API
  const formatNotificationMessage = (notification) => {
    return notification.message;
  };

  // ✅ Helper function to get notification type for display
  const getNotificationType = (message) => {
    if (message.toLowerCase().includes("leave application")) {
      return "Leave Application";
    }
    if (message.toLowerCase().includes("copied")) {
      return "Copied";
    }
    return "Notification";
  };

  const unreadMeetingsCount = useMemo(() => {
    return meetings.filter((m) => !readMeetings[m.id]).length;
  }, [meetings, readMeetings]);

  const paginatedMeetings = useMemo(() => {
    const start = (meetingPage - 1) * meetingsPerPage;
    const end = meetingPage * meetingsPerPage;
    return meetings.slice(start, end);
  }, [meetings, meetingPage]);

  const meetingTotalPages = Math.ceil(meetings.length / meetingsPerPage);

  return (
    <div className={`admin-notification-layout ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      <aside className="admin-notification-sidebar">
        <SidebarToggle />
      </aside>

      <div className="admin-notification-wrapper">
        {isLoading && variant === "admin" && <AdminSpinner text="Loading Notification..." />}
        <h2 className="admin-notification-title">Notifications</h2>

        {/* Tabs */}
        <div className="admin-tab-buttons">
          <button
            className={`admin-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "meetings" ? "active" : ""}`}
            onClick={() => setActiveTab("meetings")}
          >
            Meetings: {unreadMeetingsCount > 0 && <span className="m-badge">{unreadMeetingsCount}</span>}
          </button>
        </div>

        {activeTab === "notifications" && (
          <NotificationsError
            error={notificationsError}
            onRetry={() => fetchNotifications({ userId: user.id, userRole: user.role })}
          />
        )}

        {/* Notifications Tab */}
        {notificationsLoading && activeTab === "notifications" ? (
          <p className="admin-notification-loading">Loading notifications...</p>
        ) : activeTab === "notifications" ? (
          <div className="admin-notification-content">
            <ul className="admin-notification-list">
              {currentNotifications
                .filter((n) => !n.message.toLowerCase().includes("meeting"))
                .map((n) => (
                  <li key={n.id} className={`admin-notification-item ${n.is_read ? "admin-notification-read" : ""}`}>
                    <div className="admin-notification-item-header">
                      <strong>{getNotificationType(n.message)}</strong>
                      <div className="admin-notification-meta">
                        <span className="admin-notification-time">
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </span>
                        <label className="admin-notification-checkbox">
                          <input
                            type="checkbox"
                            checked={n.is_read}
                            disabled={n.is_read}
                            onChange={() => handleMarkAsRead(n.id)}
                          />
                          Mark as read
                        </label>
                      </div>
                    </div>
                    <p className="admin-notification-message">
                      {formatNotificationMessage(n)}
                    </p>
                  </li>
                ))}
            </ul>

            {/* Pagination for Notifications */}
            <div className="admin-notification-pagination">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="admin-notification-pagination-btn">
                Prev
              </button>
              <span className="admin-notification-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="admin-notification-pagination-btn">
                Next
              </button>
            </div>
          </div>
        ) : meetingsLoading ? (
          <p className="admin-notification-loading">Loading meetings...</p>
        ) : (
          <div className="admin-meeting-notification-content">
            <ul className="admin-notification-list">
              {paginatedMeetings.length === 0 ? (
                <p style={{ textAlign: "center", color: "#777" }}>No meetings scheduled.</p>
              ) : (
                <>
                  <p style={{ padding: "8px 20px", fontWeight: "bold", color: "#555" }}>
                    Total Meetings: {meetings.length}
                  </p>
                  {paginatedMeetings.map((meeting) => {
                    const executiveName = executiveMap[String(meeting.executiveId)] || "Unknown";
                    const clientName = meeting.clientName || "Unnamed";
                    const time = new Date(meeting.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isRead = readMeetings[meeting.id];

                    return (
                      <li key={meeting.id} className={`admin-notification-item ${isRead ? "admin-notification-read" : ""}`}>
                        <div className="admin-notification-item-header">
                          <strong>Meeting</strong>
                          <div className="admin-notification-meta">
                            <span className="admin-notification-time">{time}</span>
                            <label className="admin-notification-checkbox">
                              <input
                                type="checkbox"
                                checked={isRead}
                                disabled={isRead}
                                onChange={() => markMeetingAsRead(meeting.id)}
                              />
                              Mark as read
                            </label>
                          </div>
                        </div>
                        <p className="admin-notification-message">
                          <strong>{executiveName}</strong> has a meeting with <strong>{clientName}</strong> at {time}
                        </p>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>

            {/* Pagination for Meetings */}
            {meetings.length > meetingsPerPage && (
              <div className="admin-notification-pagination">
                <button onClick={handleMeetingPrev} disabled={meetingPage === 1} className="admin-notification-pagination-btn">
                  Prev
                </button>
                <span className="admin-notification-page-info">
                  Page {meetingPage} of {meetingTotalPages}
                </span>
                <button onClick={handleMeetingNext} disabled={meetingPage === meetingTotalPages} className="admin-notification-pagination-btn">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HrNotification;
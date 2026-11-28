import React from "react";
import "../styles/notificationStatus.css";

/** Shown on a notification page when the list could not be loaded. Retry is manual. */
export const NotificationsError = ({ error, onRetry }) =>
  error ? (
    <div className="notification-load-error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  ) : null;

/** Small mark on a navbar bell: notifications are unavailable (not "none"). */
export const NotificationsUnavailableDot = ({ error }) =>
  error ? (
    <span className="notification-unavailable-dot" title={error} role="img" aria-label="Notifications unavailable">
      !
    </span>
  ) : null;

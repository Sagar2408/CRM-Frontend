import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { FaTimes, FaBell, FaCheck } from 'react-icons/fa';
import { BeepSettingsContext } from './context/BeepSettingsContext';
import { SoundGenerator, soundOptions } from './features/settings/SoundGenerator';
import '../src/styles/beepNotification.css';

// Popup auto-hides on its own after this long — the Executive is never
// required to interact with it just to make it (and its sound) stop.
export const POPUP_AUTO_DISMISS_MS = 4000;
// New unread notifications that arrive within this window of each other
// (e.g. several leads assigned back-to-back) are coalesced into a single
// popup + a single sound, instead of one per notification.
const BATCH_WINDOW_MS = 400;

const BeepNotification = ({
  notifications,
  unreadCount,
  onDismissPopup,
  onViewNotification,
}) => {
  const { settings } = useContext(BeepSettingsContext);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [notificationType, setNotificationType] = useState('');

  const soundGeneratorRef = useRef(null);
  const autoDismissTimeoutRef = useRef(null);
  const batchTimeoutRef = useRef(null);
  const pendingBatchRef = useRef([]);
  // Notification ids we've already alerted on, so a re-render, a
  // reconnect, or the same notification coming back from another fetch
  // never plays its sound or re-shows its popup a second time.
  const alertedIdsRef = useRef(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    soundGeneratorRef.current = new SoundGenerator();
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (soundGeneratorRef.current) {
        soundGeneratorRef.current.close();
      }
    };
  }, []);

  const playNotificationSound = useCallback(async () => {
    if (!settings.enabled || !soundGeneratorRef.current) return;
    const selectedSound = soundOptions.find((s) => s.id === settings.selectedSound);
    if (!selectedSound) return;
    try {
      // Also absorbs the browser's autoplay restriction, which can reject
      // this before any user gesture has happened on the page.
      await selectedSound.generator(soundGeneratorRef.current, settings.volume);
    } catch (error) {
      console.log('Audio play failed:', error);
    }
  }, [settings.enabled, settings.selectedSound, settings.volume]);

  const getNotificationMessage = useCallback((unreadBatch) => {
    const latest = unreadBatch[unreadBatch.length - 1];
    const message = latest?.message?.toLowerCase() || '';

    if (message.includes('you have been assigned a new lead')) {
      return {
        initialMessage:
          unreadBatch.length > 1
            ? `${unreadBatch.length} new leads assigned`
            : 'New lead assigned',
        type: 'lead',
      };
    }

    if (message.includes('reminder:') || message.includes('⏰ reminder:')) {
      if (message.includes('follow up')) {
        return { initialMessage: 'Follow-up reminder', type: 'followup' };
      }
      if (message.includes('meeting')) {
        return { initialMessage: 'Meeting reminder', type: 'meeting' };
      }
      return { initialMessage: 'Reminder notification', type: 'reminder' };
    }

    return { initialMessage: 'New notification', type: 'general' };
  }, []);

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = null;
    }
  }, []);

  const triggerAlert = useCallback(
    (batch) => {
      if (!isMountedRef.current || batch.length === 0) return;

      const { initialMessage, type } = getNotificationMessage(batch);
      setPopupMessage(initialMessage);
      setNotificationType(type);
      setShowPopup(true);
      playNotificationSound(); // one short sound per batch, never a loop

      clearAutoDismiss();
      autoDismissTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setShowPopup(false);
      }, POPUP_AUTO_DISMISS_MS);
    },
    [getNotificationMessage, playNotificationSound, clearAutoDismiss]
  );

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const freshUnread = notifications.filter(
      (n) => !n.is_read && !alertedIdsRef.current.has(n.id)
    );
    if (freshUnread.length === 0) return;

    freshUnread.forEach((n) => alertedIdsRef.current.add(n.id));
    pendingBatchRef.current = pendingBatchRef.current.concat(freshUnread);

    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    batchTimeoutRef.current = setTimeout(() => {
      const batch = pendingBatchRef.current;
      pendingBatchRef.current = [];
      batchTimeoutRef.current = null;
      triggerAlert(batch);
    }, BATCH_WINDOW_MS);
  }, [notifications, triggerAlert]);

  // If everything gets marked read elsewhere (e.g. the Executive opened
  // the notification panel from the bell) drop an open popup immediately
  // instead of leaving it displayed, and never on this account mark
  // anything as read ourselves.
  useEffect(() => {
    if (unreadCount === 0 && showPopup) {
      setShowPopup(false);
      clearAutoDismiss();
    }
  }, [unreadCount, showPopup, clearAutoDismiss]);

  useEffect(() => {
    return () => {
      clearAutoDismiss();
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    };
  }, [clearAutoDismiss]);

  const handleDismissPopup = useCallback(() => {
    setShowPopup(false);
    clearAutoDismiss();
    if (onDismissPopup) onDismissPopup();
  }, [onDismissPopup, clearAutoDismiss]);

  const handleViewNotification = useCallback(() => {
    setShowPopup(false);
    clearAutoDismiss();
    if (onViewNotification) onViewNotification();
  }, [onViewNotification, clearAutoDismiss]);

  if (!showPopup) return null;

  const getNotificationTitle = () => {
    switch (notificationType) {
      case 'lead':
        return 'New Lead Assignment';
      case 'followup':
        return 'Follow-up Reminder';
      case 'meeting':
        return 'Meeting Reminder';
      case 'reminder':
        return 'Task Reminder';
      default:
        return 'Notification Alert';
    }
  };

  return (
    <div className="beep-notification-overlay">
      <div className="beep-notification-popup">
        <div className="beep-notification-header">
          <div className="beep-notification-icon">
            <FaBell size={24} />
          </div>
          <div className="beep-notification-content">
            <h3 className="beep-notification-title">{getNotificationTitle()}</h3>
            <p className="beep-notification-message">{popupMessage}</p>
            {unreadCount > 0 && (
              <p className="beep-notification-count">
                You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            className="beep-notification-close"
            onClick={handleDismissPopup}
            aria-label="Close notification"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="beep-notification-actions">
          <button
            className="beep-notification-btn beep-notification-btn-secondary"
            onClick={handleDismissPopup}
          >
            Dismiss
          </button>
          <button
            className="beep-notification-btn beep-notification-btn-primary"
            onClick={handleViewNotification}
          >
            <FaCheck size={16} />
            View Notification
          </button>
        </div>
      </div>
    </div>
  );
};

export default BeepNotification;

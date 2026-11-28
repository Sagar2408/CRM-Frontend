import { useCallback, useContext, useRef, useState } from "react";
import { AuthContext } from "../context/authContextObject";
import { retryTransient } from "../utils/retryTransient";

export const NOTIFICATIONS_ERROR = "Notifications could not be loaded.";
const NONE = [];

/** Identifies the signed-in session; a new login (new token) is a new session. */
const sessionKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return `${user?.role || user?.type || ""}:${user?.id ?? ""}:${localStorage.getItem("token") || ""}`;
  } catch {
    return `::${localStorage.getItem("token") || ""}`;
  }
};

/**
 * The notification list shared by the navbars and notification pages (held by ApiContext).
 *  - one request at a time per session: callers that overlap share it
 *  - transient failures are retried a limited number of times, others never
 *  - one session never sees another session's list
 * `load` and `setNotifications` keep the same identity for the provider's lifetime, so they
 * are safe in effect dependencies.
 */
export default function useNotificationStore(load) {
  useContext(AuthContext); // re-render on login / logout, which do not reload the page
  const [store, setStore] = useState({ owner: null, items: NONE, loading: false, error: null });
  const inFlight = useRef(new Map());
  const loader = useRef(load);
  loader.current = load;

  const fetchNotifications = useCallback((params) => {
    const { userId, userRole } = params || {};
    if (!userId || !userRole) {
      console.warn("⚠️ User ID and User Role is required to fetch notifications");
      return Promise.resolve();
    }
    const owner = sessionKey();
    const running = inFlight.current.get(owner);
    if (running) return running;

    setStore((prev) =>
      prev.owner === owner ? { ...prev, loading: true, error: null } : { owner, items: NONE, loading: true, error: null }
    );
    const settle = (next) => setStore((prev) => (prev.owner === owner ? { ...prev, ...next, loading: false } : prev));

    const request = (async () => {
      try {
        const data = await retryTransient(() => loader.current({ userId, userRole }), {
          isStillWanted: () => sessionKey() === owner,
        });
        settle({ items: data || NONE, error: null });
      } catch (error) {
        console.error("❌ Error fetching notifications:", error);
        settle({ error: NOTIFICATIONS_ERROR }); // whatever was already shown stays
      } finally {
        inFlight.current.delete(owner);
      }
    })();
    inFlight.current.set(owner, request);
    return request;
  }, []);

  /** Accepts a new list or an updater function, like a state setter. */
  const setNotifications = useCallback((value) => {
    const owner = sessionKey();
    setStore((prev) => {
      const base = prev.owner === owner ? prev : { owner, items: NONE, loading: false, error: null };
      return { ...base, items: typeof value === "function" ? value(base.items) : value };
    });
  }, []);

  const mine = store.owner === sessionKey();
  return {
    notifications: mine ? store.items : NONE,
    notificationsLoading: mine && store.loading,
    notificationsError: mine ? store.error : null,
    fetchNotifications,
    setNotifications,
  };
}

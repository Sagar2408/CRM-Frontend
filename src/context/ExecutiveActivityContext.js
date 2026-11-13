import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  recordStartWork,
  recordStopWork,
  recordStartBreak,
  recordStopBreak,
  getActivityStatus,
  sendHeartbeat,
  leadtrackVisit,
  sendEmail,
  getAttendance,
} from "../services/executiveService";
import { AuthContext } from "./authContextObject";
import { getIdleSeconds } from "../utils/activityTracker";
import { formatDuration } from "../utils/timeFormat";

// 1. Create Context
const ExecutiveActivityContext = createContext();

// 2. Hook for consuming context
export const useExecutiveActivity = () => useContext(ExecutiveActivityContext);

const HEARTBEAT_MS = 30 * 1000;

const EMPTY_SESSION = {
  loaded: false,
  working: false,
  onBreak: false,
  workSeconds: 0,
  breakSeconds: 0,
  syncedAt: 0,
};

const isExecutiveUser = (user) => String(user?.role || "").toLowerCase() === "executive";

// 3. Provider Component
//
// The BACKEND owns work/break time (grouped per employee and calendar date).
// This provider only mirrors it: it starts the session when an executive is
// logged in, keeps it alive with a heartbeat, and lets break start/stop go
// through the API. The ticking display is computed locally by useWorkClock().
export const ExecutiveActivityProvider = ({ children }) => {
  const auth = useContext(AuthContext) || {};
  const { user, logout } = auth;
  const executive = isExecutiveUser(user);
  const userId = user?.id;

  const [session, setSession] = useState(EMPTY_SESSION);
  const [loading, setLoading] = useState(false);
  const [startTimeData, setStartTimeData] = useState(null);

  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const applyServerState = useCallback((state) => {
    if (!state) return;
    setSession({
      loaded: true,
      working: !!state.working,
      onBreak: !!state.onBreak,
      workSeconds: Number(state.workSeconds) || 0,
      breakSeconds: Number(state.breakSeconds) || 0,
      syncedAt: Date.now(), // local clock at receipt: immune to client/server clock skew
    });
  }, []);

  // ---------------------------------------
  // Start the work timer automatically when an executive logs in (or reloads
  // while logged in). Idempotent on the server: an already-open session is
  // reused and the day's accumulated time is resumed, never reset.
  // ---------------------------------------
  useEffect(() => {
    if (!executive || !userId) {
      setSession(EMPTY_SESSION);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await recordStartWork();
        if (cancelled) return;
        setStartTimeData(res?.activity || null);
        applyServerState(res?.state);
      } catch (error) {
        console.error("Error starting work session:", error.message);
        try {
          const fallback = await getActivityStatus();
          if (!cancelled) applyServerState(fallback);
        } catch (_) {
          /* offline: the heartbeat below keeps retrying */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [executive, userId, applyServerState]);

  // ---------------------------------------
  // Heartbeat: keeps the open session alive on the server, re-syncs totals
  // (other tabs, break state) and lets the server end an idle session.
  // ---------------------------------------
  useEffect(() => {
    if (!executive || !userId) return undefined;
    let stopped = false;

    const beat = async () => {
      if (stopped || !localStorage.getItem("token")) return;
      try {
        const res = await sendHeartbeat(getIdleSeconds());
        if (stopped) return;
        if (res?.inactive) {
          // Server already saved the session; finish the logout locally.
          logoutRef.current?.({ reason: "inactivity", sessionAlreadySaved: true });
          return;
        }
        if (res?.active === false && !res?.working && !res?.onBreak) {
          // No open session (e.g. closed in another tab): open one for this live client.
          const started = await recordStartWork();
          applyServerState(started?.state);
          return;
        }
        applyServerState(res);
      } catch (error) {
        // Network blip: the next beat retries; the server caps unseen time.
        console.warn("Heartbeat failed:", error.message);
      }
    };

    const interval = setInterval(beat, HEARTBEAT_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", beat);
    window.addEventListener("focus", onWake);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", beat);
      window.removeEventListener("focus", onWake);
    };
  }, [executive, userId, applyServerState]);

  // ---------------------------------------
  // Work Session Handlers
  // ---------------------------------------
  const handleStartWork = useCallback(async () => {
    try {
      setLoading(true);
      const res = await recordStartWork();
      setStartTimeData(res?.activity || null);
      applyServerState(res?.state);
    } catch (error) {
      console.error("Error recording start work:", error.message);
    } finally {
      setLoading(false);
    }
  }, [applyServerState]);

  const handleStopWork = useCallback(
    async (reason = "logout") => {
      try {
        setLoading(true);
        const res = await recordStopWork(reason);
        applyServerState(res?.state);
        return res;
      } catch (error) {
        console.error("Error stopping work:", error.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyServerState]
  );

  // ---------------------------------------
  // Break Handlers: starting a break pauses work time on the server; ending it
  // resumes it. Errors propagate so the caller can show them.
  // ---------------------------------------
  const handleStartBreak = useCallback(async () => {
    const res = await recordStartBreak();
    applyServerState(res?.state);
    return res;
  }, [applyServerState]);

  const handleStopBreak = useCallback(async () => {
    const res = await recordStopBreak();
    applyServerState(res?.state);
    return res?.breakDuration;
  }, [applyServerState]);

  // ---------------------------------------
  // Lead Visit Tracking
  // ---------------------------------------
  const leadtrack = useCallback(async (executiveId) => {
    try {
      setLoading(true);
      if (!executiveId) {
        console.error("Executive ID is missing.");
        return;
      }
      await leadtrackVisit(executiveId);
    } catch (error) {
      console.error("Error in lead tracking:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------
  // Email Sending Handler (still used by the Process panel)
  // ---------------------------------------
  const handleSendEmail = async ({
    templateId,
    executiveName,
    executiveEmail,
    clientEmail,
    emailBody,
    emailSubject,
  }) => {
    try {
      return await sendEmail({
        templateId,
        executiveName,
        executiveEmail,
        clientEmail,
        emailBody,
        emailSubject,
      });
    } catch (error) {
      console.error("Email sending failed:", error.message);
      throw error;
    }
  };

  const handleGetAttendance = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);
      const data = await getAttendance(startDate, endDate);
      return data || [];
    } catch (error) {
      console.error("Error fetching attendance:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Legacy shape kept for older callers.
  const status = useMemo(
    () => ({ workActive: session.working, breakActive: session.onBreak }),
    [session.working, session.onBreak]
  );

  return (
    <ExecutiveActivityContext.Provider
      value={{
        user,
        session,
        status,
        loading,
        startTimeData,
        setStartTimeData,
        handleStartWork,
        handleStopWork,
        handleStartBreak,
        handleStopBreak,
        handleSendEmail,
        leadtrack,
        handleGetAttendance,
      }}
    >
      {children}
    </ExecutiveActivityContext.Provider>
  );
};

/**
 * Live, ticking work/break clock derived from the server-synced session.
 * Lives in its own hook (own 1s interval) so only the components that SHOW the
 * time re-render every second - not every consumer of the activity context.
 */
export const useWorkClock = () => {
  const { session } = useExecutiveActivity() || { session: EMPTY_SESSION };
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session.working && !session.onBreak) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session.working, session.onBreak, session.syncedAt]);

  const elapsed = Math.max(0, Math.floor((now - session.syncedAt) / 1000));
  const workSeconds = session.workSeconds + (session.working ? elapsed : 0);
  const breakSeconds = session.breakSeconds + (session.onBreak ? elapsed : 0);

  return {
    loaded: session.loaded,
    working: session.working,
    onBreak: session.onBreak,
    workSeconds,
    breakSeconds,
    workTimer: formatDuration(workSeconds),
    breakTimer: formatDuration(breakSeconds),
  };
};

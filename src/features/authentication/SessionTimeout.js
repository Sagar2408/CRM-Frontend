import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getInactivitySettings } from "../../services/executiveService";
import { getLastActivity, installActivityListeners } from "../../utils/activityTracker";

// Automatic inactivity logout.
//
// The limit is a tenant setting managed by the Admin (Admin Settings -> Auto
// Logout) and read from the backend, so every user of a company shares it.
// Idleness is measured against an absolute "last activity" timestamp that is
// shared across tabs (utils/activityTracker.js), NOT by a countdown timer: a
// throttled background tab or a sleeping laptop cannot delay the logout,
// because the first check after waking sees the real idle time.
//
// On expiry the work session is saved first (AuthContext.logout with
// reason "inactivity"), then the user is signed out. The server independently
// enforces the same limit from the heartbeat (ExecutiveActivityContext), so the
// work session is closed correctly even if this component never runs.
const FALLBACK = { enabled: true, minutes: 45 }; // process / customer sessions and offline fallback
const CHECK_MS = 1000;
const WARN_SECONDS = 60;
const REFRESH_SETTINGS_MS = 5 * 60 * 1000;
const STAFF = ["admin", "executive", "manager", "hr"];

const readRole = () => {
  try {
    return String(JSON.parse(localStorage.getItem("user") || "{}")?.role || "").toLowerCase();
  } catch (_) {
    return "";
  }
};

const SessionTimeout = ({ timeout }) => {
  const { logout } = useAuth() || {};
  const logoutRef = useRef(logout);
  const firingRef = useRef(false);
  const configRef = useRef(timeout ? { enabled: true, minutes: Math.round(timeout / 60000) } : FALLBACK);
  const [remaining, setRemaining] = useState(null); // seconds, only inside the warning window

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const loadSettings = useCallback(async () => {
    if (!localStorage.getItem("token") || !STAFF.includes(readRole())) {
      configRef.current = timeout ? { enabled: true, minutes: Math.round(timeout / 60000) } : FALLBACK;
      return;
    }
    try {
      const data = await getInactivitySettings();
      configRef.current = {
        enabled: !!data.enabled,
        minutes: Number(data.minutes) || FALLBACK.minutes,
        fetched: true,
      };
    } catch (_) {
      /* keep the last known value */
    }
  }, [timeout]);

  useEffect(() => {
    const uninstall = installActivityListeners();
    loadSettings();
    const refresh = setInterval(loadSettings, REFRESH_SETTINGS_MS);

    const check = () => {
      if (firingRef.current) return;
      if (!localStorage.getItem("token")) {
        setRemaining(null);
        return;
      }
      const { enabled, minutes } = configRef.current;
      if (!enabled) {
        setRemaining(null);
        return;
      }
      const limitMs = minutes * 60 * 1000;
      const idleMs = Date.now() - getLastActivity();
      const left = Math.ceil((limitMs - idleMs) / 1000);
      if (left <= 0) {
        firingRef.current = true;
        setRemaining(null);
        Promise.resolve(logoutRef.current?.({ reason: "inactivity" })).finally(() => {
          firingRef.current = false;
        });
        return;
      }
      setRemaining(left <= WARN_SECONDS ? left : null);
    };

    const tick = setInterval(check, CHECK_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") {
        loadSettings();
        check();
      }
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    check();

    return () => {
      uninstall();
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [loadSettings]);

  // A login that happens without a page reload must fetch the tenant value too.
  useEffect(() => {
    const id = setInterval(() => {
      if (localStorage.getItem("token") && !configRef.current.fetched && STAFF.includes(readRole())) {
        configRef.current = { ...configRef.current, fetched: true };
        loadSettings();
      }
      if (!localStorage.getItem("token")) configRef.current = { ...configRef.current, fetched: false };
    }, 3000);
    return () => clearInterval(id);
  }, [loadSettings]);

  if (remaining === null) return null;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 100000,
        maxWidth: 340,
        background: "#111827",
        color: "#fff",
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>Still there?</strong>
      You will be logged out for inactivity in{" "}
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
        {mm}:{ss}
      </span>
      . Move the mouse or press a key to stay signed in.
    </div>
  );
};

export default SessionTimeout;

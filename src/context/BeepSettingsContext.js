import React, { createContext, useState, useCallback } from "react";

export const BeepSettingsContext = createContext();

export const BEEP_DEFAULTS = {
  selectedSound: "beep1",
  volume: 50,
  timing: 5, // seconds between notification sounds
  enabled: true,
  reminderDelay: 30, // seconds before a dismissed popup reminds again
};

const LEGACY_KEY = "beepSoundSettings";

// Settings are kept per signed-in user so two people sharing a browser do not
// overwrite each other's preferences. The legacy shared key is still read as a
// fallback so nobody loses their existing choice.
const currentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.id ?? localStorage.getItem("executiveId") ?? null;
  } catch (_) {
    return localStorage.getItem("executiveId");
  }
};
export const beepStorageKey = () => {
  const id = currentUserId();
  return id ? `${LEGACY_KEY}_${id}` : LEGACY_KEY;
};

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Merge over defaults and clamp every value so a corrupt/old record can't break playback. */
export const sanitizeBeepSettings = (raw) => {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    selectedSound: typeof r.selectedSound === "string" && r.selectedSound ? r.selectedSound : BEEP_DEFAULTS.selectedSound,
    volume: clampInt(r.volume, 0, 100, BEEP_DEFAULTS.volume),
    timing: clampInt(r.timing, 1, 3600, BEEP_DEFAULTS.timing),
    enabled: typeof r.enabled === "boolean" ? r.enabled : BEEP_DEFAULTS.enabled,
    reminderDelay: clampInt(r.reminderDelay, 10, 300, BEEP_DEFAULTS.reminderDelay),
  };
};

export const loadBeepSettings = () => {
  try {
    const saved = localStorage.getItem(beepStorageKey()) ?? localStorage.getItem(LEGACY_KEY);
    return sanitizeBeepSettings(saved ? JSON.parse(saved) : null);
  } catch (_) {
    return { ...BEEP_DEFAULTS };
  }
};

/** Returns true when the settings were actually persisted. */
export const saveBeepSettings = (settings) => {
  try {
    localStorage.setItem(beepStorageKey(), JSON.stringify(sanitizeBeepSettings(settings)));
    return true;
  } catch (_) {
    return false;
  }
};

export const BeepSettingsProvider = ({ children }) => {
  const [settings, setLocal] = useState(loadBeepSettings);

  const setSettings = useCallback((next) => {
    const clean = sanitizeBeepSettings(next);
    setLocal(clean);
    saveBeepSettings(clean);
  }, []);

  return <BeepSettingsContext.Provider value={{ settings, setSettings }}>{children}</BeepSettingsContext.Provider>;
};

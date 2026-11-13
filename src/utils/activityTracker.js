// Tracks the user's last real interaction, shared across browser tabs through
// localStorage so that activity in ANY tab keeps the session alive and idleness
// is measured against absolute timestamps (Date.now()). Absolute timestamps are
// what make the inactivity logout reliable: browsers throttle timers in
// background tabs and freeze them entirely while a laptop sleeps, but when the
// page wakes up the stored timestamp is still correct, so the very next check
// sees the real idle time.
const KEY = "crm.lastActivityAt";
const WRITE_THROTTLE_MS = 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart", "click"];

let lastWrite = 0;
let memoryValue = 0;
let installed = 0;

const safeGet = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch (_) {
    return 0;
  }
};

export function markActivity(force = false) {
  const now = Date.now();
  memoryValue = now;
  if (!force && now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(KEY, String(now));
  } catch (_) {
    /* storage unavailable: the in-memory value still covers this tab */
  }
}

export function getLastActivity() {
  const v = Math.max(memoryValue, safeGet());
  if (v) return v;
  // Nothing recorded yet (fresh install of the listeners): start counting now.
  memoryValue = Date.now();
  return memoryValue;
}

export function getIdleSeconds() {
  return Math.max(0, Math.floor((Date.now() - getLastActivity()) / 1000));
}

export function clearActivity() {
  memoryValue = 0;
  try {
    localStorage.removeItem(KEY);
  } catch (_) {
    /* ignore */
  }
}

// Reference-counted so StrictMode double-mounts and multiple consumers are safe.
export function installActivityListeners() {
  installed += 1;
  if (installed === 1) {
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
  }
  return () => {
    installed = Math.max(0, installed - 1);
    if (installed === 0) EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
  };
}

function onActivity() {
  markActivity();
}

export const ACTIVITY_STORAGE_KEY = KEY;

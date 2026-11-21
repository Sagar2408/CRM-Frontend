// Shared constants and pure helpers for the Process Person follow-up screens.

// The stored follow_up_type values the Process Person can create. (final / rejected have their own
// actions; "other" only exists on old records.)
export const CATEGORIES = [
  { value: "document collection", label: "Document Collection" },
  { value: "payment follow-up", label: "Payment Follow-up" },
  { value: "visa filing", label: "Visa Filing" },
  { value: "meeting", label: "Meeting" },
];

export const TYPE_LABELS = {
  "document collection": "Document collection",
  "payment follow-up": "Payment follow-up",
  "visa filing": "Visa filing",
  meeting: "Meeting",
  other: "Other",
  rejected: "Rejected",
  final: "Final",
};

// Only records of these types can be corrected from the form (the server enforces the same).
export const EDITABLE_TYPES = ["document collection", "payment follow-up", "visa filing", "other"];

// How the person got in touch. Nothing is sent from the CRM; this only records the channel.
export const CONTACT_METHODS = [
  { value: "Call", label: "Call" },
  { value: "Email", label: "Email" },
  { value: "Call/Email", label: "Call & Email" },
];

// Stored spelling is "Agressive"; the UI says "Aggressive" and the server accepts both.
export const RATINGS = [
  { value: "Aggressive", label: "Aggressive" },
  { value: "Calm", label: "Calm" },
  { value: "Neutral", label: "Neutral" },
];

export const ratingLabel = (v) => {
  const k = String(v || "").toLowerCase();
  if (k === "agressive" || k === "aggressive") return "Aggressive";
  return RATINGS.find((r) => r.value.toLowerCase() === k)?.label || v || "";
};
export const ratingKey = (v) => {
  const k = String(v || "").toLowerCase();
  return k === "aggressive" ? "agressive" : k; // matches the stored spelling used by the CSS modifiers
};
export const typeLabel = (t) => TYPE_LABELS[String(t || "").toLowerCase().trim()] || (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : "-");
export const contactLabel = (v) => CONTACT_METHODS.find((c) => c.value === v)?.label || v || "-";

const pad = (n) => String(n).padStart(2, "0");

// Local date / time (NOT toISOString, which is UTC and shifts the day for most of the world).
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// follow_up_date "YYYY-MM-DD" + follow_up_time "HH:MM[:SS]" -> local Date (null when unusable)
export const toDateTime = (date, time) => {
  if (!date) return null;
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  const [hh = 0, mm = 0] = String(time || "00:00").split(":").map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  return Number.isNaN(+out) ? null : out;
};

export const formatWhen = (dt) =>
  dt
    ? `${dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Not set";

export const formatStamp = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(+d) ? formatWhen(d) : "";
};

// Validates the follow-up form. Returns { field: message } (empty object = valid).
export function validateFollowUp(f, now = new Date()) {
  const errors = {};
  if (!f.contactMethod) errors.contactMethod = "Choose how you connected.";
  if (!f.category) errors.category = "Choose a follow-up category.";
  if (!f.rating) errors.rating = "Choose an interaction rating.";
  if (!String(f.comments || "").trim()) errors.comments = "Add a comment about this follow-up.";
  else if (String(f.comments).length > 2000) errors.comments = "Comments can be at most 2000 characters.";
  if (!f.date) errors.date = "Pick a date.";
  if (!f.time) errors.time = "Pick a time.";
  if (f.category === "document collection" && !f.documentName) errors.documentName = "Choose the document you are collecting.";
  if (f.category === "meeting" && f.date && f.time) {
    const when = toDateTime(f.date, f.time);
    if (!when || +when <= +now) errors.date = "A meeting must be scheduled for a future date and time.";
  }
  return errors;
}

// Display helpers shared by the Master Control Center and the Company Admin billing page.

export const PLAN_CYCLES = [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["half_yearly", "Half-yearly"], ["yearly", "Yearly"]];
export const CYCLE_MONTHS = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
const CYCLE_LABELS = { ...Object.fromEntries(PLAN_CYCLES), one_time: "One-time" };
const CYCLE_SUFFIX = { monthly: "month", quarterly: "quarter", half_yearly: "6 months", yearly: "year" };

export const PAYMENT_METHODS = [["bank_transfer", "Bank transfer"], ["upi", "UPI"], ["cash", "Cash"], ["cheque", "Cheque"], ["card", "Card"], ["other", "Other"]];
export const PAYMENT_STATUS_LABELS = { paid: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded" };

export const EVENT_LABELS = {
  imported: "Existing subscription",
  assigned: "Plan assigned",
  plan_changed: "Plan changed",
  price_changed: "Price changed",
  updated: "Terms updated",
  renewed: "Renewed",
  expired: "Expired",
  deactivated: "Deactivated",
  reactivated: "Reactivated",
};
// How an earlier agreement ended (company billing page).
export const OUTCOME_LABELS = { expired: "Expired", renewed: "Renewed", plan_changed: "Replaced", price_changed: "Repriced", updated: "Updated", assigned: "Replaced" };

export const cycleLabel = (c) => CYCLE_LABELS[c] || "Not set";
export const methodLabel = (m) => Object.fromEntries(PAYMENT_METHODS)[m] || m;

export const money = (amount, currency = "INR") => {
  if (amount === null || amount === undefined || amount === "") return "Not recorded";
  const n = Number(amount);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
};
export const pricePer = (amount, cycle, currency) =>
  amount === null || amount === undefined ? "Price not recorded" : `${money(amount, currency)}${CYCLE_SUFFIX[cycle] ? ` / ${CYCLE_SUFFIX[cycle]}` : ""}`;

// Subscription dates are calendar dates (UTC), the same day the server enforces.
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export const limitText = (v, unit = "") => (v === null || v === undefined || v === "" ? "Not specified" : `${Number(v).toLocaleString("en-IN")}${unit}`);

export const remainingText = (days) => {
  if (days === null || days === undefined) return "No expiry date";
  if (days < 0) return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
};

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export const todayInput = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

/** YYYY-MM-DD plus N months, clamped to the end of a shorter month (31 Jan + 1 = 28/29 Feb). */
export const addMonthsInput = (value, months) => {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
};
export const addDaysInput = (value, days) => {
  if (!value) return "";
  const x = new Date(`${value}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

/** Save a blob response as a file. */
export const saveBlob = (blob, name) => {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name || "receipt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};

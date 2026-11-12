export const GOAL_METRICS = [
  { value: "assigned", label: "Leads Assigned" },
  { value: "followUps", label: "Follow-ups" },
  { value: "converted", label: "Converted Leads" },
  { value: "meetings", label: "Meetings" },
  { value: "closed", label: "Closed Leads" },
];

export const STAT_TILES = [
  { key: "assigned", label: "Leads assigned" },
  { key: "fresh", label: "Fresh leads" },
  { key: "followUps", label: "Follow-ups completed" },
  { key: "converted", label: "Converted leads" },
  { key: "closed", label: "Closed leads" },
  { key: "meetings", label: "Meetings completed" },
];

export const STATUS_LABEL = { active: "Active", upcoming: "Upcoming", ended: "Ended", archived: "Archived" };

export const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "");
export const duration = (t) => `${fmtDate(t.startDate)} – ${t.endDate ? fmtDate(t.endDate) : "ongoing"}`;
export const pct = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
export const barWidth = (n) => `${Math.max(0, Math.min(100, Number(n) || 0))}%`;

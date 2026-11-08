// Shared logic for the Full Report / Compare pages. Pure functions so the
// calculations can be unit-tested without rendering anything.

export const METRICS = [
  { key: "fresh", label: "Fresh Leads", short: "Fresh" },
  { key: "followUp", label: "Follow-ups", short: "Follow-ups" },
  { key: "converted", label: "Converted Clients", short: "Converted" },
  { key: "closed", label: "Closed Clients", short: "Closed" },
  { key: "meetings", label: "Meetings", short: "Meetings" },
];

export const RANGE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

// Local calendar date (YYYY-MM-DD). toISOString() would shift the day for
// anyone east/west of UTC, which broke "today" filters before.
export const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Preset -> { startDate, endDate } ("" = unbounded). `now` is injectable for tests.
export const rangeFor = (preset, custom = {}, now = new Date()) => {
  if (preset === "today") return { startDate: toISODate(now), endDate: toISODate(now) };
  if (preset === "7") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: toISODate(start), endDate: toISODate(now) };
  }
  if (preset === "month") {
    return { startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toISODate(now) };
  }
  if (preset === "custom") return { startDate: custom.from || "", endDate: custom.to || "" };
  return { startDate: "", endDate: "" };
};

export const rangeError = ({ startDate, endDate }) =>
  startDate && endDate && startDate > endDate ? "The start date must be before the end date." : "";

// Query params for the API: only the bounds that are set.
export const rangeParams = ({ startDate, endDate }) => {
  const p = {};
  if (startDate) p.startDate = startDate;
  if (endDate) p.endDate = endDate;
  return p;
};

const isFresh = (l) =>
  ["new", "assigned"].includes((l.status || "").toLowerCase()) ||
  ["new", "assigned"].includes((l.clientLead?.status || "").toLowerCase());

// Latest follow-up per lead, keeping only leads still in "Follow-Up" status.
export const latestFollowUps = (followUps = []) => {
  const byLead = {};
  followUps.forEach((f) => {
    const cur = byLead[f.fresh_lead_id];
    if (!cur || new Date(f.createdAt) >= new Date(cur.createdAt)) byLead[f.fresh_lead_id] = f;
  });
  return Object.values(byLead).filter((f) => (f.clientLeadStatus || "").toLowerCase() === "follow-up");
};

export const summarize = (report) => ({
  fresh: (report.leads || []).filter(isFresh).length,
  followUp: latestFollowUps(report.followUps).length,
  converted: (report.converted || []).length,
  closed: (report.closed || []).length,
  meetings: (report.meetings || []).length,
});

// converted / (fresh + follow-up + converted + closed); null when nothing to divide.
export const conversionRate = (counts) => {
  const total = counts.fresh + counts.followUp + counts.converted + counts.closed;
  return total > 0 ? Math.round((counts.converted / total) * 1000) / 10 : null;
};

export const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
export const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

// Column definitions per metric. `get` produces the displayed / exported value.
export const COLUMNS = {
  fresh: [
    { header: "Name", get: (r) => r.name },
    { header: "Email", get: (r) => r.email },
    { header: "Phone", get: (r) => r.phone },
    { header: "Status", get: (r) => r.status },
    { header: "Assigned On", get: (r) => fmtDate(r.date) },
  ],
  followUp: [
    { header: "Name", get: (r) => r.name },
    { header: "Email", get: (r) => r.email },
    { header: "Phone", get: (r) => r.phone },
    { header: "Status", get: (r) => r.status },
    { header: "Last Follow-up", get: (r) => fmtDate(r.date) },
  ],
  converted: [
    { header: "Name", get: (r) => r.name },
    { header: "Email", get: (r) => r.email },
    { header: "Phone", get: (r) => r.phone },
    { header: "Status", get: (r) => r.status },
    { header: "Converted On", get: (r) => fmtDate(r.date) },
  ],
  closed: [
    { header: "Name", get: (r) => r.name },
    { header: "Email", get: (r) => r.email },
    { header: "Phone", get: (r) => r.phone },
    { header: "Status", get: (r) => r.status },
    { header: "Closed On", get: (r) => fmtDate(r.date) },
  ],
  meetings: [
    { header: "Client", get: (r) => r.name },
    { header: "Email", get: (r) => r.email },
    { header: "Phone", get: (r) => r.phone },
    { header: "Start", get: (r) => fmtDateTime(r.date) },
    { header: "End", get: (r) => fmtDateTime(r.end) },
  ],
};

// Normalised rows for a metric's table. The table always lists exactly the
// records that were counted in the KPI card.
export const rowsFor = (metric, report) => {
  switch (metric) {
    case "fresh":
      return (report.leads || []).filter(isFresh).map((l) => ({
        id: l.id, name: l.name, email: l.email || "", phone: l.phone || "",
        status: l.status || l.clientLead?.status || "", date: l.assignmentDate || l.createdAt,
      }));
    case "followUp":
      return latestFollowUps(report.followUps).map((f) => ({
        id: f.fresh_lead_id, name: f.freshLead?.name || "", email: f.freshLead?.email || "",
        phone: f.freshLead?.phone || "", status: f.clientLeadStatus || "Follow-Up", date: f.createdAt,
      }));
    case "converted":
      return (report.converted || []).map((c) => ({
        id: c.fresh_lead_id, name: c.name, email: c.email || "", phone: c.phone || "",
        status: "Converted", date: c.convertedAt || c.last_contacted,
      }));
    case "closed":
      return (report.closed || []).map((c) => ({
        id: c.freshLeadId ?? c.fresh_lead_id, name: c.name, email: c.email || "", phone: c.phone || "",
        status: "Closed", date: c.createdAt,
      }));
    case "meetings":
      return (report.meetings || []).map((m) => ({
        id: m.id, name: m.clientName, email: m.clientEmail || "", phone: m.clientPhone || "",
        date: m.startTime, end: m.endTime,
      }));
    default:
      return [];
  }
};

// Rows -> plain objects keyed by column header (what Excel / CSV / PDF export).
export const exportRows = (metric, rows) =>
  rows.map((r) => Object.fromEntries(COLUMNS[metric].map((c) => [c.header, c.get(r) ?? ""])));

// Only statements the data supports: nothing is said when values are zero or
// when there is nobody to compare with.
export const buildInsights = (entries) => {
  const out = [];
  if (entries.length < 2) return out;
  const leaders = (valueOf) => {
    const vals = entries.map((e) => ({ name: e.name, v: valueOf(e) })).filter((x) => x.v != null);
    const max = Math.max(...vals.map((x) => x.v), 0);
    return { max, names: vals.filter((x) => x.v === max).map((x) => x.name) };
  };
  const phrase = (names) => (names.length === 1 ? names[0] : `${names.join(" and ")} (tied)`);

  [["converted", "most converted clients"], ["meetings", "most meetings"], ["followUp", "most leads in follow-up"]].forEach(([key, text]) => {
    const { max, names } = leaders((e) => e.counts[key]);
    if (max > 0) out.push(`${phrase(names)} — ${text} (${max}).`);
  });
  const rate = leaders((e) => e.rate);
  if (rate.max > 0) out.push(`${phrase(rate.names)} — highest conversion rate (${rate.max}%).`);
  const work = leaders((e) => (e.workHours > 0 ? e.workHours : null));
  if (work.max > 0) out.push(`${phrase(work.names)} — most work time logged (${work.max} h).`);
  return out;
};

export const secondsToHours = (s) => Math.round((s / 3600) * 100) / 100;

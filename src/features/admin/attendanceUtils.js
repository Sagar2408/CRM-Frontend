// Pure helpers for the attendance dashboard (kept separate so they are unit-tested).
import dayjs from "dayjs";

export const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "Executive", label: "Executive" },
  { value: "Manager", label: "Manager" },
  { value: "HR", label: "HR" },
  { value: "ProcessPerson", label: "Process Person" },
];

export const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.filter((r) => r.value).map((r) => [r.value, r.label]));

// status -> { label shown in the badge, css modifier, legend text }
export const STATUS_META = {
  Present: { label: "Present", cls: "present", legend: "Present - activity recorded" },
  Absent: { label: "Absent", cls: "absent", legend: "Absent - no activity on a working day" },
  Leave: { label: "Leave", cls: "leave", legend: "Leave - approved leave" },
  Holiday: { label: "Holiday", cls: "holiday", legend: "Holiday - company holiday" },
  WeeklyOff: { label: "Off", cls: "weekoff", legend: "Weekly off - Sunday" },
  Pending: { label: "Today", cls: "pending", legend: "Today - not marked yet" },
  Upcoming: { label: "", cls: "upcoming", legend: "" },
  NotJoined: { label: "N/A", cls: "notjoined", legend: "Not joined - before joining date" },
};

export const LEGEND_ORDER = ["Present", "Absent", "Leave", "Holiday", "WeeklyOff", "Pending", "NotJoined"];

export const monthBounds = (month /* YYYY-MM */) => {
  const m = dayjs(`${month}-01`);
  return { startDate: m.startOf("month").format("YYYY-MM-DD"), endDate: m.endOf("month").format("YYYY-MM-DD") };
};

/** Returns "YYYY-MM" when the range is exactly one calendar month, else "". */
export const rangeToMonth = (startDate, endDate) => {
  const b = monthBounds(dayjs(startDate).format("YYYY-MM"));
  return b.startDate === startDate && b.endDate === endDate ? startDate.slice(0, 7) : "";
};

export const formatDayHeader = (date) => ({
  day: dayjs(date).format("DD MMM"),
  weekday: dayjs(date).format("ddd"),
});

export const validateFilterRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "Select both From and To dates.";
  if (dayjs(startDate).isAfter(dayjs(endDate), "day")) return "From date must not be after To date.";
  if (dayjs(endDate).diff(dayjs(startDate), "day") + 1 > 366) return "Date range must not exceed 366 days.";
  return null;
};

export const validateCorrection = ({ status, reason, date, today }) => {
  if (!status) return "Choose a status.";
  if (!reason || reason.trim().length < 5) return "A reason of at least 5 characters is required.";
  if (date > today) return "Attendance cannot be corrected for a future date.";
  return null;
};

export const canCorrect = (role) => role === "Admin";
export const canProcessPayroll = (role) => role === "Admin" || role === "HR";
export const PAYROLL_TYPES = ["Executive", "Manager", "HR"];

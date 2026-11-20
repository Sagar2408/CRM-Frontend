import apiService from "./apiService";

// Manager panel API client (dashboard + Task Management). Only paths and task fields are
// sent: the manager, tenant and team scope are resolved on the server from the JWT.

export const managerError = (err, fallback = "Something went wrong") => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(" ");
  return data?.message || data?.error || err?.message || fallback;
};

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== false));

export const getManagerDashboard = async () => (await apiService.get("/manager-tasks/dashboard")).data;

export const taskApi = {
  members: async () => (await apiService.get("/manager-tasks/members")).data,
  summary: async () => (await apiService.get("/manager-tasks/summary")).data,
  list: async (params) => (await apiService.get("/manager-tasks", { params: clean(params) })).data,
  create: async (body) => (await apiService.post("/manager-tasks", body)).data.task,
  update: async (id, body) => (await apiService.put(`/manager-tasks/${id}`, body)).data.task,
  remove: async (id) => (await apiService.delete(`/manager-tasks/${id}`)).data,
};

// Executive "My Tasks": only the caller's own tasks; status/progress are the only editable fields.
export const myTaskApi = {
  summary: async () => (await apiService.get("/my-tasks/summary")).data,
  list: async (params) => (await apiService.get("/my-tasks", { params: clean(params) })).data,
  update: async (id, body) => (await apiService.put(`/my-tasks/${id}`, body)).data.task,
};

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
export const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];
export const labelOf = (list, value) => list.find((x) => x.value === value)?.label || value;

/** 3725 -> "1h 02m"; used for work / break statistics. */
export const fmtDuration = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

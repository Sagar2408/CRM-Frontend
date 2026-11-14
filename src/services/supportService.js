import axios from "axios";
import apiService from "./apiService";

// Support tickets. Company Admin calls go through the shared apiService
// (Admin JWT in localStorage "token"); Master Admin calls use their own
// axios instance with the separate masterToken. The backend derives the
// company from the verified token — no companyId is ever sent.

const masterApi = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL });
masterApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("masterToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const unwrap = async (promise, fallback) => {
  try {
    return (await promise).data;
  } catch (err) {
    const data = err.response?.data || {};
    const e = new Error(data.message || fallback);
    e.status = err.response?.status;
    e.code = data.code;
    e.retryAfterSeconds = data.retryAfterSeconds;
    e.errors = data.errors;
    throw e;
  }
};

const buildForm = (fields, file) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, v);
  });
  if (file) fd.append("attachment", file);
  return fd;
};
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

// Fetches an attachment with the auth header and saves it via a blob URL.
const saveBlob = async (api, url, filename) => {
  try {
    const res = await api.get(url, { responseType: "blob" });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "attachment";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (err) {
    throw new Error("Could not download the attachment.");
  }
};

// ---- Company side ----
// The company side of the ticket system (/support). It serves the Admin and every
// employee the Admin granted "Help & Support" (RolePermission.weekly_summary):
// they all see the SAME company-wide inbox; the server enforces the permission.
const makeCompanySupport = (base) => ({
  form: () => unwrap(apiService.get(`${base}/form`), "Failed to load support form"),
  create: (fields, file) =>
    unwrap(apiService.post(`${base}/tickets`, buildForm(fields, file), multipart), "Failed to submit query"),
  list: (page = 1, limit = 20) =>
    unwrap(apiService.get(`${base}/tickets`, { params: { page, limit } }), "Failed to load support history"),
  get: (id) => unwrap(apiService.get(`${base}/tickets/${id}`), "Failed to load ticket"),
  reply: (id, message, file) =>
    unwrap(apiService.post(`${base}/tickets/${id}/replies`, buildForm({ message }, file), multipart), "Failed to send reply"),
  download: (id, messageId, name) =>
    saveBlob(apiService, `${base}/tickets/${id}/messages/${messageId}/attachment`, name),
});
export const companySupport = makeCompanySupport("/support");

// ---- Master Admin ----
export const masterSupport = {
  summary: () => unwrap(masterApi.get("/master-support/summary"), "Failed to load summary"),
  list: (params) => unwrap(masterApi.get("/master-support/tickets", { params }), "Failed to load support queries"),
  get: (id) => unwrap(masterApi.get(`/master-support/tickets/${id}`), "Failed to load ticket"),
  reply: (id, message, status, file) =>
    unwrap(
      masterApi.post(`/master-support/tickets/${id}/replies`, buildForm({ message, status }, file), multipart),
      "Failed to send reply"
    ),
  setMeta: (id, body) => unwrap(masterApi.patch(`/master-support/tickets/${id}`, body), "Failed to update ticket"),
  addNote: (id, message) => unwrap(masterApi.post(`/master-support/tickets/${id}/notes`, { message }), "Failed to add note"),
  setStatus: (id, status) =>
    unwrap(masterApi.patch(`/master-support/tickets/${id}/status`, { status }), "Failed to update status"),
  download: (id, messageId, name) =>
    saveBlob(masterApi, `/master-support/tickets/${id}/messages/${messageId}/attachment`, name),
};

export const SUPPORT_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const SUPPORT_STATUSES = ["Open", "In Progress", "Replied", "Resolved"];
export const SUPPORT_CATEGORIES = [
  "Login",
  "Technical Issue",
  "Data/Reports",
  "Lead Management",
  "Attendance/Payroll",
  "Feature Request",
  "Other",
];

export const formatCountdown = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

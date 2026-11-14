import axios from "axios";
import apiService from "./apiService";

// Master Control Center API. Master Admin calls use their own axios instance with the
// separate masterToken (MASTER_JWT_SECRET); the company-admin announcements calls go
// through the shared apiService (Admin JWT). The company is derived server-side from
// the token - no companyId is ever sent for the announcements.
const masterApi = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL });
masterApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("masterToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (err, fallback = "Something went wrong") => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(" ");
  return data?.message || err?.message || fallback;
};

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== false));

const base = "/master-admin";
export const masterAdmin = {
  dashboard: async () => (await masterApi.get(`${base}/dashboard`)).data,
  audit: async (params) => (await masterApi.get(`${base}/audit`, { params: clean(params) })).data,

  companies: async (params) => (await masterApi.get(`${base}/companies`, { params: clean(params) })).data,
  company: async (id) => (await masterApi.get(`${base}/companies/${id}`)).data.company,
  updateCompany: async (id, body) => (await masterApi.put(`${base}/companies/${id}`, body)).data,
  updateSubscription: async (id, body) => (await masterApi.put(`${base}/companies/${id}/subscription`, body)).data,
  renew: async (id, months) => (await masterApi.post(`${base}/companies/${id}/renew`, { months })).data,
  expiryReminder: async (id) => (await masterApi.post(`${base}/companies/${id}/expiry-reminder`)).data,
  admins: async (id) => (await masterApi.get(`${base}/companies/${id}/admins`)).data,
  // Staged onboarding
  createDraft: async (body) => (await masterApi.post(`${base}/companies/draft`, body)).data,
  updateCode: async (id, code) => (await masterApi.put(`${base}/companies/${id}/code`, { code })).data,
  database: async (id) => (await masterApi.get(`${base}/companies/${id}/database`)).data.database,
  saveDatabase: async (id, body) => (await masterApi.put(`${base}/companies/${id}/database`, body)).data,
  testDatabase: async (id) => (await masterApi.post(`${base}/companies/${id}/database/test`)).data,
  invitation: async (id) => (await masterApi.get(`${base}/companies/${id}/admin-invitation`)).data,
  generateInvitation: async (id, body) => (await masterApi.post(`${base}/companies/${id}/admin-invitation`, body)).data,
  revokeInvitation: async (id) => (await masterApi.post(`${base}/companies/${id}/admin-invitation/revoke`)).data,
  activate: async (id) => (await masterApi.post(`${base}/companies/${id}/activate`)).data,
  activity: async (id) => (await masterApi.get(`${base}/companies/${id}/activity`)).data.activity,
  features: async (id) => (await masterApi.get(`${base}/companies/${id}/features`)).data.modules,
  updateFeatures: async (id, features) => (await masterApi.put(`${base}/companies/${id}/features`, { features })).data.modules,

  promotions: async (params) => (await masterApi.get(`${base}/promotions`, { params: clean(params) })).data,
  promotion: async (id) => (await masterApi.get(`${base}/promotions/${id}`)).data,
  createPromotion: async (body) => (await masterApi.post(`${base}/promotions`, body)).data,
  updatePromotion: async (id, body) => (await masterApi.put(`${base}/promotions/${id}`, body)).data,
  cancelPromotion: async (id) => (await masterApi.post(`${base}/promotions/${id}/cancel`)).data,
};

// Company Admin side (announcements in the notification centre).
export const announcements = {
  list: async () => (await apiService.get("/promotions")).data,
  get: async (id) => (await apiService.get(`/promotions/${id}`)).data.promotion,
  markRead: async (id) => (await apiService.post(`/promotions/${id}/read`)).data,
};

export const SUBSCRIPTION_LABELS = {
  active: "Active",
  expiring_soon: "Expiring soon",
  trial: "Trial",
  expired: "Expired",
  suspended: "Suspended",
  not_configured: "Not configured",
};
export const STAGE_LABELS = {
  draft: "Draft",
  database_pending: "Database pending",
  database_connected: "Database connected",
  admin_invitation_pending: "Admin invitation pending",
  admin_registered: "Admin registered",
  active: "Active",
  suspended: "Suspended",
};
export const BILLING_CYCLES = [["", "Not set"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["half_yearly", "Half-yearly"], ["yearly", "Yearly"], ["one_time", "One-time"]];
export const PROMOTION_CATEGORIES = ["Promotion", "Offer", "Announcement", "Product Update", "Maintenance"];
export const PROMOTION_STATUSES = ["Draft", "Scheduled", "Published", "Expired", "Cancelled"];

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export const toInputDateTime = (d) => {
  if (!d) return "";
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};

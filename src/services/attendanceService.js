import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

// Normalises axios errors to { message, status, code, data } so the UI can
// show the server's meaningful message.
const fail = (error) => {
  const data = error.response?.data || {};
  throw Object.assign(new Error(data.message || data.error || error.message || "Request failed"), {
    status: error.response?.status,
    code: data.code,
    data,
  });
};

export const fetchAttendanceReport = async ({ startDate, endDate, roles, search }) => {
  try {
    const params = { startDate, endDate };
    if (roles && roles.length) params.roles = roles.join(",");
    if (search) params.search = search;
    const res = await client.get("/attendance/report", { params });
    return res.data;
  } catch (e) {
    return fail(e);
  }
};

export const correctAttendance = async (payload) => {
  try {
    return (await client.post("/attendance/correct", payload)).data;
  } catch (e) {
    return fail(e);
  }
};

export const fetchAttendanceAudit = async (params) => {
  try {
    return (await client.get("/attendance/audit", { params })).data;
  } catch (e) {
    return fail(e);
  }
};

export const fetchHolidays = async (params) => {
  try {
    return (await client.get("/attendance/holidays", { params })).data;
  } catch (e) {
    return fail(e);
  }
};

export const addHoliday = async (payload) => {
  try {
    return (await client.post("/attendance/holidays", payload)).data;
  } catch (e) {
    return fail(e);
  }
};

export const deleteHoliday = async (id) => {
  try {
    return (await client.delete(`/attendance/holidays/${id}`)).data;
  } catch (e) {
    return fail(e);
  }
};

// Existing payroll endpoints (unchanged routes). The Process Payroll button
// calls these; `reprocess: true` is sent only after the admin confirms
// overwriting an already-processed month.
const PAYROLL_PATH = {
  Executive: "/payroll/executive",
  TL: "/payroll/TL",
  Manager: "/payroll/manager",
  HR: "/payroll/hr",
};

export const processPayroll = async (employeeType, payload) => {
  const path = PAYROLL_PATH[employeeType];
  if (!path) throw new Error(`Payroll is not available for ${employeeType}`);
  try {
    return (await client.post(path, payload)).data;
  } catch (e) {
    return fail(e);
  }
};

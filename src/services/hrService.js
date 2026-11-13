import apiService from "./apiService";

// HR workspace API client. Only paths are sent: the tenant (company) is taken
// from the JWT on the server; no companyId is ever supplied by the client.

export const hrError = (err, fallback = "Something went wrong") => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(" ");
  return data?.message || data?.error || err?.message || fallback;
};

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined));

// ---- dashboard
export const getHrDashboard = async () => (await apiService.get("/hr-management/dashboard")).data;

// ---- leave
export const leaveApi = {
  types: async () => (await apiService.get("/leave/types")).data.types,
  createType: async (body) => (await apiService.post("/leave/types", body)).data,
  updateType: async (id, body) => (await apiService.put(`/leave/types/${id}`, body)).data,
  requests: async (params) => (await apiService.get("/leave/requests", { params: clean(params) })).data,
  request: async (id) => (await apiService.get(`/leave/requests/${id}`)).data,
  decide: async (id, status, hrComment) => (await apiService.patch(`/leave/requests/${id}/decision`, { status, hrComment })).data,
  cancel: async (id, reason) => (await apiService.post(`/leave/requests/${id}/cancel`, { reason })).data,
  balanceOverview: async (params) => (await apiService.get("/leave/balances/overview", { params: clean(params) })).data,
  allocate: async (body) => (await apiService.post("/leave/balances/allocate", body)).data,
  adjust: async (body) => (await apiService.post("/leave/balances/adjust", body)).data,
  history: async (params) => (await apiService.get("/leave/balances/history", { params: clean(params) })).data,
  // self service
  apply: async (body) => (await apiService.post("/leave/apply", body)).data,
  mine: async () => (await apiService.get("/leave/my")).data.leaves,
  myBalances: async (year) => (await apiService.get("/leave/balances/me", { params: clean({ year }) })).data,
};

// ---- payroll
export const payrollApi = {
  overview: async (params) => (await apiService.get("/payroll/overview", { params: clean(params) })).data,
  saveSalary: async (body) => (await apiService.post("/payroll/salary", body)).data,
  salaryHistory: async (employeeType, employeeId) => (await apiService.get("/payroll/salary/history", { params: { employeeType, employeeId } })).data,
  process: async (body) => (await apiService.post("/payroll/process", body)).data,
  // Authenticated download (the token is a header, so a plain link can't be used).
  exportCsv: async (params) => {
    const res = await apiService.get("/payroll/export", { params: clean(params), responseType: "blob" });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = `payroll-${params.month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

// ---- own profile (HR settings)
export const hrProfileApi = {
  get: async () => (await apiService.get("/hr/profile")).data.hr,
  update: async (id, body) => (await apiService.put(`/hr/${id}`, body)).data,
  changePassword: async (currentPassword, newPassword) => (await apiService.post("/hr/change-password", { currentPassword, newPassword })).data,
  getPhoto: async () => (await apiService.get("/hr-management/me/photo", { responseType: "blob" })).data,
  uploadPhoto: async (file) => {
    const fd = new FormData();
    fd.append("photo", file);
    return (await apiService.post("/hr-management/me/photo", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  deletePhoto: async () => (await apiService.delete("/hr-management/me/photo")).data,
};

export const EMPLOYEE_TYPES = [
  { value: "Executive", label: "Executive" },
  { value: "Manager", label: "Manager" },
  { value: "HR", label: "HR" },
  { value: "ProcessPerson", label: "Process Person" },
];
export const PAYROLL_TYPES = EMPLOYEE_TYPES.filter((t) => t.value !== "ProcessPerson");
export const typeLabel = (v) => EMPLOYEE_TYPES.find((t) => t.value === v)?.label || v;

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

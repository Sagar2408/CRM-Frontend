import apiService from "./apiService";

// Team Management client (backend: /api/team-management, Admin only).
const base = "/team-management";
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined));

export const teamApi = {
  employees: async () => (await apiService.get(`${base}/employees`)).data,
  overview: async (range) => (await apiService.get(`${base}/overview`, { params: clean(range) })).data,
  detail: async (id, range) => (await apiService.get(`${base}/teams/${id}`, { params: clean(range) })).data,
  compare: async (teamIds, range) => (await apiService.get(`${base}/compare`, { params: { teamIds: teamIds.join(","), ...clean(range) } })).data,
  create: async (body) => (await apiService.post(`${base}/teams`, body)).data,
  update: async (id, body) => (await apiService.put(`${base}/teams/${id}`, body)).data,
  addMembers: async (id, memberKeys) => (await apiService.post(`${base}/teams/${id}/members`, { memberKeys })).data,
  removeMember: async (id, memberKey) => (await apiService.delete(`${base}/teams/${id}/members/${encodeURIComponent(memberKey)}`)).data,
  archive: async (id) => (await apiService.post(`${base}/teams/${id}/archive`)).data,
  restore: async (id) => (await apiService.post(`${base}/teams/${id}/restore`)).data,
};

export const teamErrorMessage = (err, fallback = "Something went wrong.") => err?.response?.data?.message || err?.message || fallback;

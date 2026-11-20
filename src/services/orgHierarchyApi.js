import apiService from "./apiService";

// Organization Hierarchy reporting assignment (backend: /api/organization, Admin only).
// Only paths and employee keys are sent; the company comes from the Admin's token.
export const orgApi = {
  assignable: async () => (await apiService.get("/organization/assignable")).data,
  assign: async (managerId, memberKeys, opts = {}) =>
    (await apiService.put(`/organization/managers/${managerId}/members`, { memberKeys, ...(opts.reassign ? { reassign: true } : {}) })).data,
  remove: async (managerId, memberKey) =>
    (await apiService.delete(`/organization/managers/${managerId}/members/${encodeURIComponent(memberKey)}`)).data,
};

export const orgErrorMessage = (err, fallback = "Something went wrong.") => err?.response?.data?.message || err?.message || fallback;

// Hierarchy node keys are "Executive:5" / "Manager:2" / "ProcessPerson:3"; the API uses user:5 / manager:2 / processperson:3.
const KIND = { Executive: "user", Manager: "manager", ProcessPerson: "processperson" };
export const ASSIGNABLE_ROLES = Object.keys(KIND);
export const apiKeyOf = (node) => (KIND[node.role] ? `${KIND[node.role]}:${node.id}` : null);

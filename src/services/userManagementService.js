import apiService from "./apiService";

// Admin User Management API (backend: routes/UserManagement.routes.js).
// `kind` is the identity table: user | manager | hr | processperson.
// Creation is NOT here: it reuses the existing per-role create endpoints
// through ApiContext (createExecutive, createTeamLead, ...).

export const apiError = (err, fallback = "Something went wrong") => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(" ");
  return data?.message || err?.message || fallback;
};

const base = "/user-management/users";

export const listUsers = async (params) => (await apiService.get(base, { params })).data;
export const getUser = async (kind, id) => (await apiService.get(`${base}/${kind}/${id}`)).data.user;
export const updateUser = async (kind, id, body) => (await apiService.put(`${base}/${kind}/${id}`, body)).data;
export const setUserActive = async (kind, id, active) =>
  (await apiService.patch(`${base}/${kind}/${id}/status`, { active })).data;

// Photos are private: fetched with the auth header as a blob, never via a public URL.
export const getUserPhoto = async (kind, id) =>
  (await apiService.get(`${base}/${kind}/${id}/photo`, { responseType: "blob" })).data;
export const uploadUserPhoto = async (kind, id, file) => {
  const fd = new FormData();
  fd.append("photo", file);
  return (await apiService.post(`${base}/${kind}/${id}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
};
export const deleteUserPhoto = async (kind, id) => (await apiService.delete(`${base}/${kind}/${id}/photo`)).data;

export const ROLE_OPTIONS = [
  { value: "Executive", label: "Executive" },
  { value: "TL", label: "Team Lead" },
  { value: "Manager", label: "Manager" },
  { value: "HR", label: "HR" },
  { value: "ProcessPerson", label: "Process Person" },
  { value: "Admin", label: "Admin" },
];

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const validatePhoto = (file) => {
  if (!file) return "";
  if (!PHOTO_TYPES.includes(file.type)) return "Photo must be a JPEG, PNG or WEBP image.";
  if (file.size > PHOTO_MAX_BYTES) return "Photo must be 2MB or smaller.";
  return "";
};

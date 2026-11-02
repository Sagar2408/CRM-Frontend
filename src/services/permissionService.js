// src/services/permissionService.js
import axios from "axios";

// Backend mounts this router at /api/role-permissions (see server.js
// app.use("/api/role-permissions", ..., require("./routes/RolePermission.routes"))),
// not directly at /api — every call below was 404ing without this segment.
const BASE_URL = `${process.env.REACT_APP_API_BASE_URL}/role-permissions`;
const getToken = () => localStorage.getItem("token");
const getHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

export const permissionService = {
  async fetchUsers() {
    const res = await axios.get(`${BASE_URL}/get-managers-users`, { headers: getHeaders() });
    return res.data;
  },

  async createPermission(payload) {
    const res = await axios.post(`${BASE_URL}/create`, payload, { headers: getHeaders() });
    return res.data;
  },

  async fetchAllRolePermissions() {
    const res = await axios.get(`${BASE_URL}/get-permissions`, { headers: getHeaders() });
    return res.data;
  },

  async fetchSinglePermission(id) {
    const res = await axios.get(`${BASE_URL}/permission/${id}`, { headers: getHeaders() });
    return res.data;
  },

  async togglePermission(permissionId, permissionKey) {
    const res = await axios.patch(`${BASE_URL}/${permissionId}/toggle`, { permissionKey }, {
      headers: getHeaders(),
    });
    return res.data;
  },

  async fetchPermissionsForUser(userId, role) {
    const res = await axios.get(`${BASE_URL}/${role}/${userId}`, { headers: getHeaders() });
    return res.data;
  },
};

import axios from "axios";
import { permissionService } from "./permissionService";

// Regression guard: the backend mounts this router at
// /api/role-permissions (see server.js:
// app.use("/api/role-permissions", ..., require("./routes/RolePermission.routes")))
// but permissionService previously built every URL directly off
// REACT_APP_API_BASE_URL, skipping the "/role-permissions" segment.
// That made every call here 404 — breaking the admin Page Access
// Controller AND fetchPermissionsForUser, which PermissionContext calls
// on mount for every non-admin user (TL/HR/Manager/Executive), so
// RequirePermission-gated pages showed "Unauthorized" for everyone but
// Admin (who bypasses the check entirely).
jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe("permissionService URLs", () => {
  // CRA's built-in jest config sets resetMocks: true, which clears mock
  // implementations (not just call history) before every test — so the
  // resolved values must be (re-)applied here, not in the jest.mock
  // factory above, or every axios call below resolves to undefined.
  beforeEach(() => {
    localStorage.setItem("token", "test-token");
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: {} });
    axios.patch.mockResolvedValue({ data: {} });
  });

  it("fetchUsers hits /role-permissions/get-managers-users", async () => {
    await permissionService.fetchUsers();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/get-managers-users$/),
      expect.anything()
    );
  });

  it("createPermission hits /role-permissions/create", async () => {
    await permissionService.createPermission({ role: "TL", user_id: 1 });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/create$/),
      expect.anything(),
      expect.anything()
    );
  });

  it("fetchAllRolePermissions hits /role-permissions/get-permissions", async () => {
    await permissionService.fetchAllRolePermissions();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/get-permissions$/),
      expect.anything()
    );
  });

  it("fetchSinglePermission hits /role-permissions/permission/:id", async () => {
    await permissionService.fetchSinglePermission("abc-123");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/permission\/abc-123$/),
      expect.anything()
    );
  });

  it("togglePermission hits /role-permissions/:id/toggle", async () => {
    await permissionService.togglePermission("abc-123", "page_access");
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/abc-123\/toggle$/),
      { permissionKey: "page_access" },
      expect.anything()
    );
  });

  it("fetchPermissionsForUser hits /role-permissions/:role/:id", async () => {
    await permissionService.fetchPermissionsForUser(7, "Executive");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/role-permissions\/Executive\/7$/),
      expect.anything()
    );
  });
});

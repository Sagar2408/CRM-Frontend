import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PermissionProvider } from "./PermissionContext";
import RequirePermission from "../features/admin-settings/RequirePermission";
import { permissionService } from "../services/permissionService";

// Regression tests: an Executive (or TL/Manager/HR) with no
// RolePermission row yet — nobody has configured Page Access Control
// for them — gets a 404 from GET /role-permissions/:role/:id. That's a
// normal, expected state (no custom permissions configured), not a
// failed request. PermissionContext used to turn ANY thrown error into
// a generic `error` state, which RequirePermission rendered as raw
// "Error loading permissions: Request failed with status code 404"
// text instead of its own already-written UnauthorizedAccess fallback
// for "no permissions data".

jest.mock("../services/permissionService", () => ({
  permissionService: {
    fetchPermissionsForUser: jest.fn(),
  },
}));

const renderGated = () =>
  render(
    <PermissionProvider>
      <RequirePermission requiredKey="push_notifications">
        <div>Notification Panel</div>
      </RequirePermission>
    </PermissionProvider>
  );

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: 42, role: "Executive" }));
  permissionService.fetchPermissionsForUser.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe("PermissionContext — a 404 (no permission row yet) is not a request error", () => {
  it("shows the existing Access Denied fallback, not a raw request-failed error, on 404", async () => {
    permissionService.fetchPermissionsForUser.mockRejectedValue({
      response: { status: 404 },
      message: "Request failed with status code 404",
    });

    renderGated();

    await waitFor(() => expect(screen.getByText("Access Denied")).toBeInTheDocument());

    expect(screen.queryByText(/Error loading permissions/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Notification Panel")).not.toBeInTheDocument();
  });

  it("still surfaces a real failure (non-404, e.g. network/server error) as an error, unchanged", async () => {
    permissionService.fetchPermissionsForUser.mockRejectedValue({
      message: "Network Error",
    });

    renderGated();

    await waitFor(() =>
      expect(screen.getByText("Error loading permissions: Network Error")).toBeInTheDocument()
    );
  });

  it("renders the gated page once permissions are fetched and the key is granted", async () => {
    permissionService.fetchPermissionsForUser.mockResolvedValue({ push_notifications: true });

    renderGated();

    await waitFor(() => expect(screen.getByText("Notification Panel")).toBeInTheDocument());
  });

  it("denies access cleanly (no error text) when permissions are fetched but the key is not granted", async () => {
    permissionService.fetchPermissionsForUser.mockResolvedValue({ push_notifications: false });

    renderGated();

    await waitFor(() => expect(screen.getByText("Access Denied")).toBeInTheDocument());
    expect(screen.queryByText(/Error loading permissions/i)).not.toBeInTheDocument();
  });
});

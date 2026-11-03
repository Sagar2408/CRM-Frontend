import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PermissionProvider } from "../../context/PermissionContext";
import PageAccessControl from "./PageAccessControl";
import { permissionService } from "../../services/permissionService";

// Verifies the redesigned PageAccessControl (see
// PageAccessControl.test.js for its own fetch/select/toggle/save
// behavior, with RequirePermission mocked away there to isolate it)
// still keeps its real page_access gate — a non-Admin caller who
// hasn't been granted page_access must never see the User Access
// Management UI, exactly as before the redesign. Uses the real
// RequirePermission + PermissionProvider; only permissionService (and
// so axios) is mocked, same constraint as permissionService.test.js.
jest.mock("../../services/permissionService", () => ({
  permissionService: { fetchPermissionsForUser: jest.fn() },
}));

describe("PageAccessControl — unauthorized access is still blocked", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: 5, role: "TL" }));
    permissionService.fetchPermissionsForUser.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders Access Denied instead of the User Access Management screen for a TL without page_access", async () => {
    permissionService.fetchPermissionsForUser.mockResolvedValue({ id: "perm-1", page_access: false });

    render(
      <PermissionProvider>
        <PageAccessControl />
      </PermissionProvider>
    );

    await waitFor(() => expect(screen.getByText("Access Denied")).toBeInTheDocument());
    expect(screen.queryByText("User Access Management")).not.toBeInTheDocument();
  });

  it("renders Access Denied for a TL with no RolePermission row at all (404), not the management screen", async () => {
    permissionService.fetchPermissionsForUser.mockRejectedValue({ response: { status: 404 } });

    render(
      <PermissionProvider>
        <PageAccessControl />
      </PermissionProvider>
    );

    await waitFor(() => expect(screen.getByText("Access Denied")).toBeInTheDocument());
    expect(screen.queryByText("User Access Management")).not.toBeInTheDocument();
  });
});

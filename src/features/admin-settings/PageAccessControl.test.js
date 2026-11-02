import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageAccessControl from "./PageAccessControl";
import { usePermissionContext } from "../../context/PermissionContext";

// Admin always bypasses RequirePermission's own gate (see
// RequirePermission.js: `if (role === "admin") return <>{children}</>`),
// which is who this page is for, so it's stubbed out here to isolate
// PageAccessControl's own fetch/loading/error/toggle logic.
jest.mock("./RequirePermission", () => ({ children }) => <>{children}</>);
// An auto-mock (no factory) would still load the real module to
// introspect its shape, pulling in permissionService.js -> axios, whose
// ESM build this project's CRA/jest transform can't parse from
// node_modules (see permissionService.test.js for the same constraint).
// An explicit factory avoids loading the real file entirely.
jest.mock("../../context/PermissionContext", () => ({
  usePermissionContext: jest.fn(),
}));

const USERS = [
  { id: 1, label: "id - 1 - Executive - Jane Doe" },
  { id: 2, label: "id - 2 - TL - John Smith" },
];

const PERMISSIONS = [
  { id: "perm-1", label: "Role: Executive | Jane Doe (ID: 1)", role: "Executive" },
];

function mockContext(overrides = {}) {
  usePermissionContext.mockReturnValue({
    fetchUsers: jest.fn().mockResolvedValue(USERS),
    createPermission: jest.fn().mockResolvedValue({}),
    fetchAllRolePermissions: jest.fn().mockResolvedValue(PERMISSIONS),
    fetchSinglePermission: jest.fn().mockResolvedValue({
      permission: { id: "perm-1", role: "Executive", dashboard: true, page_access: false },
    }),
    togglePermission: jest.fn().mockResolvedValue({}),
    ...overrides,
  });
}

describe("PageAccessControl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading placeholders, then populates the user and permission dropdowns", async () => {
    mockContext();

    render(<PageAccessControl />);

    expect(screen.getByText("Loading users...")).toBeInTheDocument();
    expect(screen.getByText("Loading permissions...")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("Select User")).toBeInTheDocument()
    );
    expect(screen.getByText("Select Permissions for users")).toBeInTheDocument();
    expect(screen.getAllByText(/Jane Doe/).length).toBeGreaterThan(0);
  });

  it("shows an empty-state message when no users or permissions exist", async () => {
    mockContext({
      fetchUsers: jest.fn().mockResolvedValue([]),
      fetchAllRolePermissions: jest.fn().mockResolvedValue([]),
    });

    render(<PageAccessControl />);

    await waitFor(() =>
      expect(screen.getByText("No users available")).toBeInTheDocument()
    );
    expect(screen.getByText("No permissions found")).toBeInTheDocument();
  });

  it("shows an error message when fetching users fails, without crashing", async () => {
    mockContext({ fetchUsers: jest.fn().mockRejectedValue(new Error("network error")) });

    render(<PageAccessControl />);

    await waitFor(() =>
      expect(
        screen.getByText("Failed to load users. Please refresh and try again.")
      ).toBeInTheDocument()
    );
  });

  it("loads existing permission details on selection and toggles a permission", async () => {
    const togglePermission = jest.fn().mockResolvedValue({});
    mockContext({ togglePermission });

    render(<PageAccessControl />);

    await waitFor(() =>
      expect(screen.getByText("Select Permissions for users")).toBeInTheDocument()
    );

    const permissionSelect = screen.getByText("Select Permissions for users").closest("select");
    await act(async () => {
      await userEvent.selectOptions(permissionSelect, "perm-1");
    });

    // Fetched detail (dashboard: true) should render the toggle as On.
    const dashboardRow = screen.getByText("Dashboard").closest(".table-row");
    expect(dashboardRow).toHaveTextContent("On");

    const dashboardToggleInput = dashboardRow.querySelector("input[type='checkbox']");
    await act(async () => {
      await userEvent.click(dashboardToggleInput);
    });

    expect(togglePermission).toHaveBeenCalledWith("perm-1", "dashboard");
  });

  it("shows an error message when a toggle fails, scoped to the access table", async () => {
    const togglePermission = jest.fn().mockRejectedValue(new Error("boom"));
    mockContext({ togglePermission });

    render(<PageAccessControl />);

    await waitFor(() =>
      expect(screen.getByText("Select Permissions for users")).toBeInTheDocument()
    );

    const permissionSelect = screen.getByText("Select Permissions for users").closest("select");
    await act(async () => {
      await userEvent.selectOptions(permissionSelect, "perm-1");
    });

    const dashboardRow = screen.getByText("Dashboard").closest(".table-row");
    const dashboardToggleInput = dashboardRow.querySelector("input[type='checkbox']");
    await act(async () => {
      await userEvent.click(dashboardToggleInput);
    });

    expect(
      await screen.findByText('Failed to update "Dashboard". Please try again.')
    ).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageAccessControl from "./PageAccessControl";
import { usePermissionContext } from "../../context/PermissionContext";

// Admin always bypasses RequirePermission's own gate (see
// RequirePermission.js: `if (role === "admin") return <>{children}</>`),
// which is who this page is for, so it's stubbed out here to isolate
// PageAccessControl's own fetch/select/toggle/save logic. The
// "unauthorized access" case (a non-Admin without page_access) is
// covered separately in PageAccessControl.accessControl.test.js, which
// needs the REAL RequirePermission/PermissionContext — jest.mock calls
// are hoisted file-wide, so that can't share this file.
jest.mock("./RequirePermission", () => ({ children }) => <>{children}</>);
// An auto-mock (no factory) would still load the real module to
// introspect its shape, pulling in permissionService.js -> axios, whose
// ESM build this project's CRA/jest transform can't parse from
// node_modules (see permissionService.test.js for the same constraint).
jest.mock("../../context/PermissionContext", () => ({
  usePermissionContext: jest.fn(),
}));

// Shapes exactly as RolePermission.controller.js's
// getAllUsersHrsAndManagers (no record yet) and getAllRolePermissions
// (has a record) actually return: role/entityId/name/username as their
// own fields (name from Users.firstname+lastname or Manager/Hr.name;
// username separate), plus the legacy `label` string kept for
// back-compat but no longer read by this component.
const USERS_WITHOUT_RECORD = [
  { id: 1, role: "Executive", entityId: 1, name: "Sagar", username: "sagar", label: "id - 1 - Executive - sagar" },
  { id: 2, role: "TL", entityId: 2, name: "Ricky", username: "ricky", label: "id - 2 - TL - ricky" },
];

const USERS_WITH_RECORD = [
  {
    id: "perm-9",
    role: "Manager",
    entityId: 9,
    name: "Alice Brown",
    username: "alice.b",
    label: "Role: Manager | Alice Brown (ID: 9)",
  },
];

function mockContext(overrides = {}) {
  usePermissionContext.mockReturnValue({
    fetchUsers: jest.fn().mockResolvedValue(USERS_WITHOUT_RECORD),
    fetchAllRolePermissions: jest.fn().mockResolvedValue(USERS_WITH_RECORD),
    fetchPermissionsForUser: jest.fn().mockRejectedValue({ response: { status: 404 } }),
    createPermission: jest.fn().mockResolvedValue({ record: { id: "new-perm-id" } }),
    togglePermission: jest.fn().mockResolvedValue({}),
    ...overrides,
  });
}

describe("PageAccessControl — User Access Management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("populates the live results list with both name and username, for users with and without a record", async () => {
    mockContext();
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Sagar — sagar")).toBeInTheDocument());
    expect(screen.getByText("Ricky — ricky")).toBeInTheDocument();
    expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument();
    expect(screen.getByText(/Executive, ID: 1 — not configured/)).toBeInTheDocument();
    expect(screen.getByText(/Manager, ID: 9/)).not.toHaveTextContent("not configured");
  });

  it("filters the results list dynamically as the Admin types, matching name, username, role or ID", async () => {
    mockContext();
    render(<PageAccessControl />);
    await waitFor(() => expect(screen.getByText("Sagar — sagar")).toBeInTheDocument());

    const search = screen.getByPlaceholderText("Search by name, username, role or ID...");

    await act(async () => {
      await userEvent.type(search, "ricky");
    });
    expect(screen.queryByText("Sagar — sagar")).not.toBeInTheDocument();
    expect(screen.getByText("Ricky — ricky")).toBeInTheDocument();

    await act(async () => {
      await userEvent.clear(search);
      await userEvent.type(search, "alice.b");
    });
    expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument();
    expect(screen.queryByText("Ricky — ricky")).not.toBeInTheDocument();

    await act(async () => {
      await userEvent.clear(search);
      await userEvent.type(search, "manager");
    });
    expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument();
    expect(screen.queryByText("Sagar — sagar")).not.toBeInTheDocument();

    await act(async () => {
      await userEvent.clear(search);
      await userEvent.type(search, "2");
    });
    expect(screen.getByText("Ricky — ricky")).toBeInTheDocument();
    expect(screen.queryByText("Sagar — sagar")).not.toBeInTheDocument();

    await act(async () => {
      await userEvent.clear(search);
      await userEvent.type(search, "nobody-matches-this");
    });
    expect(screen.getByText(/No users match/)).toBeInTheDocument();
  });

  it("selecting a user with no existing record shows the empty state with all toggles off", async () => {
    const fetchPermissionsForUser = jest.fn().mockRejectedValue({ response: { status: 404 } });
    mockContext({ fetchPermissionsForUser });
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Sagar — sagar")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Sagar — sagar"));
    });

    expect(fetchPermissionsForUser).toHaveBeenCalledWith("1", "Executive");
    await waitFor(() => expect(screen.getByText(/No permissions configured yet for Sagar/)).toBeInTheDocument());
    const dashboardRow = screen.getByText("Dashboard").closest(".pac-permission-row");
    expect(dashboardRow).toHaveClass("pac-disabled");
  });

  it("selecting a user with an existing record shows their real permission values, not the empty state", async () => {
    const fetchPermissionsForUser = jest.fn().mockResolvedValue({
      id: "perm-9",
      role: "Manager",
      dashboard: true,
      invoice: false,
    });
    mockContext({ fetchPermissionsForUser });
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Alice Brown — alice.b"));
    });

    await waitFor(() => {
      const dashboardRow = screen.getByText("Dashboard").closest(".pac-permission-row");
      expect(dashboardRow).toHaveClass("pac-enabled");
    });
    expect(screen.queryByText(/No permissions configured yet/)).not.toBeInTheDocument();
  });

  it("creates a new record then toggles changed keys when saving for a user with no prior record", async () => {
    const fetchPermissionsForUser = jest.fn().mockRejectedValue({ response: { status: 404 } });
    const createPermission = jest.fn().mockResolvedValue({ record: { id: "new-perm-id" } });
    const togglePermission = jest.fn().mockResolvedValue({});
    mockContext({ fetchPermissionsForUser, createPermission, togglePermission });
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Sagar — sagar")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Sagar — sagar"));
    });
    await waitFor(() => expect(screen.getByText(/No permissions configured yet/)).toBeInTheDocument());

    const dashboardToggle = screen.getByText("Dashboard").closest(".pac-permission-row").querySelector("input");
    await act(async () => {
      await userEvent.click(dashboardToggle);
    });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(screen.getByText("Save Changes"));
    });

    expect(createPermission).toHaveBeenCalledWith({
      role: "Executive",
      manager_id: null,
      hr_id: null,
      user_id: 1,
    });
    expect(togglePermission).toHaveBeenCalledWith("new-perm-id", "dashboard");
    expect(togglePermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Permissions saved successfully.")).toBeInTheDocument();
  });

  it("only toggles changed keys (not createPermission) when saving for a user who already has a record", async () => {
    const fetchPermissionsForUser = jest.fn().mockResolvedValue({
      id: "perm-9",
      role: "Manager",
      dashboard: true,
      invoice: false,
    });
    const createPermission = jest.fn();
    const togglePermission = jest.fn().mockResolvedValue({});
    mockContext({ fetchPermissionsForUser, createPermission, togglePermission });
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Alice Brown — alice.b"));
    });
    await waitFor(() => screen.getByText("Alice Brown"));

    const invoiceToggle = screen.getByText("Invoice").closest(".pac-permission-row").querySelector("input");
    await act(async () => {
      await userEvent.click(invoiceToggle);
    });
    await act(async () => {
      await userEvent.click(screen.getByText("Save Changes"));
    });

    expect(createPermission).not.toHaveBeenCalled();
    expect(togglePermission).toHaveBeenCalledWith("perm-9", "invoice");
    expect(togglePermission).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before switching users with unsaved changes, and switches on confirm", async () => {
    const fetchPermissionsForUser = jest
      .fn()
      .mockResolvedValueOnce({ id: "perm-9", role: "Manager", dashboard: false })
      .mockRejectedValueOnce({ response: { status: 404 } });
    mockContext({ fetchPermissionsForUser });
    window.confirm = jest.fn().mockReturnValue(true);
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Alice Brown — alice.b"));
    });
    await waitFor(() => screen.getByText("Alice Brown"));

    const dashboardToggle = screen.getByText("Dashboard").closest(".pac-permission-row").querySelector("input");
    await act(async () => {
      await userEvent.click(dashboardToggle);
    });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(screen.getByText("Sagar — sagar"));
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Alice Brown"));
    await waitFor(() => expect(screen.getByText(/No permissions configured yet for Sagar/)).toBeInTheDocument());
  });

  it("does not switch users when the unsaved-changes confirmation is declined", async () => {
    const fetchPermissionsForUser = jest
      .fn()
      .mockResolvedValue({ id: "perm-9", role: "Manager", dashboard: false });
    mockContext({ fetchPermissionsForUser });
    window.confirm = jest.fn().mockReturnValue(false);
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Alice Brown — alice.b")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Alice Brown — alice.b"));
    });
    await waitFor(() => screen.getByText("Alice Brown"));

    const dashboardToggle = screen.getByText("Dashboard").closest(".pac-permission-row").querySelector("input");
    await act(async () => {
      await userEvent.click(dashboardToggle);
    });

    await act(async () => {
      await userEvent.click(screen.getByText("Sagar — sagar"));
    });

    expect(window.confirm).toHaveBeenCalled();
    // Still on Alice Brown's permission panel — the switch was discarded.
    expect(screen.getByText("Dashboard").closest(".pac-permission-row")).toHaveClass("pac-enabled");
  });

  it("Enable All / Disable All only affects the currently filtered/visible permissions", async () => {
    const fetchPermissionsForUser = jest.fn().mockRejectedValue({ response: { status: 404 } });
    mockContext({ fetchPermissionsForUser });
    render(<PageAccessControl />);

    await waitFor(() => expect(screen.getByText("Sagar — sagar")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText("Sagar — sagar"));
    });
    await waitFor(() => expect(screen.getByText(/No permissions configured yet/)).toBeInTheDocument());

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText("Search permissions..."), "notification");
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(screen.getByText(/Enable All/));
    });

    const pushRow = screen.getByText("Push Notifications").closest(".pac-permission-row");
    expect(pushRow).toHaveClass("pac-enabled");

    await act(async () => {
      await userEvent.clear(screen.getByPlaceholderText("Search permissions..."));
    });
    // Dashboard was never touched by the filtered Enable All.
    const dashboardRow = screen.getByText("Dashboard").closest(".pac-permission-row");
    expect(dashboardRow).toHaveClass("pac-disabled");
  });

  it("shows an error message when fetching users fails, without crashing", async () => {
    mockContext({ fetchUsers: jest.fn().mockRejectedValue(new Error("network error")) });
    render(<PageAccessControl />);

    await waitFor(() =>
      expect(screen.getByText("Failed to load users. Please refresh and try again.")).toBeInTheDocument()
    );
  });
});

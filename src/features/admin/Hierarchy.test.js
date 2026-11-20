import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("./SidebarToggle", () => () => null);
jest.mock("../../services/orgHierarchyApi", () => ({
  orgApi: { assignable: jest.fn(), assign: jest.fn(), remove: jest.fn() },
  orgErrorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
  ASSIGNABLE_ROLES: ["Executive", "Manager", "ProcessPerson"],
  apiKeyOf: (n) => ({ Executive: "user", Manager: "manager", ProcessPerson: "processperson" }[n.role] ? `${{ Executive: "user", Manager: "manager", ProcessPerson: "processperson" }[n.role]}:${n.id}` : null),
}));
jest.mock("./ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});

import Hierarchy, { flatten } from "./Hierarchy";

const n = (role, id, name, level, children = [], extra = {}) => ({
  key: `${role}:${id}`, id, name, username: name.toLowerCase(), role, level, team: null,
  reportsTo: null, unassignedReason: null, children, totalReports: 0, ...extra,
});

const tree = () => {
  // Team Lead no longer exists: executives report straight to their team's Manager.
  const ex1 = n("Executive", 11, "Ex-One", 3, [], { team: "Alpha" });
  const mgr = n("Manager", 1, "Mia", 2, [ex1], { totalReports: 1 });
  ex1.reportsTo = { key: mgr.key, name: "Mia", role: "Manager" };
  const hr = n("HR", 1, "Hana", 2);
  const pp = n("ProcessPerson", 1, "Pat", 2);
  const admin = n("Admin", 1, "Boss", 1, [mgr, hr, pp], { totalReports: 5 });
  mgr.reportsTo = { key: admin.key, name: "Boss", role: "Admin" };
  const loner = n("Executive", 90, "Loner", null, [], { unassignedReason: "No team assigned" });
  return {
    hierarchy: [admin],
    unassigned: [loner],
    summary: { total: 7, unassigned: 1, byRole: {} },
  };
};

beforeEach(() => {
  mockApi.hierarchyLoading = false;
  mockApi.organizationHierarchy = tree();
  mockApi.fetchOrganizationHierarchyAPI = jest.fn().mockResolvedValue(tree());
});

test("renders cards with name, role and level; legend is outside the chart; unassigned shown separately", async () => {
  render(<Hierarchy />);
  const chart = document.querySelector(".oh-viewport");
  expect(within(chart).getByLabelText("Boss, Admin")).toBeInTheDocument();
  expect(within(chart).getByText("Level 1")).toBeInTheDocument();
  expect(within(chart).getByLabelText("Ex-One, Executive")).toBeInTheDocument();
  expect(within(chart).getByLabelText("Pat, Process Person")).toBeInTheDocument();
  // legend lives in the side column, not inside the chart
  expect(within(chart).queryByText("Legend")).not.toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  // unassigned employee is only in the Unassigned section
  const un = screen.getByLabelText("Unassigned Employees");
  expect(within(un).getByLabelText("Loner, Executive")).toBeInTheDocument();
  expect(within(un).getByText("No team assigned")).toBeInTheDocument();
  expect(within(chart).queryByLabelText("Loner, Executive")).not.toBeInTheDocument();
});

test("each employee appears exactly once", () => {
  render(<Hierarchy />);
  ["Boss", "Mia", "Hana", "Pat", "Ex-One", "Loner"].forEach((name) =>
    expect(screen.getAllByLabelText(new RegExp(`^${name},`))).toHaveLength(1)
  );
});

test("clicking a card shows details: name, username, role, reporting manager, team members; no secrets", () => {
  render(<Hierarchy />);
  fireEvent.click(screen.getByLabelText("Mia, Manager"));
  const panel = screen.getByText("Employee details").closest("section");
  expect(within(panel).getByText("Mia")).toBeInTheDocument();
  expect(within(panel).getByText("mia")).toBeInTheDocument();
  expect(within(panel).getByText("Boss (Admin)")).toBeInTheDocument();
  expect(within(panel).getByText("Team members (1)")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Ex-One" })).toBeInTheDocument();
  expect(panel.textContent).not.toMatch(/password|token/i);
  // clicking a team member jumps to them
  fireEvent.click(within(panel).getByRole("button", { name: "Ex-One" }));
  expect(within(panel).getByText("Mia (Manager)")).toBeInTheDocument();
});

test("collapse / expand a branch and collapse all / expand all", () => {
  render(<Hierarchy />);
  expect(screen.getByLabelText("Ex-One, Executive")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Collapse Mia"));
  expect(screen.queryByLabelText("Ex-One, Executive")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Expand Mia"));
  expect(screen.getByLabelText("Ex-One, Executive")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(screen.getByLabelText("Mia, Manager")).toBeInTheDocument(); // root stays open
  expect(screen.queryByLabelText("Ex-One, Executive")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  expect(screen.getByLabelText("Ex-One, Executive")).toBeInTheDocument();
});

test("zoom controls change the scale; reset returns to 100%", () => {
  render(<Hierarchy />);
  fireEvent.click(screen.getByLabelText("Zoom in"));
  expect(screen.getByLabelText("Zoom in").previousSibling.textContent).toBe("120%");
  fireEvent.click(screen.getByLabelText("Zoom out"));
  fireEvent.click(screen.getByLabelText("Zoom out"));
  expect(screen.getByLabelText("Zoom in").previousSibling.textContent).toBe("83%");
  fireEvent.click(screen.getByLabelText("Reset zoom"));
  expect(screen.getByLabelText("Zoom in").previousSibling.textContent).toBe("100%");
  expect(screen.getByLabelText("Fit to screen")).toBeInTheDocument();
});

test("large organisations start collapsed below Level 2", () => {
  const big = tree();
  const mgr = big.hierarchy[0].children[0];
  for (let i = 0; i < 60; i++) mgr.children.push(n("Executive", 100 + i, `Bulk-${i}`, 3));
  mockApi.organizationHierarchy = big;
  render(<Hierarchy />);
  expect(screen.getByLabelText("Mia, Manager")).toBeInTheDocument();
  expect(screen.queryByLabelText("Bulk-0, Executive")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Expand Mia"));
  expect(screen.getAllByLabelText(/^Bulk-/)).toHaveLength(60);
});

test("flatten never returns the same node twice, even if data contains a loop", () => {
  const a = n("Manager", 1, "A", 3);
  const b = n("Executive", 2, "B", 4, [a]);
  a.children.push(b); // malformed loop
  expect(flatten([a]).size).toBe(2);
});

test("loading, error and empty states", async () => {
  mockApi.organizationHierarchy = null;
  mockApi.hierarchyLoading = true;
  const { unmount } = render(<Hierarchy />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  unmount();

  mockApi.hierarchyLoading = false;
  mockApi.fetchOrganizationHierarchyAPI = jest.fn().mockResolvedValue(null);
  const r2 = render(<Hierarchy />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not load"));
  r2.unmount();

  mockApi.organizationHierarchy = { hierarchy: [], unassigned: [], summary: { total: 0, unassigned: 0 } };
  mockApi.fetchOrganizationHierarchyAPI = jest.fn().mockResolvedValue(mockApi.organizationHierarchy);
  render(<Hierarchy />);
  expect(screen.getByText("No employees found.")).toBeInTheDocument();
});

// ---- Admin assignment inside the page
import { orgApi } from "../../services/orgHierarchyApi";

describe("assignment controls in the details panel", () => {
  beforeEach(() => {
    orgApi.assignable.mockReset().mockResolvedValue({
      managers: [{ key: "manager:1", id: 1, name: "Mia", active: true }],
      employees: [{ key: "user:90", kind: "user", id: 90, name: "Loner", username: "loner", role: "Executive", active: true, managerId: null, managerName: null }],
    });
    orgApi.assign.mockReset().mockResolvedValue({ assigned: ["user:90"], unchanged: [] });
  });

  test("selecting a Manager offers Assign employees; saving reloads the chart from the server and confirms", async () => {
    render(<Hierarchy />);
    fireEvent.click(screen.getByLabelText("Mia, Manager"));
    fireEvent.click(screen.getByRole("button", { name: "Assign employees" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByLabelText(/Loner/));
    mockApi.fetchOrganizationHierarchyAPI.mockClear();
    fireEvent.click(within(dlg).getByRole("button", { name: "Assign 1 employee" }));
    await waitFor(() => expect(orgApi.assign).toHaveBeenCalledWith(1, ["user:90"], { reassign: false }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 employee now report to Mia.");
    await waitFor(() => expect(mockApi.fetchOrganizationHierarchyAPI).toHaveBeenCalled());
  });

  test("HR and Admin cards have no assignment controls; an unassigned Executive can be assigned to a manager", () => {
    render(<Hierarchy />);
    fireEvent.click(screen.getByLabelText("Hana, HR"));
    expect(screen.queryByTestId("oh-assign")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Boss, Admin"));
    expect(screen.queryByTestId("oh-assign")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Loner, Executive"));
    expect(screen.getByRole("button", { name: "Assign to a manager" })).toBeInTheDocument();
  });
});

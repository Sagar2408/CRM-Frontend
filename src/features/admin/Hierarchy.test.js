import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("./SidebarToggle", () => () => null);
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
  const ex1 = n("Executive", 11, "Ex-One", 4, [], { team: "Alpha" });
  const tl = n("TL", 5, "Tl-Alpha", 3, [ex1], { team: "Alpha", totalReports: 1 });
  ex1.reportsTo = { key: tl.key, name: tl.name, role: "TL" };
  const mgr = n("Manager", 1, "Mia", 2, [tl], { totalReports: 2 });
  tl.reportsTo = { key: mgr.key, name: "Mia", role: "Manager" };
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
  ["Boss", "Mia", "Hana", "Pat", "Tl-Alpha", "Ex-One", "Loner"].forEach((name) =>
    expect(screen.getAllByLabelText(new RegExp(`^${name},`))).toHaveLength(1)
  );
});

test("clicking a card shows details: name, username, role, reporting manager, team members; no secrets", () => {
  render(<Hierarchy />);
  fireEvent.click(screen.getByLabelText("Tl-Alpha, Team Lead"));
  const panel = screen.getByText("Employee details").closest("section");
  expect(within(panel).getByText("Tl-Alpha")).toBeInTheDocument();
  expect(within(panel).getByText("tl-alpha")).toBeInTheDocument();
  expect(within(panel).getByText("Mia (Manager)")).toBeInTheDocument();
  expect(within(panel).getByText("Team members (1)")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Ex-One" })).toBeInTheDocument();
  expect(panel.textContent).not.toMatch(/password|token/i);
  // clicking a team member jumps to them
  fireEvent.click(within(panel).getByRole("button", { name: "Ex-One" }));
  expect(within(panel).getByText("Tl-Alpha (Team Lead)")).toBeInTheDocument();
});

test("collapse / expand a branch and collapse all / expand all", () => {
  render(<Hierarchy />);
  expect(screen.getByLabelText("Ex-One, Executive")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Collapse Tl-Alpha"));
  expect(screen.queryByLabelText("Ex-One, Executive")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Expand Tl-Alpha"));
  expect(screen.getByLabelText("Ex-One, Executive")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(screen.getByLabelText("Mia, Manager")).toBeInTheDocument(); // root stays open
  expect(screen.queryByLabelText("Tl-Alpha, Team Lead")).not.toBeInTheDocument();
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
  const tl = mgr.children[0];
  for (let i = 0; i < 60; i++) tl.children.push(n("Executive", 100 + i, `Bulk-${i}`, 4));
  mockApi.organizationHierarchy = big;
  render(<Hierarchy />);
  expect(screen.getByLabelText("Mia, Manager")).toBeInTheDocument();
  expect(screen.queryByLabelText("Bulk-0, Executive")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Expand Tl-Alpha"));
  expect(screen.getAllByLabelText(/^Bulk-/)).toHaveLength(60);
});

test("flatten never returns the same node twice, even if data contains a loop", () => {
  const a = n("TL", 1, "A", 3);
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

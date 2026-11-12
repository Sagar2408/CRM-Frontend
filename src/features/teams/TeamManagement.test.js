import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import TeamManagement from "./TeamManagement";
import { teamApi } from "../../services/teamManagementApi";

// axios (pulled in by apiService) ships ESM this CRA/jest setup cannot parse.
jest.mock("../../services/teamManagementApi", () => ({
  teamApi: {
    employees: jest.fn(),
    overview: jest.fn(),
    detail: jest.fn(),
    compare: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    addMembers: jest.fn(),
    removeMember: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  },
  teamErrorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
}));
jest.mock("../admin/ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});
jest.mock("../admin/SidebarToggle", () => () => null);
jest.mock("recharts", () => {
  const Pass = ({ children }) => <div data-testid="chart">{children}</div>;
  return { ResponsiveContainer: Pass, BarChart: Pass, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null };
});

const STATS = { assigned: 5, fresh: 2, followUps: 4, converted: 1, closed: 1, meetings: 2 };
const team = (over = {}) => ({
  id: 1, name: "Sales Alpha", description: "Core sales squad", goalText: "Convert 10 leads", goal: { metric: "converted", metricLabel: "Converted Leads", target: 10, achieved: 4, percent: 40 },
  goalMetric: "converted", goalMetricLabel: "Converted Leads", targetValue: 10, startDate: "2026-11-01", endDate: "2026-12-31", archivedAt: null, status: "active",
  memberCount: 3, inactiveMembers: 0, stats: STATS, conversionRate: 20, ...over,
});
const OVERVIEW = {
  range: {}, cards: { totalTeams: 3, activeTeams: 2, archivedTeams: 1, totalMembers: 7, overallAchievement: 55.5, bestTeam: { id: 2, name: "Ops Beta", percent: 120 } },
  teams: [team(), team({ id: 2, name: "Ops Beta", goal: { metric: "assigned", metricLabel: "Leads Assigned", target: 5, achieved: 6, percent: 120 }, endDate: null, memberCount: 2 }), team({ id: 3, name: "Old Gamma", status: "archived", memberCount: 0, description: "" })],
};
const EMPLOYEES = [
  { key: "user:2", kind: "user", id: 2, name: "Eve Executive", role: "Executive", active: true, currentTeam: null },
  { key: "user:4", kind: "user", id: 4, name: "Tia Lead", role: "TL", active: true, currentTeam: null },
  { key: "manager:1", kind: "manager", id: 1, name: "Mia Manager", role: "Manager", active: true, currentTeam: null },
  { key: "hr:1", kind: "hr", id: 1, name: "Hal HR", role: "HR", active: true, currentTeam: null },
  { key: "user:5", kind: "user", id: 5, name: "Ivan Inactive", role: "Executive", active: false, currentTeam: null },
  { key: "user:6", kind: "user", id: 6, name: "Cy Busy", role: "Executive", active: true, currentTeam: { id: 2, name: "Ops Beta" } },
];
const DETAIL = {
  range: {},
  team: team(),
  members: [
    { key: "user:2", kind: "user", id: 2, name: "Eve Executive", role: "Executive", current: true, tracked: true, active: true, metrics: { assigned: 5, fresh: 2, followUps: 4, converted: 1, closed: 1, meetings: 2 }, contributionPct: 100 },
    { key: "hr:1", kind: "hr", id: 1, name: "Hal HR", role: "HR", current: true, tracked: false, active: null, metrics: { assigned: 0, fresh: 0, followUps: 0, converted: 0, closed: 0, meetings: 0 }, contributionPct: 0 },
    { key: "user:5", kind: "user", id: 5, name: "Ivan Inactive", role: "Executive", current: true, tracked: true, active: false, metrics: { assigned: 0, fresh: 0, followUps: 0, converted: 0, closed: 0, meetings: 0 }, contributionPct: 0 },
    { key: "user:3", kind: "user", id: 3, name: "Fran Former", role: "Executive", current: false, tracked: true, active: true, metrics: { assigned: 2, fresh: 0, followUps: 1, converted: 0, closed: 0, meetings: 0 }, contributionPct: 0 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  teamApi.overview.mockResolvedValue(OVERVIEW);
  teamApi.employees.mockResolvedValue({ employees: EMPLOYEES });
  teamApi.detail.mockResolvedValue(DETAIL);
});
const renderPage = async () => {
  render(<TeamManagement />);
  await screen.findByLabelText("Open Ops Beta");
};

describe("Team Management dashboard", () => {
  test("summary cards and team cards show real values: goal, progress, members, duration, status", async () => {
    await renderPage();
    expect(screen.getByTestId("card-total")).toHaveTextContent("Total Teams3");
    expect(screen.getByTestId("card-active")).toHaveTextContent("Active Teams2");
    expect(screen.getByTestId("card-members")).toHaveTextContent("Total Team Members7");
    expect(screen.getByTestId("card-achievement")).toHaveTextContent("55.5%");
    expect(screen.getByTestId("card-best")).toHaveTextContent("Ops Beta");
    expect(screen.getByTestId("card-best")).toHaveTextContent("120%");
    const alpha = screen.getByLabelText("Open Sales Alpha");
    expect(within(alpha).getByText("Active")).toBeInTheDocument();
    expect(within(alpha).getByText("Converted Leads · target 10")).toBeInTheDocument();
    expect(within(alpha).getByText("4 / 10")).toBeInTheDocument();
    expect(within(alpha).getByText("40%")).toBeInTheDocument();
    expect(within(alpha).getByText("3 members")).toBeInTheDocument();
    expect(within(alpha).getByText(/2026.*–.*2026/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Open Ops Beta")).getByText(/– ongoing/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Open Old Gamma")).getByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Team" })).toBeInTheDocument();
  });

  test("search and status filters", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(screen.getByLabelText("Open Old Gamma")).toBeInTheDocument();
    expect(screen.queryByLabelText("Open Sales Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(screen.queryByLabelText("Open Old Gamma")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Search teams"), { target: { value: "beta" } });
    expect(screen.getByLabelText("Open Ops Beta")).toBeInTheDocument();
    expect(screen.queryByLabelText("Open Sales Alpha")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search teams"), { target: { value: "zzz" } });
    expect(screen.getByText("No teams match your filters")).toBeInTheDocument();
  });

  test("date range is sent to the server; an inverted range is blocked", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-11-30" } });
    await waitFor(() => expect(teamApi.overview).toHaveBeenLastCalledWith({ startDate: "2026-11-01", endDate: "2026-11-30" }));
    expect(screen.getByText(/selected period only/)).toBeInTheDocument();
    const calls = teamApi.overview.mock.calls.length;
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-01" } });
    expect(await screen.findByText(/must not be after/)).toBeInTheDocument();
    expect(teamApi.overview.mock.calls.length).toBe(calls);
  });

  test("empty state and error state with retry", async () => {
    teamApi.overview.mockResolvedValue({ range: {}, cards: { totalTeams: 0, activeTeams: 0, archivedTeams: 0, totalMembers: 0, overallAchievement: null, bestTeam: null }, teams: [] });
    const { unmount } = render(<TeamManagement />);
    expect(await screen.findByText("No teams yet")).toBeInTheDocument();
    expect(screen.getByTestId("card-achievement")).toHaveTextContent("—");
    unmount();
    teamApi.overview.mockRejectedValue(new Error("Server down"));
    render(<TeamManagement />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server down");
    teamApi.overview.mockResolvedValue(OVERVIEW);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Open Sales Alpha")).toBeInTheDocument();
  });
});

describe("Create / edit team", () => {
  const open = async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Create Team" }));
    return screen.findByRole("dialog", { name: "Create team" });
  };

  test("validates required fields and requires at least one member", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/team name/i);
    fireEvent.change(within(dialog).getByLabelText("Team name *"), { target: { value: "New Squad" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Target value/);
    fireEvent.change(within(dialog).getByLabelText("Target value *"), { target: { value: "25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/at least one team member/);
    fireEvent.change(within(dialog).getByLabelText("End date (optional)"), { target: { value: "2000-01-01" } });
    fireEvent.click(within(dialog).getByLabelText(/Eve Executive/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/End date/);
    expect(teamApi.create).not.toHaveBeenCalled();
  });

  test("a team can mix roles; deactivated and already-assigned employees cannot be picked", async () => {
    const dialog = await open();
    expect(within(dialog).getByLabelText(/Ivan Inactive/)).toBeDisabled();
    expect(within(dialog).getByText("Deactivated")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Cy Busy/)).toBeDisabled();
    expect(within(dialog).getByText("In Ops Beta")).toBeInTheDocument();

    teamApi.create.mockResolvedValue({ team: team({ id: 9, name: "New Squad" }) });
    fireEvent.change(within(dialog).getByLabelText("Team name *"), { target: { value: "New Squad" } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Cross-functional" } });
    fireEvent.change(within(dialog).getByLabelText("Team goal"), { target: { value: "Hit Q4" } });
    fireEvent.change(within(dialog).getByLabelText("Goal metric *"), { target: { value: "meetings" } });
    fireEvent.change(within(dialog).getByLabelText("Target value *"), { target: { value: "25" } });
    for (const n of [/Eve Executive/, /Tia Lead/, /Mia Manager/, /Hal HR/]) fireEvent.click(within(dialog).getByLabelText(n));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    await waitFor(() => expect(teamApi.create).toHaveBeenCalled());
    const body = teamApi.create.mock.calls[0][0];
    expect(body).toMatchObject({ name: "New Squad", description: "Cross-functional", goal: "Hit Q4", goalMetric: "meetings", targetValue: 25 });
    expect(body.memberKeys.sort()).toEqual(["hr:1", "manager:1", "user:2", "user:4"]); // Executive + TL + Manager + HR
    expect(body.endDate).toBeUndefined();
    await waitFor(() => expect(teamApi.detail).toHaveBeenCalledWith(9, expect.anything())); // opens the new team
  });

  test("server errors (e.g. employee already in a team) are shown and keep the form open", async () => {
    const dialog = await open();
    teamApi.create.mockRejectedValue({ response: { data: { message: 'Eve is already an active member of "Ops Beta".' } } });
    fireEvent.change(within(dialog).getByLabelText("Team name *"), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByLabelText("Target value *"), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByLabelText(/Eve Executive/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
    expect(await within(dialog).findByText(/already an active member/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Create team" })).toBeInTheDocument();
  });
});

describe("Team details drawer", () => {
  const openTeam = async (name = "Sales Alpha") => {
    await renderPage();
    fireEvent.click(screen.getByLabelText(`Open ${name}`));
    return screen.findByRole("dialog", { name: "Team details" });
  };

  test("shows goal achievement, all performance stats, members with roles and individual contribution", async () => {
    const drawer = await openTeam();
    await within(drawer).findByText("Eve Executive");
    expect(within(drawer).getByTestId("goal-percent")).toHaveTextContent("40%");
    expect(within(drawer).getByText(/4 of 10/)).toBeInTheDocument();
    expect(within(drawer).getByTestId("stat-assigned")).toHaveTextContent("5");
    expect(within(drawer).getByTestId("stat-fresh")).toHaveTextContent("2");
    expect(within(drawer).getByTestId("stat-followUps")).toHaveTextContent("4");
    expect(within(drawer).getByTestId("stat-converted")).toHaveTextContent("1");
    expect(within(drawer).getByTestId("stat-closed")).toHaveTextContent("1");
    expect(within(drawer).getByTestId("stat-meetings")).toHaveTextContent("2");
    expect(within(drawer).getByTestId("stat-conversion")).toHaveTextContent("20%");
    // roles are mixed; non-lead roles say so instead of showing fake zeros
    expect(within(drawer).getByText("HR")).toBeInTheDocument();
    expect(within(drawer).getByText("No lead activity tracked for this role")).toBeInTheDocument();
    expect(within(drawer).getByText("Deactivated")).toBeInTheDocument();
    expect(within(drawer).getByText("Former member")).toBeInTheDocument();
    expect(teamApi.detail).toHaveBeenCalledWith(1, { startDate: "", endDate: "" });
  });

  test("archiving needs confirmation and keeps history; removing a member needs confirmation", async () => {
    const drawer = await openTeam();
    await within(drawer).findByText("Eve Executive");
    teamApi.archive.mockResolvedValue({});
    fireEvent.click(within(drawer).getByRole("button", { name: "Archive team" }));
    const confirm = await screen.findByRole("dialog", { name: "Archive team?" });
    expect(within(confirm).getByText(/Performance history is kept/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(teamApi.archive).not.toHaveBeenCalled();
    fireEvent.click(within(drawer).getByRole("button", { name: "Archive team" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Archive team?" })).getByRole("button", { name: "Archive team" }));
    await waitFor(() => expect(teamApi.archive).toHaveBeenCalledWith(1));

    teamApi.removeMember.mockResolvedValue({});
    fireEvent.click(within(drawer).getByLabelText("Remove Hal HR"));
    const rm = await screen.findByRole("dialog", { name: "Remove member?" });
    expect(within(rm).getByText(/past contribution stays/)).toBeInTheDocument();
    fireEvent.click(within(rm).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(teamApi.removeMember).toHaveBeenCalledWith(1, "hr:1"));
  });

  test("add members excludes current members and sends the picked keys", async () => {
    const drawer = await openTeam();
    await within(drawer).findByText("Eve Executive");
    teamApi.addMembers.mockResolvedValue({ added: ["manager:1"] });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add members" }));
    const dlg = await screen.findByRole("dialog", { name: "Add members" });
    const mia = await within(dlg).findByLabelText(/Mia Manager/); // list has loaded
    expect(within(dlg).queryByLabelText(/Eve Executive/)).not.toBeInTheDocument(); // already in the team
    fireEvent.click(mia);
    fireEvent.click(within(dlg).getByRole("button", { name: "Add 1 member" }));
    await waitFor(() => expect(teamApi.addMembers).toHaveBeenCalledWith(1, ["manager:1"]));
  });

  test("archived teams are read-only and can be restored; server errors are shown", async () => {
    teamApi.detail.mockResolvedValue({ ...DETAIL, team: team({ id: 3, name: "Old Gamma", status: "archived", memberCount: 0 }), members: [DETAIL.members[3]] });
    const drawer = await openTeam("Old Gamma");
    await within(drawer).findByText("Fran Former");
    expect(within(drawer).queryByRole("button", { name: "Add members" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Archive team" })).not.toBeInTheDocument();
    teamApi.restore.mockRejectedValue({ response: { data: { message: "A team with this name already exists." } } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Restore team" }));
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("already exists");
  });

  test("Edit opens the form with the team's values", async () => {
    const drawer = await openTeam();
    await within(drawer).findByText("Eve Executive");
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit team" }));
    const dlg = await screen.findByRole("dialog", { name: "Edit team" });
    expect(within(dlg).getByLabelText("Team name *")).toHaveValue("Sales Alpha");
    expect(within(dlg).getByLabelText("Goal metric *")).toHaveValue("converted");
    expect(within(dlg).getByLabelText("Team goal")).toHaveValue("Convert 10 leads");
    expect(within(dlg).queryByText(/Team members/)).not.toBeInTheDocument(); // members are managed in the drawer
    teamApi.update.mockResolvedValue({ team: team() });
    fireEvent.change(within(dlg).getByLabelText("Target value *"), { target: { value: "20" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(teamApi.update).toHaveBeenCalledWith(1, expect.objectContaining({ targetValue: 20, goalMetric: "converted" })));
  });
});

describe("Team comparison", () => {
  const compareResult = {
    range: {},
    teams: [
      { ...team(), rank: 1, goal: { metric: "assigned", metricLabel: "Leads Assigned", target: 5, achieved: 6, percent: 120 }, id: 2, name: "Ops Beta", goalMetric: "assigned", members: [{ key: "user:2", name: "Eve Executive", tracked: true, current: true, metrics: { assigned: 6 }, contributionPct: 100 }] },
      { ...team(), rank: 2, id: 1, name: "Sales Alpha", goalMetric: "converted", members: [{ key: "user:4", name: "Tia Lead", tracked: true, current: false, metrics: { converted: 4 }, contributionPct: 100 }] },
    ],
  };

  test("needs two teams, compares over the date range and shows ranking, chart and contributions", async () => {
    await renderPage();
    const panel = screen.getByRole("region", { name: "Team comparison" });
    const btn = within(panel).getByRole("button", { name: /Compare/ });
    expect(btn).toBeDisabled();
    fireEvent.click(within(panel).getByLabelText("Compare Sales Alpha"));
    expect(btn).toBeDisabled();
    fireEvent.click(within(panel).getByLabelText("Compare Ops Beta"));
    expect(btn).toBeEnabled();
    teamApi.compare.mockResolvedValue(compareResult);
    fireEvent.click(btn);
    await within(panel).findByLabelText("Ranking");
    expect(teamApi.compare).toHaveBeenCalledWith([1, 2], { startDate: "", endDate: "" });
    const rows = within(within(panel).getByLabelText("Ranking")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[1]).toHaveTextContent("Ops Beta");
    expect(rows[1]).toHaveTextContent("120%");
    expect(rows[2]).toHaveTextContent("#2");
    expect(within(panel).getByLabelText("Comparison chart")).toBeInTheDocument();
    expect(within(panel).getByText("Individual contributions")).toBeInTheDocument();
    expect(within(panel).getByText(/Tia Lead/)).toBeInTheDocument();
    expect(within(panel).getByText("(former)")).toBeInTheDocument();
  });

  test("comparison errors are shown", async () => {
    await renderPage();
    const panel = screen.getByRole("region", { name: "Team comparison" });
    fireEvent.click(within(panel).getByLabelText("Compare Sales Alpha"));
    fireEvent.click(within(panel).getByLabelText("Compare Ops Beta"));
    teamApi.compare.mockRejectedValue({ response: { data: { message: "One or more teams were not found." } } });
    fireEvent.click(within(panel).getByRole("button", { name: /Compare/ }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("not found");
  });
});

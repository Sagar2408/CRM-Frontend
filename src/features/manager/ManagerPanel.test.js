import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";

jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a> }));
jest.mock("../admin/SidebarToggle", () => () => null);
jest.mock("recharts", () => {
  const Box = ({ children }) => <div data-testid="chart">{children}</div>;
  return new Proxy({}, { get: () => Box });
});
jest.mock("../../services/managerTaskService", () => {
  const actual = jest.requireActual("../../services/managerTaskService");
  return {
    ...actual,
    getManagerDashboard: jest.fn(),
    taskApi: { members: jest.fn(), summary: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
  };
});

import * as svc from "../../services/managerTaskService";
import ManagerDashboard from "./ManagerDashboard";
import TaskManagement from "./TaskManagement";

const task = (over = {}) => ({ id: 1, title: "Call hot leads", description: "", priority: "high", status: "in_progress", progress: 40, dueDate: "2026-11-25", assigneeId: 5, assigneeName: "Asha Rao", overdue: false, ...over });
const members = [{ id: 5, name: "Asha Rao", teamName: "Alpha" }, { id: 6, name: "Ravi K", teamName: "Alpha" }];
const summary = { total: 3, todo: 1, inProgress: 1, completed: 1, overdue: 1, dueToday: 0, completionRate: 33 };

beforeEach(() => {
  jest.clearAllMocks();
  svc.taskApi.members.mockResolvedValue({ members, teams: [] });
  svc.taskApi.summary.mockResolvedValue(summary);
  svc.taskApi.list.mockResolvedValue({ tasks: [task(), task({ id: 2, title: "Send quotes", overdue: true, status: "todo", progress: 0, assigneeName: "Ravi K", assigneeId: 6 })], total: 2, page: 1, limit: 10 });
});

describe("Manager Task Management", () => {
  test("lists real tasks with status, overdue flag and summary counts", async () => {
    render(<TaskManagement />);
    expect((await screen.findAllByText("Call hot leads")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("stat-overdue")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-completed")).toHaveTextContent("1");
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(svc.taskApi.members).toHaveBeenCalledTimes(1);
  });

  test("the Overdue tab asks the server for overdue tasks only", async () => {
    render(<TaskManagement />);
    await screen.findAllByText("Call hot leads");
    fireEvent.click(screen.getByRole("tab", { name: "Overdue" }));
    await waitFor(() => expect(svc.taskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ overdue: true, page: 1 })));
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    await waitFor(() => expect(svc.taskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "completed" })));
  });

  test("creates a task for a team member chosen from the server-provided members", async () => {
    svc.taskApi.create.mockResolvedValue(task({ id: 9, title: "New outreach", assigneeName: "Ravi K" }));
    render(<TaskManagement />);
    await screen.findAllByText("Call hot leads");
    fireEvent.click(screen.getByRole("button", { name: "+ New task" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please enter a title.");
    fireEvent.change(within(dialog).getByPlaceholderText("What needs to be done?"), { target: { value: "New outreach" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please choose a team member.");
    fireEvent.change(within(dialog).getByDisplayValue("Select a team member"), { target: { value: "6" } });
    fireEvent.change(within(dialog).getByDisplayValue("Medium"), { target: { value: "urgent" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    await waitFor(() => expect(svc.taskApi.create).toHaveBeenCalledWith(expect.objectContaining({ title: "New outreach", assigneeId: 6, priority: "urgent" })));
    expect(await screen.findByRole("status")).toHaveTextContent("assigned to Ravi K");
  });

  test("editing can reassign and keeps status/progress consistent", async () => {
    svc.taskApi.update.mockResolvedValue(task({ assigneeName: "Ravi K", status: "completed", progress: 100 }));
    render(<TaskManagement />);
    await screen.findAllByText("Call hot leads");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Asha Rao — Alpha"), { target: { value: "6" } });
    fireEvent.change(within(dialog).getByRole("slider", { name: "Progress" }), { target: { value: "100" } });
    expect(within(dialog).getByDisplayValue("Completed")).toBeInTheDocument(); // 100% => completed
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(svc.taskApi.update).toHaveBeenCalledWith(1, expect.objectContaining({ assigneeId: 6, status: "completed", progress: 100 })));
  });

  test("a server refusal (task outside the manager's team) is shown, not swallowed", async () => {
    svc.taskApi.create.mockRejectedValue({ response: { data: { message: "You can only assign tasks to members of your own team." } } });
    render(<TaskManagement />);
    await screen.findAllByText("Call hot leads");
    fireEvent.click(screen.getByRole("button", { name: "+ New task" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("What needs to be done?"), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByDisplayValue("Select a team member"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("only assign tasks to members of your own team");
  });

  test("deleting asks for confirmation first", async () => {
    svc.taskApi.remove.mockResolvedValue({ id: 1 });
    render(<TaskManagement />);
    await screen.findAllByText("Call hot leads");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(svc.taskApi.remove).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(svc.taskApi.remove).toHaveBeenCalledWith(1));
  });

  test("a manager with no team sees guidance and cannot create tasks", async () => {
    svc.taskApi.members.mockResolvedValue({ members: [], teams: [] });
    svc.taskApi.list.mockResolvedValue({ tasks: [], total: 0 });
    render(<TaskManagement />);
    expect(await screen.findByTestId("no-team")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ New task" })).toBeDisabled();
  });
});

const dash = (over = {}) => ({
  team: { teams: [{ id: 1, name: "Alpha" }], size: 2, online: 1, active: 2 },
  work: { today: [{ id: 5, name: "Asha Rao", workSeconds: 3725, breakSeconds: 600, onBreak: false }], totalWorkSeconds: 3725, totalBreakSeconds: 600 },
  funnel: [{ stage: "New", count: 4 }, { stage: "Closed", count: 2 }],
  leads: { total: 6 },
  meetings: { today: 1, upcoming: [{ id: 3, clientName: "Acme Ltd", startTime: "2026-11-21T10:00:00Z", executiveName: "Asha Rao" }] },
  tasks: { total: 3, todo: 1, inProgress: 1, completed: 1, overdue: 1, dueToday: 0, completionRate: 33 },
  performance: [{ id: 5, name: "Asha Rao", username: "asha", teamName: "Alpha", online: true, workSeconds: 3725, breakSeconds: 600, onBreak: false, leadsAssigned: 6, leadsClosed: 2, leadsInFollowUp: 1, tasksOpen: 2, tasksCompleted: 1, tasksOverdue: 1 }],
  topTasks: [task()],
  ...over,
});

describe("Manager dashboard", () => {
  test("renders real team KPIs, work/break time and performance rows", async () => {
    svc.getManagerDashboard.mockResolvedValue(dash());
    render(<ManagerDashboard />);
    expect(await screen.findByText("Manager Overview")).toBeInTheDocument();
    expect(screen.getByTestId("stat-team")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-online")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-leads")).toHaveTextContent("6");
    expect(screen.getByTestId("stat-work")).toHaveTextContent("1h 02m");
    expect(screen.getByTestId("stat-overdue")).toHaveTextContent("1");
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0);
  });

  test("a manager without a team gets guidance instead of fake numbers", async () => {
    svc.getManagerDashboard.mockResolvedValue(dash({ team: { teams: [], size: 0, online: 0, active: 0 }, work: { today: [], totalWorkSeconds: 0, totalBreakSeconds: 0 }, funnel: [], leads: { total: 0 }, performance: [], topTasks: [], tasks: { total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, dueToday: 0, completionRate: 0 }, meetings: { today: 0, upcoming: [] } }));
    render(<ManagerDashboard />);
    expect(await screen.findByTestId("no-team")).toBeInTheDocument();
    expect(screen.getByTestId("stat-team")).toHaveTextContent("0");
  });

  test("a failed load shows the server message with Retry", async () => {
    svc.getManagerDashboard.mockRejectedValueOnce({ response: { data: { message: "Insufficient permissions." } } });
    svc.getManagerDashboard.mockResolvedValueOnce(dash());
    render(<ManagerDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Manager Overview")).toBeInTheDocument();
  });
});

describe("manager nav", () => {
  const { NAV, resolveNav, firstAllowedPath } = require("../../layouts/navConfig");
  test("Executive Details is gone; Task Management, Messaging and ELSA AI are present", () => {
    const all = Object.fromEntries(["dashboard", "monitoring", "executive_details", "account_updates", "weekly_summary", "settings", "assign_task", "task_management", "user_management", "messaging"].map((k) => [k, true]));
    const n = resolveNav(NAV.manager, all);
    const labels = [...n.general, ...n.external].map((i) => i.label);
    expect(labels).not.toContain("Executive Details");
    expect(labels).not.toContain("Team Management");
    expect(labels).toEqual(expect.arrayContaining(["Overview", "Task Management", "Attendance", "Messaging", "ELSA AI"]));
    expect(n.general.find((i) => i.id === "teams").to).toBe("teams");
  });
  test("ELSA AI never counts as an enabled page and is never the landing fallback", () => {
    expect(resolveNav(NAV.manager, {}).total).toBe(0);
    expect(firstAllowedPath(NAV.manager, {})).toBeNull();
  });
});

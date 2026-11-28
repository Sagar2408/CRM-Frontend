import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TaskManagement from "./TaskManagement";
import HrNotification from "../hr/HrNotification";
import AdminNotification from "../admin/AdminNotification";

// Who sees lead assignment: Admin always, HR / Manager only with Task Management. The
// server enforces the same rule (CRM-Backend middleware/leadAssignment.js).
let mockPermissions = null;
jest.mock("../../context/PermissionContext", () => ({ usePermissionContext: () => ({ permissions: mockPermissions }) }));
jest.mock("../modal/alert", () => ({ Alert: () => null, soundManager: { playSound: jest.fn() } }));
jest.mock("../admin/SidebarToggle", () => () => null);
jest.mock("../spinner/AdminSpinner", () => () => null);
jest.mock("../admin/AnnouncementsPanel", () => () => null);
jest.mock("../admin/ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});
const mockLoading = { isLoading: false, variant: "", showLoader: () => {}, hideLoader: () => {} };
jest.mock("../../context/LoadingContext", () => ({ useLoading: () => mockLoading }));

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
const mockProcess = {};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockProcess }));

const signIn = (role, permissions = null) => {
  localStorage.setItem("user", JSON.stringify({ id: 1, role }));
  mockPermissions = permissions;
};

beforeEach(() => {
  localStorage.clear();
  Object.assign(mockApi, {
    notifications: [{ id: 1, userId: 2, message: "Copied: 98765", createdAt: "2026-11-01T00:00:00Z", is_read: false }],
    notificationsLoading: false,
    readMeetings: new Set(),
    fetchNotifications: jest.fn(async () => {}),
    markNotificationReadAPI: jest.fn(),
    markMeetingAsRead: jest.fn(),
    adminMeeting: jest.fn(async () => []),
    fetchExecutivesAPI: jest.fn(async () => [{ id: 2, username: "exec1" }]),
    fetchAllClients: jest.fn(async () => ({
      leads: [{ id: 4, name: "Nina New", email: "n@x.com", phone: "1", status: "New" }],
      pagination: { total: 1 },
      statusCounts: { all: 1, New: 1 },
    })),
    reassignLead: jest.fn(),
    assignLeadAPI: jest.fn(async () => ({})),
    createFreshLeadAPI: jest.fn(async () => ({})),
    createLeadAPI: jest.fn(async () => ({ id: 70, clientLeadId: 4, name: "Nina New" })),
    updateClientLead: jest.fn(),
    deleteClientLead: jest.fn(),
    triggerDashboardRefresh: jest.fn(),
  });
  Object.assign(mockProcess, {
    getAllProcessPersons: jest.fn(async () => ({ processPersons: [{ id: 5, fullName: "Pat Process" }] })),
    createProcesstoConverted: jest.fn(async () => ({ imported: 1 })),
  });
});

describe.each(["HR", "Manager"])("%s", (role) => {
  test("with Task Management: sees both lists and can assign, but is not offered Delete", async () => {
    signIn(role, { task_management: true });
    render(<TaskManagement />);
    expect(await screen.findByText("Nina New")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "exec1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/select executive/i), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Select Nina New"));
    fireEvent.click(screen.getByRole("button", { name: /^Assign \(1\)/ }));
    await waitFor(() => expect(mockApi.createFreshLeadAPI).toHaveBeenCalled());
    expect(mockApi.createLeadAPI).toHaveBeenCalledWith(expect.objectContaining({ clientLeadId: 4, assignedToExecutive: "exec1" }));
    expect(mockApi.assignLeadAPI).toHaveBeenCalledWith(4, "exec1");

    fireEvent.click(screen.getByRole("tab", { name: "Process Person" }));
    expect(await screen.findByRole("option", { name: "Pat Process" })).toBeInTheDocument();
  });

  test.each([
    ["switched off", { task_management: false, assign_task: true }],
    ["no permission record", null],
  ])("%s: no assignment page and no requests for it", (_label, permissions) => {
    signIn(role, permissions);
    render(<TaskManagement />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign/i })).not.toBeInTheDocument();
    expect(mockApi.fetchExecutivesAPI).not.toHaveBeenCalled();
    expect(mockApi.fetchAllClients).not.toHaveBeenCalled();
    expect(mockProcess.getAllProcessPersons).not.toHaveBeenCalled();
  });

  test("a refused list is reported instead of showing an empty dropdown silently", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    signIn(role, { task_management: true });
    mockApi.fetchExecutivesAPI.mockRejectedValue({ response: { status: 403 } });
    mockProcess.getAllProcessPersons.mockResolvedValue(undefined);
    render(<TaskManagement />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load the executive list/i);
    fireEvent.click(screen.getByRole("tab", { name: "Process Person" }));
    expect(await screen.findByText(/could not load the process person list/i)).toBeInTheDocument();
  });
});

test("Admin needs no permission record and keeps Delete", async () => {
  signIn("Admin");
  render(<TaskManagement />);
  expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: "exec1" })).toBeInTheDocument();
});

test("an Executive is not offered lead assignment even if the flag is set", () => {
  signIn("Executive", { task_management: true });
  render(<TaskManagement />);
  expect(screen.getByText("Access Denied")).toBeInTheDocument();
});

describe.each([
  ["HR notifications", HrNotification, "HR"],
  ["Manager notifications", AdminNotification, "Manager"],
])("%s", (_label, Page, role) => {
  test("looks up executive names only with Task Management; notifications load either way", async () => {
    signIn(role, { task_management: false, push_notifications: true });
    const first = render(<Page />);
    await waitFor(() => expect(mockApi.fetchNotifications).toHaveBeenCalled());
    expect(mockApi.fetchExecutivesAPI).not.toHaveBeenCalled();
    expect(screen.getByText(/98765/)).toBeInTheDocument();
    first.unmount();

    signIn(role, { task_management: true, push_notifications: true });
    render(<Page />);
    await waitFor(() => expect(mockApi.fetchExecutivesAPI).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/98765/)).toBeInTheDocument();
    // the Manager page shows who copied it, once allowed to read the names
    if (role === "Manager") expect(await screen.findByText("exec1")).toBeInTheDocument();
  });
});

test("Admin notifications still look up executive names", async () => {
  signIn("Admin");
  render(<AdminNotification />);
  await waitFor(() => expect(mockApi.fetchExecutivesAPI).toHaveBeenCalledTimes(1));
});

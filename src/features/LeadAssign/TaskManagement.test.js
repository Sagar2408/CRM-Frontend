import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const mockFetchAllClients = jest.fn();
const mockCreateProcess = jest.fn();
const mockReassign = jest.fn();

jest.mock("../modal/alert", () => ({
  Alert: () => null,
  soundManager: { playSound: jest.fn() },
}));
jest.mock("../admin/SidebarToggle", () => () => null);
jest.mock("../spinner/AdminSpinner", () => () => null);
jest.mock("../admin/ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});
jest.mock("../../context/LoadingContext", () => ({
  useLoading: () => ({ isLoading: false, variant: "", showLoader: jest.fn(), hideLoader: jest.fn() }),
}));

const mockApi = {
  fetchAllClients: (...a) => mockFetchAllClients(...a),
  reassignLead: (...a) => mockReassign(...a),
  fetchExecutivesAPI: jest.fn(async () => [{ id: 1, username: "exec1" }]),
  assignLeadAPI: jest.fn(),
  createFreshLeadAPI: jest.fn(),
  createLeadAPI: jest.fn(),
  updateClientLead: jest.fn(),
  deleteClientLead: jest.fn(),
  triggerDashboardRefresh: jest.fn(),
};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));

const mockProcessSvc = {
  getAllProcessPersons: jest.fn(async () => ({ processPersons: [{ id: 5, fullName: "Pat Process" }] })),
  createProcesstoConverted: (...a) => mockCreateProcess(...a),
};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockProcessSvc }));

import TaskManagement from "./TaskManagement";

const DATA = {
  new: [{ id: 1, name: "Nina New", email: "n@x.com", phone: "1", status: "New" }],
  fresh: [{ id: 2, name: "Frank Fresh", email: "f@x.com", phone: "2", status: "Assigned", assignedToExecutive: "exec1" }],
  followup: [{ id: 3, name: "Fiona Followup", email: "fu@x.com", phone: "3", status: "Follow-Up" }],
  converted: [
    { id: 4, name: "Carl Converted", email: "c@x.com", phone: "4", status: "Converted", convertedClientId: 40 },
    { id: 5, name: "Cora Converted", email: "co@x.com", phone: "5", status: "Converted", convertedClientId: 41 },
  ],
  closed: [{ id: 6, name: "Cleo Closed", email: "cl@x.com", phone: "6", status: "Closed" }],
  meeting: [{ id: 7, name: "Mike Meeting", email: "m@x.com", phone: "7", status: "Meeting" }],
};
DATA.all = Object.values(DATA).flat();

beforeEach(() => {
  jest.clearAllMocks();
  // CRA runs with resetMocks:true, so inline implementations must be set per test.
  mockApi.fetchExecutivesAPI.mockResolvedValue([{ id: 1, username: "exec1" }]);
  mockProcessSvc.getAllProcessPersons.mockResolvedValue({ processPersons: [{ id: 5, fullName: "Pat Process" }] });
  mockFetchAllClients.mockImplementation(async ({ status }) => ({
    leads: DATA[status] || [],
    pagination: { total: (DATA[status] || []).length },
    statusCounts: { all: 7, New: 1, Assigned: 1, "Follow-Up": 1, Converted: 2, Closed: 1, Meeting: 1 },
  }));
  mockCreateProcess.mockResolvedValue({ imported: 2, reassigned: 0, skipped: 0, errors: [] });
});

const tab = (name) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });

describe("Lead Assign status tabs", () => {
  test.each([
    ["New", "new", "Nina New"],
    ["Fresh", "fresh", "Frank Fresh"],
    ["Followup", "followup", "Fiona Followup"],
    ["Converted", "converted", "Carl Converted"],
    ["Closed", "closed", "Cleo Closed"],
    ["Meeting", "meeting", "Mike Meeting"],
  ])("%s tab requests status=%s and shows only that status", async (label, key, expectedName) => {
    render(<TaskManagement />);
    await screen.findByText("Nina New"); // initial "all" load
    fireEvent.click(tab(label));

    await waitFor(() => expect(screen.getByText(expectedName)).toBeInTheDocument());
    expect(mockFetchAllClients).toHaveBeenLastCalledWith(expect.objectContaining({ status: key, page: 1 }));
    // No rows of other statuses leak in, and the tab stays selected (the old bug reset it to All).
    DATA.all
      .filter((l) => !DATA[key].includes(l))
      .forEach((l) => expect(screen.queryByText(l.name)).not.toBeInTheDocument());
    expect(tab(label)).toHaveAttribute("aria-selected", "true");
    expect(tab("All")).toHaveAttribute("aria-selected", "false");
  });

  test("tab clicks do not snap back to All after the refetch settles", async () => {
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    fireEvent.click(tab("Closed"));
    await screen.findByText("Cleo Closed");
    await new Promise((r) => setTimeout(r, 50));
    expect(tab("Closed")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Nina New")).not.toBeInTheDocument();
  });
});

describe("Process Person assignment", () => {
  test("switching to Process Person jumps to Converted; only Converted rows are selectable; assigns by ClientLead id", async () => {
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    // "All" tab in executive mode: everything selectable
    expect(screen.getByLabelText("Select Nina New")).not.toBeDisabled();

    fireEvent.click(screen.getByRole("tab", { name: "Process Person" }));
    await screen.findByText("Carl Converted");
    expect(tab("Converted")).toHaveAttribute("aria-selected", "true");

    await screen.findByRole("option", { name: "Pat Process" });
    fireEvent.change(screen.getByLabelText(/Select process person/i), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText("Select all leads on this page"));
    fireEvent.click(screen.getByRole("button", { name: /^Assign \(2\)/ }));

    await waitFor(() =>
      expect(mockCreateProcess).toHaveBeenCalledWith({ processPersonId: 5, clientLeadIds: [4, 5] })
    );
    // list is refetched after assigning, and selection is cleared
    await waitFor(() => expect(screen.getByRole("button", { name: /^Assign$/ })).toBeInTheDocument());
  });

  test("non-Converted rows are disabled in Process Person mode", async () => {
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    fireEvent.click(tab("All"));
    fireEvent.click(screen.getByRole("tab", { name: "Process Person" }));
    await screen.findByText("Carl Converted");
    // Converted tab: both enabled
    expect(screen.getByLabelText("Select Carl Converted")).not.toBeDisabled();
    // Switch to New tab while in Process mode: the lead exists but can't be chosen
    fireEvent.click(tab("New"));
    const box = await screen.findByLabelText("Select Nina New");
    expect(box).toBeDisabled();
  });

  test("requires an employee and at least one lead", async () => {
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    fireEvent.click(screen.getByRole("button", { name: /^Assign$/ }));
    expect(mockCreateProcess).not.toHaveBeenCalled();
    expect(mockReassign).not.toHaveBeenCalled();
  });
});

describe("Executive assignment, selection, reset", () => {
  test("reassigns an already-assigned lead to the chosen executive via the existing reassign API", async () => {
    mockReassign.mockResolvedValue({});
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    fireEvent.click(tab("Fresh"));
    await screen.findByText("Frank Fresh");
    await screen.findByRole("option", { name: "exec1" });
    fireEvent.change(screen.getByLabelText(/Select executive/i), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText("Select Frank Fresh"));
    fireEvent.click(screen.getByRole("button", { name: /^Assign \(1\)/ }));
    await waitFor(() => expect(mockReassign).toHaveBeenCalledWith(2, "exec1"));
  });

  test("Reset clears selection and the chosen employee", async () => {
    render(<TaskManagement />);
    await screen.findByText("Nina New");
    await screen.findByRole("option", { name: "exec1" });
    fireEvent.change(screen.getByLabelText(/Select executive/i), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText("Select Nina New"));
    expect(screen.getByRole("button", { name: /^Assign \(1\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: /^Assign$/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Select executive/i).value).toBe("");
    expect(screen.getByLabelText("Select Nina New")).not.toBeChecked();
  });

  test("pagination requests the next page from the server", async () => {
    mockFetchAllClients.mockImplementation(async ({ page }) => ({
      leads: [{ id: page, name: `Lead page ${page}`, email: "p@x.com", phone: "1", status: "New" }],
      pagination: { total: 25 },
      statusCounts: {},
    }));
    render(<TaskManagement />);
    await screen.findByText("Lead page 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Lead page 2");
    expect(mockFetchAllClients).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 }));
  });
});

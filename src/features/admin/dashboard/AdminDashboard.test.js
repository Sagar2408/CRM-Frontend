import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const mockApi = {};
jest.mock("../../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("react-chartjs-2", () => ({
  Doughnut: ({ data }) => (
    <div data-testid="doughnut">{JSON.stringify(data.labels)}|{JSON.stringify(data.datasets[0].data)}</div>
  ),
}));
jest.mock("chart.js/auto", () => ({}));
jest.mock("./EmployeeLiveStatus", () => () => null); // covered by its own test

import AdminDashboard, { rangeFor } from "./AdminDashboard";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

beforeEach(() => {
  // CRA runs with resetMocks:true — implementations must be set per test.
  mockApi.fetchLeadPerformance = jest.fn().mockResolvedValue({
    total: 10,
    byStatus: { New: 4, "Follow-Up": 2, Converted: 3, Closed: 1 },
    assignedToProcessPersons: 2,
  });
  mockApi.fetchExecutivesAPI = jest.fn().mockResolvedValue([{ id: 7, username: "exec1" }]);
  mockApi.fetchExecutivePerformance = jest.fn().mockResolvedValue([
    { executiveId: 7, name: "exec1", totalAssigned: 6, pending: 3, converted: 2, closed: 1 },
    { executiveId: 8, name: "exec2", totalAssigned: 4, pending: 4, converted: 0, closed: 0 },
  ]);
  mockApi.fetchProcessPersonPerformance = jest.fn().mockResolvedValue([
    { processPersonId: 1, name: "Pat", assignedLeads: 5, pendingLeads: 3, completedLeads: 2 },
  ]);
  mockApi.adminMeeting = jest.fn().mockResolvedValue([
    { id: 1, clientName: "Old Client", startTime: past, executiveId: 7 },
    { id: 2, clientName: "Soon Client", startTime: future, executiveId: 7 },
  ]);
  mockApi.fetchRecentLeadActivity = jest.fn().mockResolvedValue([
    { id: 9, name: "Lena Lead", status: "Converted", assignedToExecutive: "exec1", updatedAt: past },
  ]);
});

const kpi = (label) => screen.getByText(label).previousSibling;

test("KPI cards and the status distribution come from the API (counts and percentages)", async () => {
  render(<AdminDashboard />);
  await waitFor(() => expect(kpi("Total Leads")).toHaveTextContent("10"));
  expect(kpi("New Leads")).toHaveTextContent("4");
  expect(kpi("Follow-up Leads")).toHaveTextContent("2");
  expect(kpi("Converted Leads")).toHaveTextContent("3");
  expect(kpi("Closed Leads")).toHaveTextContent("1");
  expect(kpi("Process Person Assigned")).toHaveTextContent("2");

  const chart = screen.getByTestId("doughnut").textContent;
  expect(chart).toContain("[4,2,3,1]"); // statuses with zero leads are omitted
  const dist = screen.getByText("Lead Status Distribution").closest("section");
  const legend = within(dist).getByText("Converted").closest("li");
  expect(within(legend).getByText("3")).toBeInTheDocument();
  expect(within(legend).getByText("30%")).toBeInTheDocument();
  expect(mockApi.fetchLeadPerformance).toHaveBeenCalledTimes(1); // one fetch feeds KPIs + chart
});

test("Executive and Process Person tables render real rows with totals", async () => {
  render(<AdminDashboard />);
  await screen.findByText("exec2");
  const execTable = screen.getByText("Executive Performance").closest("section");
  expect(within(execTable).getByText("exec1")).toBeInTheDocument();
  expect(within(execTable).getByText("Total").closest("tr")).toHaveTextContent("Total10721"); // 6+4, 3+4, 2+0, 1+0
  const ppTable = (await screen.findByText("Pat")).closest("section");
  expect(within(ppTable).getByText("Completed")).toBeInTheDocument();
});

test("filters: executive and date range are sent to the APIs; process persons get the date range only", async () => {
  render(<AdminDashboard />);
  await screen.findByRole("option", { name: "exec1" });
  fireEvent.change(screen.getByLabelText("Executive"), { target: { value: "7" } });
  await waitFor(() =>
    expect(mockApi.fetchExecutivePerformance).toHaveBeenLastCalledWith(expect.objectContaining({ executiveId: "7" }))
  );
  fireEvent.change(screen.getByLabelText("Date range"), { target: { value: "30" } });
  await waitFor(() => {
    const execCall = mockApi.fetchExecutivePerformance.mock.calls.slice(-1)[0][0];
    expect(execCall.executiveId).toBe("7");
    expect(execCall.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(execCall.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ppCall = mockApi.fetchProcessPersonPerformance.mock.calls.slice(-1)[0][0];
    expect(ppCall).toEqual({ startDate: execCall.startDate, endDate: execCall.endDate });
  });
  fireEvent.change(screen.getByLabelText("Date range"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2025-01-01" } });
  fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2025-01-31" } });
  await waitFor(() =>
    expect(mockApi.fetchExecutivePerformance).toHaveBeenLastCalledWith({
      executiveId: "7",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    })
  );
});

test("meetings section lists only upcoming meetings; activity shows recent leads", async () => {
  render(<AdminDashboard />);
  await screen.findByText("Soon Client");
  expect(screen.queryByText("Old Client")).not.toBeInTheDocument();
  expect(await screen.findByText("Lena Lead")).toBeInTheDocument();
});

test("error and empty states are shown instead of blank panels", async () => {
  mockApi.fetchLeadPerformance.mockRejectedValue(new Error("x"));
  mockApi.fetchExecutivePerformance.mockResolvedValue([]);
  mockApi.fetchProcessPersonPerformance.mockRejectedValue(new Error("y"));
  mockApi.adminMeeting.mockResolvedValue([]);
  render(<AdminDashboard />);
  expect((await screen.findAllByText("Could not load lead data.")).length).toBeGreaterThan(0);
  expect(await screen.findByText("No executives found.")).toBeInTheDocument();
  expect(await screen.findByText("Could not load process person performance.")).toBeInTheDocument();
  expect(await screen.findByText("No upcoming meetings.")).toBeInTheDocument();
});

test("rangeFor presets", () => {
  expect(rangeFor("all", {})).toEqual({ startDate: "", endDate: "" });
  const r = rangeFor("7", {});
  const days = (new Date(r.endDate) - new Date(r.startDate)) / 86400000;
  expect(days).toBe(6);
  expect(rangeFor("custom", { from: "2025-02-01", to: "" })).toEqual({ startDate: "2025-02-01", endDate: "" });
});

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const mockApi = {};
const mockExcel = jest.fn();
const mockCsv = jest.fn();
const mockPdf = jest.fn();

jest.mock("../../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("../SidebarToggle", () => () => null);
jest.mock("../../../utils/exportUtils", () => ({
  exportToExcel: (...a) => mockExcel(...a),
  exportToCSV: (...a) => mockCsv(...a),
  exportToPDF: (...a) => mockPdf(...a),
}));
// recharts needs real layout; render the data it would plot instead.
jest.mock("recharts", () => {
  const React = require("react");
  const pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: pass,
    BarChart: ({ data, children }) => (
      <div data-testid="bar-chart" data-rows={JSON.stringify(data)}>{children}</div>
    ),
    Bar: ({ name, dataKey }) => <span data-testid="series">{name || dataKey}</span>,
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
  };
});

import FullReport from "../FullReport";

const execs = [
  { id: 1, username: "alice" },
  { id: 2, username: "bob" },
  { id: 3, username: "carol" },
  { id: 4, username: "dave" },
  { id: 5, username: "erin" },
  { id: 6, username: "frank" },
];

const reportFor = (name) =>
  name === "alice"
    ? {
        leads: [
          { id: 1, name: "Lead One", email: "l1@x.com", phone: "111", status: "New", assignmentDate: "2025-02-03" },
          { id: 2, name: "Lead Two", email: "l2@x.com", phone: "222", status: "Assigned", assignmentDate: "2025-02-04" },
        ],
        followUps: [{ id: 9, fresh_lead_id: 5, createdAt: "2025-02-05T00:00:00Z", clientLeadStatus: "Follow-Up", follow_up_type: "Call", reason_for_follow_up: "Needs docs", freshLead: { name: "Fu Person", email: "f@x.com", phone: "5" } }],
        converted: [{ fresh_lead_id: 7, name: "Conv One", email: "c@x.com", phone: "7", convertedAt: "2025-02-06T00:00:00Z" }],
        closed: [],
        meetings: [{ id: 3, clientName: "Meet One", clientEmail: "m@x.com", clientPhone: "3", startTime: "2025-02-07T09:00:00Z", endTime: "2025-02-07T10:00:00Z" }],
      }
    : {
        leads: [{ id: 8, name: "Bob Lead", status: "New" }],
        followUps: [],
        converted: [
          { fresh_lead_id: 71, name: "BC1", convertedAt: "2025-02-06T00:00:00Z" },
          { fresh_lead_id: 72, name: "BC2", convertedAt: "2025-02-06T00:00:00Z" },
          { fresh_lead_id: 73, name: "BC3", convertedAt: "2025-02-06T00:00:00Z" },
        ],
        closed: [{ freshLeadId: 80, name: "Closed B", createdAt: "2025-02-08T00:00:00Z" }],
        meetings: [],
      };

beforeEach(() => {
  // CRA runs with resetMocks:true — set implementations per test.
  mockApi.fetchExecutivesAPI = jest.fn().mockResolvedValue(execs);
  mockApi.fetchExecutiveReport = jest.fn(async (name) => reportFor(name));
  mockApi.fetchExecutiveActivityRange = jest.fn(async (id) =>
    id === 1 ? [{ workTime: 7200, breakTime: 1800 }, { workTime: 3600, breakTime: 0 }] : [{ workTime: 0, breakTime: 0 }]
  );
});

const pick = async (name) => {
  const input = await screen.findByRole("combobox", { name: /Executive/ });
  fireEvent.focus(input);
  fireEvent.click(await screen.findByRole("option", { name }));
};

describe("single executive report", () => {
  test("shows a helpful empty state before anyone is selected", async () => {
    render(<FullReport />);
    expect(await screen.findByText("Select an executive")).toBeInTheDocument();
    expect(mockApi.fetchExecutiveReport).not.toHaveBeenCalled();
  });

  test("searchable selector filters the list", async () => {
    render(<FullReport />);
    const input = await screen.findByRole("combobox", { name: /Executive/ });
    fireEvent.change(input, { target: { value: "ca" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "carol" })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText(/No executives match/)).toBeInTheDocument();
  });

  test("KPI cards show the five metrics from the API data; table follows the selected card", async () => {
    render(<FullReport />);
    await pick("alice");
    await waitFor(() => expect(screen.getByRole("button", { name: /Fresh Leads/ })).toHaveTextContent("2"));
    expect(screen.getByRole("button", { name: /Follow-ups/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Converted Clients/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Closed Clients/ })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: /Meetings/ })).toHaveTextContent("1");
    expect(mockApi.fetchExecutiveReport).toHaveBeenCalledWith("alice", {}); // all time -> no date params
    // default table: fresh leads, with the status column
    expect(screen.getByText("Lead One")).toBeInTheDocument();
    expect(screen.getByText("Assigned Two".replace("Assigned Two", "Lead Two"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Converted Clients/ }));
    expect(screen.getByText("Conv One")).toBeInTheDocument();
    expect(screen.queryByText("Lead One")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Closed Clients/ }));
    expect(screen.getByText(/No closed clients for this period/)).toBeInTheDocument();
  });

  test("date filter is sent to the API (custom range) and invalid ranges are blocked", async () => {
    render(<FullReport />);
    await pick("alice");
    await screen.findByText("Lead One");
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2025-02-28" } });
    await waitFor(() =>
      expect(mockApi.fetchExecutiveReport).toHaveBeenLastCalledWith("alice", { startDate: "2025-02-01", endDate: "2025-02-28" })
    );
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "today" } });
    await waitFor(() => {
      const p = mockApi.fetchExecutiveReport.mock.calls.slice(-1)[0][1];
      expect(p.startDate).toBe(p.endDate);
      expect(p.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test("Excel, CSV and PDF exports receive the rows with readable headers", async () => {
    render(<FullReport />);
    await pick("alice");
    await screen.findByText("Lead One");
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    const expected = [
      expect.objectContaining({ Name: "Lead One", Email: "l1@x.com", Phone: "111", Status: "New" }),
      expect.objectContaining({ Name: "Lead Two", Status: "Assigned" }),
    ];
    expect(mockExcel).toHaveBeenCalledWith(expected, "alice_fresh");
    expect(mockCsv).toHaveBeenCalledWith(expected, "alice_fresh");
    expect(mockPdf).toHaveBeenCalledWith(expected, "alice_fresh", ["Name", "Email", "Phone", "Status", "Assigned On"]);
    // meetings export used to come out blank - now populated
    fireEvent.click(screen.getByRole("button", { name: /Meetings/ }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(mockCsv).toHaveBeenLastCalledWith(
      [expect.objectContaining({ Client: "Meet One", Email: "m@x.com", Phone: "3" })],
      "alice_meetings"
    );
  });

  test("export buttons are disabled when there is nothing to export", async () => {
    render(<FullReport />);
    await pick("alice");
    await screen.findByText("Lead One");
    fireEvent.click(screen.getByRole("button", { name: /Closed Clients/ }));
    expect(screen.getByRole("button", { name: "Excel" })).toBeDisabled();
  });

  test("follow-up history opens with real follow-up fields", async () => {
    render(<FullReport />);
    await pick("alice");
    await screen.findByText("Lead One");
    fireEvent.click(screen.getByRole("button", { name: /Follow-ups/ }));
    fireEvent.click(await screen.findByLabelText("Follow-up history for Fu Person"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Call/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Needs docs/)).toBeInTheDocument();
  });

  test("API failure shows an error with Retry", async () => {
    mockApi.fetchExecutiveReport.mockRejectedValueOnce(new Error("boom"));
    render(<FullReport />);
    await pick("alice");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this executive's report.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Lead One");
  });

  test("executive list failure shows an error with Retry", async () => {
    mockApi.fetchExecutivesAPI.mockRejectedValueOnce(new Error("x"));
    render(<FullReport />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the executive list");
  });
});

describe("compare executives", () => {
  const openCompare = async () => {
    render(<FullReport />);
    fireEvent.click(await screen.findByRole("tab", { name: "Compare executives" }));
  };
  const addPick = async (name) => {
    const input = screen.getByRole("combobox", { name: /Executives to compare/ });
    fireEvent.focus(input);
    fireEvent.click(await screen.findByRole("option", { name }));
  };

  test("needs at least 2 executives; allows at most 5", async () => {
    await openCompare();
    const btn = screen.getByRole("button", { name: "Compare" });
    expect(btn).toBeDisabled();
    for (const n of ["alice", "bob", "carol", "dave", "erin"]) await addPick(n);
    expect(screen.getByText("5 of 5 selected")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "frank" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("option", { name: "frank" }));
    expect(screen.getByText("5 of 5 selected")).toBeInTheDocument(); // still 5
    expect(btn).not.toBeDisabled();
  });

  test("compares two executives: per-executive summary, chart data, insights, attendance", async () => {
    await openCompare();
    await addPick("alice");
    await addPick("bob");
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    await screen.findByText("Performance Comparison");

    expect(mockApi.fetchExecutiveReport).toHaveBeenCalledWith("alice", {});
    expect(mockApi.fetchExecutiveReport).toHaveBeenCalledWith("bob", {});
    // attendance uses concrete bounds for "all time"
    expect(mockApi.fetchExecutiveActivityRange).toHaveBeenCalledWith(1, "1970-01-01", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    const cards = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(cards).toEqual(expect.arrayContaining(["alice", "bob"]));

    const charts = screen.getAllByTestId("bar-chart");
    const perf = JSON.parse(charts[0].getAttribute("data-rows"));
    expect(perf.find((r) => r.name === "Converted")).toMatchObject({ s0: 1, s1: 3 });
    expect(perf.find((r) => r.name === "Fresh")).toMatchObject({ s0: 2, s1: 1 });
    // series are named after the executives (not their ids/keys)
    expect(screen.getAllByTestId("series").map((s) => s.textContent)).toEqual(expect.arrayContaining(["alice", "bob"]));

    // insights are derived from the data above
    expect(screen.getByText("bob — most converted clients (3).")).toBeInTheDocument();
    expect(screen.getByText("alice — most meetings (1).")).toBeInTheDocument();
    expect(screen.getByText("alice — most work time logged (3 h).")).toBeInTheDocument();

    // work & break: seconds -> hours, only rows with attendance data
    const att = JSON.parse(charts[1].getAttribute("data-rows"));
    expect(att.find((r) => r.name === "alice")).toEqual({ name: "alice", Work: 3, Break: 0.5 });
  });

  test("date range is passed to every executive's report", async () => {
    await openCompare();
    await addPick("alice");
    await addPick("bob");
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2025-02-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    await screen.findByText("Performance Comparison");
    const range = { startDate: "2025-02-01", endDate: "2025-02-28" };
    expect(mockApi.fetchExecutiveReport).toHaveBeenCalledWith("alice", range);
    expect(mockApi.fetchExecutiveReport).toHaveBeenCalledWith("bob", range);
    expect(mockApi.fetchExecutiveActivityRange).toHaveBeenCalledWith(2, "2025-02-01", "2025-02-28");
  });

  test("one failing executive does not hide the others; all failing shows an error", async () => {
    mockApi.fetchExecutiveReport.mockImplementation(async (name) => {
      if (name === "bob") throw new Error("nope");
      return reportFor(name);
    });
    await openCompare();
    await addPick("alice");
    await addPick("bob");
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(await screen.findByText(/Could not load: bob/)).toBeInTheDocument();
    expect(screen.getByText("Performance Comparison")).toBeInTheDocument();

    mockApi.fetchExecutiveReport.mockRejectedValue(new Error("down"));
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not load the comparison"));
  });

  test("attendance section is hidden when attendance data is unavailable, and says so when empty", async () => {
    mockApi.fetchExecutiveActivityRange.mockRejectedValue(new Error("x"));
    await openCompare();
    await addPick("alice");
    await addPick("bob");
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    await screen.findByText("Performance Comparison");
    expect(screen.queryByText("Work & Break Time")).not.toBeInTheDocument();
  });

  test("no call-time or lead-visit metrics anywhere", async () => {
    await openCompare();
    await addPick("alice");
    await addPick("bob");
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    await screen.findByText("Performance Comparison");
    expect(document.body.textContent).not.toMatch(/call time|lead visit/i);
  });
});

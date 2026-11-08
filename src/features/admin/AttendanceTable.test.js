import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import AttendanceTable from "./AttendanceTable";
import * as api from "../../services/attendanceService";
import { monthBounds, rangeToMonth, formatDayHeader, validateFilterRange, validateCorrection, canCorrect, canProcessPayroll } from "./attendanceUtils";

jest.mock("./SidebarToggle", () => () => null);
jest.mock("../../services/attendanceService");

const report = (over = {}) => ({
  range: { startDate: "2026-11-02", endDate: "2026-11-04" },
  today: "2026-11-04",
  weeklyOffDays: [0],
  days: [
    { date: "2026-11-01", weekday: "Sun", isWeeklyOff: true, holiday: null },
    { date: "2026-11-02", weekday: "Mon", isWeeklyOff: false, holiday: null },
    { date: "2026-11-03", weekday: "Tue", isWeeklyOff: false, holiday: "Diwali" },
  ],
  cards: { totalEmployees: 2, presentToday: 1, absentToday: 0, onLeave: 1, attendancePercentage: 75 },
  employees: [
    {
      key: "Executive:2", employeeType: "Executive", employeeId: 2, name: "Eve Ex",
      attendance: { "2026-11-01": "WeeklyOff", "2026-11-02": "Present", "2026-11-03": "Holiday" },
      corrections: { "2026-11-02": { reason: "fix" } },
      summary: { present: 1, absent: 0, leave: 0, holiday: 1, weeklyOff: 1, workingDays: 1, attendancePercentage: 100 },
    },
    {
      key: "ProcessPerson:7", employeeType: "ProcessPerson", employeeId: 7, name: "Priya Process",
      attendance: { "2026-11-01": "WeeklyOff", "2026-11-02": "Leave", "2026-11-03": "Holiday" },
      corrections: {},
      summary: { present: 0, absent: 0, leave: 1, holiday: 1, weeklyOff: 1, workingDays: 1, attendancePercentage: 0 },
    },
  ],
  ...over,
});

const setRole = (role) => localStorage.setItem("user", JSON.stringify({ id: 1, role }));

beforeEach(() => {
  jest.resetAllMocks();
  api.fetchAttendanceReport.mockResolvedValue(report());
  api.fetchAttendanceAudit.mockResolvedValue({ audit: [] });
  setRole("Admin");
});

describe("attendanceUtils", () => {
  test("month helpers", () => {
    expect(monthBounds("2026-02")).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    expect(rangeToMonth("2026-11-01", "2026-11-30")).toBe("2026-11");
    expect(rangeToMonth("2026-11-02", "2026-11-30")).toBe("");
  });
  test("date header shows real date and weekday", () => {
    expect(formatDayHeader("2026-11-08")).toEqual({ day: "08 Nov", weekday: "Sun" });
  });
  test("range + correction validation", () => {
    expect(validateFilterRange("2026-11-10", "2026-11-01")).toMatch(/must not be after/);
    expect(validateFilterRange("2024-01-01", "2026-01-01")).toMatch(/366/);
    expect(validateFilterRange("2026-11-01", "2026-11-30")).toBeNull();
    expect(validateCorrection({ status: "Present", reason: "abc", date: "2026-11-01", today: "2026-11-04" })).toMatch(/reason/);
    expect(validateCorrection({ status: "Present", reason: "valid reason", date: "2026-11-09", today: "2026-11-04" })).toMatch(/future/);
    expect(validateCorrection({ status: "Present", reason: "valid reason", date: "2026-11-03", today: "2026-11-04" })).toBeNull();
  });
  test("role gates", () => {
    expect(canCorrect("Admin")).toBe(true);
    expect(canCorrect("HR")).toBe(false);
    expect(canProcessPayroll("HR")).toBe(true);
    expect(canProcessPayroll("Manager")).toBe(false);
  });
});

describe("AttendanceTable", () => {
  test("renders summary cards, identified employees, dated headers, badges and legend", async () => {
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    expect(screen.getByText("Total Employees")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/ID 2 · Executive/)).toBeInTheDocument();
    expect(screen.getByText(/ID 7 · Process Person/)).toBeInTheDocument();
    expect(screen.getByText("01 Nov")).toBeInTheDocument();
    expect(screen.getAllByText("Sun").length).toBeGreaterThan(0);
    const legend = screen.getByLabelText("Legend");
    ["Present", "Absent", "Leave", "Holiday", "Off", "N/A"].forEach((t) => expect(within(legend).getByText(t)).toBeInTheDocument());
    expect(api.fetchAttendanceReport).toHaveBeenCalledWith(expect.objectContaining({ roles: null }));
  });

  test("role filter and search are sent to the API", async () => {
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "ProcessPerson" } });
    await waitFor(() => expect(api.fetchAttendanceReport).toHaveBeenLastCalledWith(expect.objectContaining({ roles: ["ProcessPerson"] })));
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: "priya" } });
    await waitFor(() => expect(api.fetchAttendanceReport).toHaveBeenLastCalledWith(expect.objectContaining({ search: "priya" })));
  });

  test("month selection sets the full month range", async () => {
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-02" } });
    await waitFor(() =>
      expect(api.fetchAttendanceReport).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-02-01", endDate: "2026-02-28" }))
    );
  });

  test("custom date range is sent to the API", async () => {
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-12-20" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-10" } });
    await waitFor(() =>
      expect(api.fetchAttendanceReport).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-12-10", endDate: "2026-12-20" }))
    );
  });

  test("empty and error states", async () => {
    api.fetchAttendanceReport.mockResolvedValueOnce(
      report({ employees: [], cards: { totalEmployees: 0, presentToday: 0, absentToday: 0, onLeave: 0, attendancePercentage: 0 } })
    );
    const { unmount } = render(<AttendanceTable />);
    await screen.findByText("No employees match the selected filters.");
    unmount();
    api.fetchAttendanceReport.mockRejectedValueOnce({ message: "Insufficient permissions." });
    render(<AttendanceTable />);
    await screen.findByText("Insufficient permissions.");
  });

  test("admin can correct a day; reason is required and saved with the API", async () => {
    api.correctAttendance.mockResolvedValue({ message: "Attendance corrected to Absent" });
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    fireEvent.click(screen.getAllByTitle("Click to correct")[1]); // Eve, 02 Nov
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New status"), { target: { value: "Absent" } });
    fireEvent.click(within(dialog).getByText("Save correction"));
    await within(dialog).findByText(/reason of at least 5/);
    expect(api.correctAttendance).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Was on site visit" } });
    fireEvent.click(within(dialog).getByText("Save correction"));
    await waitFor(() =>
      expect(api.correctAttendance).toHaveBeenCalledWith({ employeeType: "Executive", employeeId: 2, date: "2026-11-02", status: "Absent", reason: "Was on site visit" })
    );
    await screen.findByText("Attendance corrected to Absent");
  });

  test("non-admin cannot edit cells and sees no holiday management", async () => {
    setRole("Manager");
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    expect(screen.queryByTitle("Click to correct")).toBeNull();
    expect(screen.queryByText("Manage holidays")).toBeNull();
    expect(screen.queryByText("Process Payroll")).toBeNull();
  });

  test("payroll: confirmation, duplicate warning then explicit reprocess", async () => {
    api.processPayroll
      .mockRejectedValueOnce({ message: "Payroll already processed", code: "PAYROLL_ALREADY_PROCESSED" })
      .mockResolvedValueOnce({ message: "Payroll updated successfully for executive", payroll: {} });
    render(<AttendanceTable />);
    await screen.findByText("Eve Ex");
    fireEvent.click(screen.getByText("Process Payroll"));
    // Process Person has no payroll endpoint -> not listed in payroll view
    await waitFor(() => expect(screen.queryByText("Priya Process")).toBeNull());
    fireEvent.click(await screen.findByText("Process payroll"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirm & process")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Gross salary"), { target: { value: "30000" } });
    fireEvent.click(within(dialog).getByText("Confirm & process"));
    await within(dialog).findByText(/Reprocess/);
    expect(api.processPayroll).toHaveBeenCalledTimes(1);
    expect(api.processPayroll.mock.calls[0][1]).not.toHaveProperty("reprocess");
    fireEvent.click(within(dialog).getByText(/Reprocess/, { selector: "button" }));
    await screen.findByText("Payroll updated successfully for executive");
    expect(api.processPayroll.mock.calls[1][1]).toMatchObject({ reprocess: true, gross_salary: 30000, user_id: 2 });
  });
});

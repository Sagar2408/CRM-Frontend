import React from "react";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";

jest.mock("../admin/SidebarToggle", () => () => null);
// Chart internals are exercised by recharts itself; here only that real numbers reach the page.
jest.mock("recharts", () => {
  const Box = ({ children }) => <div data-testid="chart">{children}</div>;
  return new Proxy({}, { get: () => Box });
});
jest.mock("../../services/hrService", () => {
  const actual = jest.requireActual("../../services/hrService");
  return {
    ...actual,
    getHrDashboard: jest.fn(),
    leaveApi: { types: jest.fn(), requests: jest.fn(), request: jest.fn(), decide: jest.fn(), cancel: jest.fn(), balanceOverview: jest.fn(), allocate: jest.fn(), adjust: jest.fn(), history: jest.fn(), createType: jest.fn(), updateType: jest.fn(), apply: jest.fn(), mine: jest.fn(), myBalances: jest.fn() },
    payrollApi: { overview: jest.fn(), saveSalary: jest.fn(), salaryHistory: jest.fn(), process: jest.fn(), exportCsv: jest.fn() },
    hrProfileApi: { get: jest.fn(), update: jest.fn(), changePassword: jest.fn(), getPhoto: jest.fn(), uploadPhoto: jest.fn(), deletePhoto: jest.fn() },
  };
});

import * as svc from "../../services/hrService";
import HrDashboard from "./HrDashboard";
import PayrollSystem from "./PayrollSystem";
import LeaveManagement from "./LeaveManagement";
import MyLeave, { validateLeaveForm } from "./MyLeave";
import HrSettings, { validatePassword, validateProfile } from "./HrSettings";

const dash = (over = {}) => ({
  today: "2026-11-13",
  employees: { total: 7, active: 6, inactive: 1, byRole: [{ role: "HR", label: "HR", total: 2, active: 2, inactive: 0 }, { role: "Executive", label: "Executive", total: 5, active: 4, inactive: 1 }] },
  attendance: { date: "2026-11-13", totalEmployees: 7, today: { present: 4, absent: 1, onLeave: 1, notMarkedYet: 1, holidayOrOff: 0 }, attendancePercentage: 82, trend: [{ date: "2026-11-13", weekday: "Fri", present: 4, absent: 1, onLeave: 1 }] },
  leave: { pending: 3, onLeaveToday: 1, latestPending: [{ id: 9, fullName: "Eve P", role: "Executive", leaveType: "Casual Leave", startDate: "2026-11-16", endDate: "2026-11-17", workingDays: 2 }] },
  payroll: { month: "2026-11", employees: 7, processed: 5, pending: 2, noSalary: 0, totalGross: 100000, totalDeductions: 5000, totalNet: 95000, trend: [{ month: "2026-10", gross: 90000, deductions: 4000, net: 86000, employees: 5 }] },
  activities: [{ type: "leave", at: "2026-11-12T10:00:00Z", text: "Eve P applied for Casual Leave" }],
  restricted: { attendance: false, leave: false, payroll: false },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HrDashboard", () => {
  test("renders the real figures returned by the API", async () => {
    svc.getHrDashboard.mockResolvedValue(dash());
    render(<HrDashboard />);
    expect(await screen.findByTestId("stat-total")).toHaveTextContent("7");
    expect(screen.getByTestId("stat-active")).toHaveTextContent("6");
    expect(screen.getByTestId("stat-inactive")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-present")).toHaveTextContent("4");
    expect(screen.getByTestId("stat-absent")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-pending-leave")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-pay-net")).toHaveTextContent("95,000");
    expect(screen.getByText(/Eve P applied for Casual Leave/)).toBeInTheDocument();
    expect(screen.getByText(/5 total · 4 active · 1 inactive/)).toBeInTheDocument();
  });

  test("sections the Admin has not enabled show a notice instead of numbers", async () => {
    svc.getHrDashboard.mockResolvedValue(dash({ attendance: null, leave: null, payroll: null, restricted: { attendance: true, leave: true, payroll: true } }));
    render(<HrDashboard />);
    await screen.findByTestId("stat-total");
    expect(screen.getAllByRole("note").map((n) => n.textContent).join(" ")).toMatch(/Attendance is not enabled/);
    expect(screen.getByText(/Payroll is not enabled/)).toBeInTheDocument();
    expect(screen.queryByTestId("stat-present")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stat-pay-net")).not.toBeInTheDocument();
  });

  test("shows an error with retry, then recovers", async () => {
    svc.getHrDashboard.mockRejectedValueOnce({ response: { data: { message: "Failed to load dashboard" } } }).mockResolvedValueOnce(dash());
    render(<HrDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load dashboard");
    fireEvent.click(screen.getByText("Retry"));
    expect(await screen.findByTestId("stat-total")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
const payRow = (over = {}) => ({ employeeType: "Executive", employeeId: 2, name: "Eve P", email: "e@a.com", designation: "Executive", grossSalary: 26000, salaryEffectiveFrom: "2026-01-01", payroll: null, status: "pending", ...over });
const payOverview = (employees, summary = {}) => ({ month: "2026-11", summary: { employees: employees.length, processed: 0, pending: employees.length, noSalary: 0, totalGross: 0, totalDeductions: 0, totalNet: 0, ...summary }, total: employees.length, page: 1, limit: 10, employees });

describe("PayrollSystem", () => {
  test("lists employees with salary, attendance, deductions and net from the API; filters call the API", async () => {
    svc.payrollApi.overview.mockResolvedValue(payOverview([
      payRow({ status: "processed", payroll: { id: 1, grossSalary: 26000, presentDays: 20, workingDays: 27, deductions: 6000, netSalary: 20000 } }),
      payRow({ employeeId: 3, name: "Tia L", employeeType: "TL", grossSalary: null, status: "no-salary" }),
    ], { processed: 1, pending: 0, noSalary: 1, totalGross: 26000, totalDeductions: 6000, totalNet: 20000 }));
    render(<PayrollSystem />);
    const row = (await screen.findByText("Eve P")).closest("tr");
    expect(within(row).getByText("20 / 27")).toBeInTheDocument();
    expect(within(row).getByText("₹6,000")).toBeInTheDocument();
    expect(within(row).getByText("₹20,000")).toBeInTheDocument();
    expect(within(row).getByText("Processed")).toBeInTheDocument();
    expect(within(screen.getByText("Tia L").closest("tr")).getByText("Set salary")).toBeInTheDocument();
    expect(screen.getByTestId("pay-net")).toHaveTextContent("20,000");

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "pending" } });
    await waitFor(() => expect(svc.payrollApi.overview).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending", page: 1 })));
  });

  test("processing asks for confirmation, never reprocesses by default, and reports skipped employees", async () => {
    svc.payrollApi.overview.mockResolvedValue(payOverview([payRow()]));
    svc.payrollApi.process.mockResolvedValue({ month: "2026-11", created: 1, updated: 0, skipped: 1, failed: 0, details: [{ employeeType: "Manager", employeeId: 1, name: "Mia M", outcome: "skipped", reason: "No salary on record" }] });
    render(<PayrollSystem />);
    await screen.findByText("Eve P");
    fireEvent.click(screen.getByRole("button", { name: /^Process 20\d\d-\d\d$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/skipped, so nothing is duplicated/);
    expect(svc.payrollApi.process).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Process" }));
    await waitFor(() => expect(svc.payrollApi.process).toHaveBeenCalledWith(expect.objectContaining({ reprocess: false })));
    expect(await screen.findByText(/1 created, 0 updated, 1 skipped, 0 failed/)).toBeInTheDocument();
    expect(screen.getByText(/Mia M — No salary on record/)).toBeInTheDocument();
  });

  test("reprocessing is a separate, explicitly confirmed (destructive) action", async () => {
    svc.payrollApi.overview.mockResolvedValue(payOverview([payRow({ status: "processed", payroll: { id: 1, grossSalary: 26000, presentDays: 1, workingDays: 2, deductions: 1, netSalary: 2 } })], { processed: 1, pending: 0 }));
    svc.payrollApi.process.mockResolvedValue({ created: 0, updated: 1, skipped: 0, failed: 0, details: [] });
    render(<PayrollSystem />);
    await screen.findByText("Eve P");
    fireEvent.click(screen.getByText(/Reprocess already-processed payroll/));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/OVERWRITES/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite" }));
    await waitFor(() => expect(svc.payrollApi.process).toHaveBeenCalledWith(expect.objectContaining({ reprocess: true })));
  });

  test("salary form validates, then saves a new history entry", async () => {
    svc.payrollApi.overview.mockResolvedValue(payOverview([payRow({ grossSalary: null, status: "no-salary" })]));
    svc.payrollApi.salaryHistory.mockResolvedValue({ history: [], payrolls: [] });
    svc.payrollApi.saveSalary.mockResolvedValue({});
    render(<PayrollSystem />);
    fireEvent.click(await screen.findByText("Set salary"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save salary" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/greater than zero/);
    expect(svc.payrollApi.saveSalary).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Monthly gross salary"), { target: { value: "31000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save salary" }));
    await waitFor(() => expect(svc.payrollApi.saveSalary).toHaveBeenCalledWith(expect.objectContaining({ employeeType: "Executive", employeeId: 2, grossSalary: 31000 })));
  });

  test("shows server errors (e.g. missing permission) instead of crashing", async () => {
    svc.payrollApi.overview.mockRejectedValue({ response: { data: { message: "Insufficient permissions." } } });
    render(<PayrollSystem />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions.");
  });
});

// ---------------------------------------------------------------------------
const leaveReq = (over = {}) => ({ id: 1, employeeId: 2, employeeType: "Executive", fullName: "Eve P", role: "Executive", leaveType: "Casual Leave", startDate: "2026-11-16", endDate: "2026-11-17", workingDays: 2, totalDays: 2, reason: "Family", status: "Pending", isOwn: false, ...over });

describe("LeaveManagement", () => {
  beforeEach(() => {
    svc.leaveApi.types.mockResolvedValue([{ id: 1, name: "Casual Leave", code: "CL", isPaid: false, requiresBalance: true, active: true }]);
  });

  test("approves another employee's request after confirmation", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [leaveReq()], total: 1, counts: { Pending: 1 } });
    svc.leaveApi.decide.mockResolvedValue({});
    render(<LeaveManagement />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Attendance will show Leave/);
    fireEvent.change(within(dialog).getByLabelText("Comment"), { target: { value: "ok" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(svc.leaveApi.decide).toHaveBeenCalledWith(1, "Approved", "ok"));
  });

  test("HR's OWN request offers no approve/reject", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [leaveReq({ id: 5, isOwn: true, fullName: "Hal HR" })], total: 1, counts: {} });
    render(<LeaveManagement />);
    await screen.findByText("Hal HR");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByText(/needs another approver/)).toBeInTheDocument();
  });

  test("revoking an approved leave requires a reason", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [leaveReq({ status: "Approved" })], total: 1, counts: {} });
    svc.leaveApi.cancel.mockResolvedValue({});
    render(<LeaveManagement />);
    fireEvent.click(await screen.findByText("Revoke"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/reason is required/);
    expect(svc.leaveApi.cancel).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Comment"), { target: { value: "Deadline" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(svc.leaveApi.cancel).toHaveBeenCalledWith(1, "Deadline"));
  });

  test("a failed decision surfaces the server message", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [leaveReq()], total: 1, counts: {} });
    svc.leaveApi.decide.mockRejectedValue({ response: { data: { message: "Insufficient Casual Leave balance" } } });
    render(<LeaveManagement />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Insufficient Casual Leave balance");
  });

  test("balances tab: allocate validates and posts a manual allocation", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [], total: 0, counts: {} });
    svc.leaveApi.balanceOverview.mockResolvedValue({ year: 2026, total: 1, employees: [{ employeeType: "Executive", employeeId: 2, name: "Eve P", balances: [{ leaveTypeId: 1, remaining: 3, allocated: 5 }] }] });
    svc.leaveApi.allocate.mockResolvedValue({});
    render(<LeaveManagement />);
    fireEvent.click(await screen.findByRole("tab", { name: "Balances" }));
    expect(await screen.findByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText(/no carry forward/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Allocate / adjust"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Choose a leave type/);
    fireEvent.change(within(dialog).getByLabelText("Leave type"), { target: { value: "1" } });
    fireEvent.change(within(dialog).getByLabelText("Days"), { target: { value: "-2" } });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Annual grant" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/allocation must be positive/i);
    fireEvent.change(within(dialog).getByLabelText("Days"), { target: { value: "2.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(svc.leaveApi.allocate).toHaveBeenCalledWith(expect.objectContaining({ employeeType: "Executive", employeeId: 2, leaveTypeId: 1, days: 2.5, reason: "Annual grant" })));
  });

  test("leave types tab: creates a type", async () => {
    svc.leaveApi.requests.mockResolvedValue({ requests: [], total: 0, counts: {} });
    svc.leaveApi.createType.mockResolvedValue({});
    render(<LeaveManagement />);
    fireEvent.click(await screen.findByRole("tab", { name: "Leave types" }));
    fireEvent.click(await screen.findByText("+ New leave type"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Casual Leave"), { target: { value: "Sick Leave" } });
    fireEvent.change(within(dialog).getByPlaceholderText("CL"), { target: { value: "SL" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(svc.leaveApi.createType).toHaveBeenCalledWith(expect.objectContaining({ name: "Sick Leave", code: "SL", isPaid: false, requiresBalance: true })));
  });
});

describe("MyLeave", () => {
  test("validateLeaveForm", () => {
    expect(validateLeaveForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" }, "2026-11-13")).toMatchObject({ leaveTypeId: expect.any(String), startDate: expect.any(String), endDate: expect.any(String), reason: expect.any(String) });
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-11-20", endDate: "2026-11-19", reason: "family" }, "2026-11-13").endDate).toMatch(/before the start/);
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-11-01", endDate: "2026-11-02", reason: "family" }, "2026-11-13").startDate).toMatch(/past/);
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-11-20", endDate: "2026-11-21", reason: "family" }, "2026-11-13")).toEqual({});
  });

  test("shows balances and requests, applies for leave and surfaces a server rejection", async () => {
    svc.leaveApi.types.mockResolvedValue([{ id: 1, name: "Casual Leave", code: "CL", active: true }]);
    svc.leaveApi.myBalances.mockResolvedValue({ year: 2026, balances: [{ leaveTypeId: 1, name: "Casual Leave", code: "CL", allocated: 5, used: 1, pending: 0, remaining: 4, available: 4, requiresBalance: true }] });
    svc.leaveApi.mine.mockResolvedValue([{ id: 1, leaveType: "Casual Leave", startDate: "2026-12-01", endDate: "2026-12-02", workingDays: 2, status: "Approved", hrComment: "Enjoy" }]);
    svc.leaveApi.apply.mockRejectedValueOnce({ response: { data: { message: "Insufficient Casual Leave balance" } } }).mockResolvedValueOnce({});
    render(<MyLeave />);
    expect(await screen.findByTestId("balance-CL")).toHaveTextContent("4");
    expect(screen.getByText("Enjoy")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply for leave" }));
    const dialog = await screen.findByRole("dialog");
    const future = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    fireEvent.change(within(dialog).getByLabelText("Leave type", { exact: false }), { target: { name: "leaveTypeId", value: "1" } });
    fireEvent.change(within(dialog).getByLabelText("From"), { target: { name: "startDate", value: future(10) } });
    fireEvent.change(within(dialog).getByLabelText("To"), { target: { name: "endDate", value: future(11) } });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { name: "reason", value: "Family function" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Insufficient Casual Leave balance");
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(svc.leaveApi.apply).toHaveBeenCalledTimes(2));
    expect(svc.leaveApi.apply).toHaveBeenLastCalledWith(expect.objectContaining({ leaveTypeId: 1, reason: "Family function" }));
    expect(await screen.findByText(/Leave request submitted/)).toBeInTheDocument();
  });

  test("an employee with no allocation sees why they cannot apply", async () => {
    svc.leaveApi.types.mockResolvedValue([]);
    svc.leaveApi.myBalances.mockResolvedValue({ year: 2026, balances: [] });
    svc.leaveApi.mine.mockResolvedValue([]);
    render(<MyLeave />);
    expect(await screen.findByText(/HR has not allocated any leave to you/)).toBeInTheDocument();
    expect(screen.getByText(/have not applied for any leave yet/)).toBeInTheDocument();
  });
});

describe("HrSettings", () => {
  test("validators", () => {
    expect(validateProfile({ name: "", username: "", email: "nope" })).toMatchObject({ name: expect.any(String), username: expect.any(String), email: expect.any(String) });
    expect(validateProfile({ name: "Hal", username: "hal", email: "h@a.com" })).toEqual({});
    expect(validatePassword({ currentPassword: "", newPassword: "123", confirm: "x" })).toMatchObject({ currentPassword: expect.any(String), newPassword: expect.any(String), confirm: expect.any(String) });
    expect(validatePassword({ currentPassword: "oldpass", newPassword: "oldpass", confirm: "oldpass" }).newPassword).toMatch(/different/);
    expect(validatePassword({ currentPassword: "oldpass", newPassword: "newpass1", confirm: "newpass1" })).toEqual({});
  });

  test("profile + password only (no Admin-only tabs); password change sends the current password", async () => {
    svc.hrProfileApi.get.mockResolvedValue({ id: 1, name: "Hal HR", username: "hal", email: "h@a.com", role: "HR", jobTitle: "Lead" });
    svc.hrProfileApi.getPhoto.mockRejectedValue({ response: { status: 404 } });
    svc.hrProfileApi.changePassword.mockResolvedValue({});
    render(<HrSettings />);
    expect(await screen.findByDisplayValue("Hal HR")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Profile", "Password"]);
    expect(screen.queryByText(/Page Access/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { name: "currentPassword", value: "oldpass1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { name: "newPassword", value: "newpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { name: "confirm", value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(svc.hrProfileApi.changePassword).not.toHaveBeenCalled();
    // the field's label now also contains its inline error text
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { name: "confirm", value: "newpass1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    });
    await waitFor(() => expect(svc.hrProfileApi.changePassword).toHaveBeenCalledWith("oldpass1", "newpass1"));
  });

  test("a wrong current password is reported by the server", async () => {
    svc.hrProfileApi.get.mockResolvedValue({ id: 1, name: "Hal HR", username: "hal", email: "h@a.com", role: "HR" });
    svc.hrProfileApi.getPhoto.mockRejectedValue({ response: { status: 404 } });
    svc.hrProfileApi.changePassword.mockRejectedValue({ response: { data: { message: "Current password is incorrect." } } });
    render(<HrSettings />);
    await screen.findByDisplayValue("Hal HR");
    fireEvent.click(screen.getByRole("tab", { name: "Password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { name: "currentPassword", value: "wrongpw" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { name: "newPassword", value: "newpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { name: "confirm", value: "newpass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
  });
});

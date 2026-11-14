import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
  NavLink: ({ to, className, children }) => <a href={to} className={typeof className === "function" ? className({ isActive: false }) : className}>{children}</a>,
  Outlet: () => <div>content</div>,
  Routes: ({ children }) => <>{children}</>,
  Route: () => null,
  Navigate: () => null,
}));
jest.mock("../../layouts/ExecutiveLayout", () => () => null);
jest.mock("../admin/ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});
const mockApi = {
  fetchSettings: jest.fn(),
  updateSettings: jest.fn(),
  userSettings: null,
  uploadFileAPI: jest.fn(),
};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("../../context/LoadingContext", () => ({ useLoading: () => ({ isLoading: false, loadingText: "" }) }));
jest.mock("../admin-settings/RequirePermission", () => ({ children }) => <>{children}</>);
jest.mock("../executive/ProfileAvatar", () => ({
  __esModule: true,
  default: ({ initial }) => <span data-testid="avatar">{initial}</span>,
  useOwnPhotoUrl: () => null,
}));
jest.mock("./SoundGenerator", () => ({
  SoundGenerator: function () { this.close = jest.fn(); },
  soundOptions: [
    { id: "beep1", name: "Classic Beep", generator: jest.fn() },
    { id: "beep2", name: "Soft Chime", generator: jest.fn() },
  ],
}));
jest.mock("../../services/hrService", () => ({
  leaveApi: { myBalances: jest.fn(), mine: jest.fn(), preview: jest.fn(), apply: jest.fn(), cancel: jest.fn() },
}));

import { ThemeContext } from "../admin/ThemeContext";
import { leaveApi } from "../../services/hrService";
import { soundOptions } from "./SoundGenerator";
import SettingsLayout, { settingsMenuItems } from "./SettingLayout";
import MyProfile from "./MyProfile";
import BeepSound from "./BeepSound";
import EmployeeLeave, { validateLeaveForm } from "./EmployeeLeave";
import SettingsRouteWrapper from "../../routes/SettingsRouteWrapper";
import { BeepSettingsProvider, BEEP_DEFAULTS, loadBeepSettings, sanitizeBeepSettings } from "../../context/BeepSettingsContext";

const USER = { id: 7, username: "eve", email: "eve@acme.com", role: "Executive", firstname: "Eve", lastname: "Adams", city: "Pune", state: "MH", country: "IN", postal_code: "411001", tax_id: "", createdAt: "2026-01-05T00:00:00Z", profile_picture: null };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("user", JSON.stringify({ id: 7, username: "eve", role: "Executive" }));
  mockApi.userSettings = { user: USER };
  mockApi.fetchSettings.mockResolvedValue();
  mockApi.updateSettings.mockResolvedValue({ user: USER });
});

const routePaths = (node, out = []) => {
  React.Children.forEach(node?.props?.children, (c) => {
    if (c && c.props) {
      out.push(c.props.path ?? (c.props.index ? "(index)" : null));
      routePaths(c, out);
    }
  });
  return out;
};

describe("settings layout", () => {
  test("lists only Profile, Theme, Beep and Leave - no Change Password or Email Template", () => {
    expect(settingsMenuItems.map((i) => i.label)).toEqual(["My Profile", "Theme", "Change in Beep", "Ask for Leave"]);
    render(<SettingsLayout />);
    const nav = screen.getByRole("navigation", { name: /settings sections/i });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByText(/change password/i)).toBeNull();
    expect(screen.queryByText(/email template/i)).toBeNull();
  });

  test("the removed routes are gone and old URLs fall back to the profile page", () => {
    const paths = routePaths(SettingsRouteWrapper());
    expect(paths).toEqual(expect.arrayContaining(["profile", "theme", "change-beep", "leave", "*"]));
    expect(paths).not.toContain("change-password");
    expect(paths).not.toContain("create-template");
  });
});

describe("My Profile", () => {
  test("shows the real authenticated user, not hardcoded values", async () => {
    render(<MyProfile />);
    expect(await screen.findByRole("heading", { name: "Eve Adams" })).toBeInTheDocument();
    expect(screen.getByText("eve@acme.com")).toBeInTheDocument();
    expect(screen.getByText("@eve")).toBeInTheDocument();
    expect(screen.getAllByText("Executive").length).toBeGreaterThan(0);
    expect(screen.getByText("7")).toBeInTheDocument(); // employee id
    expect(screen.getByText("Pune, MH, IN")).toBeInTheDocument();
    expect(mockApi.fetchSettings).toHaveBeenCalled();
  });

  test("only personal fields are editable and saved; identity fields are never sent", async () => {
    render(<MyProfile />);
    fireEvent.click(await screen.findByRole("button", { name: /edit personal information/i }));
    expect(screen.queryByLabelText(/username/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Evelyn" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mockApi.updateSettings).toHaveBeenCalled());
    const sent = mockApi.updateSettings.mock.calls[0][0];
    expect(sent.firstname).toBe("Evelyn");
    expect(Object.keys(sent).sort()).toEqual(["city", "country", "firstname", "lastname", "postal_code", "state", "tax_id"]);
    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
  });

  test("requires a first name and surfaces server errors", async () => {
    render(<MyProfile />);
    fireEvent.click(await screen.findByRole("button", { name: /edit personal information/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(mockApi.updateSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Eve" } });
    mockApi.updateSettings.mockRejectedValue({ response: { data: { message: "city must be at most 100 characters" } } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("city must be at most 100 characters");
  });
});

describe("Change in Beep", () => {
  test("sanitises corrupt values and falls back to defaults", () => {
    expect(sanitizeBeepSettings({ volume: 500, timing: "x", reminderDelay: 1, enabled: "yes" })).toEqual({ ...BEEP_DEFAULTS, volume: 100, reminderDelay: 10 });
    expect(loadBeepSettings()).toEqual(BEEP_DEFAULTS);
  });

  test("changes persist per user and are reloaded", () => {
    const { unmount } = render(<BeepSettingsProvider><BeepSound /></BeepSettingsProvider>);
    fireEvent.click(screen.getByRole("radio", { name: /soft chime/i }));
    fireEvent.click(screen.getByRole("radio", { name: "30 sec" }));
    fireEvent.change(screen.getByLabelText(/volume/i), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText(/reminder delay/i), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    expect(screen.getByText(/sound settings saved/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("beepSoundSettings_7"))).toEqual({ selectedSound: "beep2", volume: 80, timing: 30, enabled: false, reminderDelay: 120 });
    unmount();
    expect(loadBeepSettings()).toMatchObject({ selectedSound: "beep2", timing: 30, enabled: false });
    localStorage.setItem("user", JSON.stringify({ id: 8 }));
    expect(loadBeepSettings()).toEqual(BEEP_DEFAULTS); // another user on the same browser is unaffected
  });

  test("preview plays the sound at the current volume and reset restores defaults", async () => {
    render(<BeepSettingsProvider><BeepSound /></BeepSettingsProvider>);
    fireEvent.change(screen.getByLabelText(/volume/i), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: /preview soft chime/i }));
    await waitFor(() => expect(soundOptions[1].generator).toHaveBeenCalledWith(expect.anything(), 35));
    fireEvent.click(screen.getByRole("button", { name: /reset to default/i }));
    expect(screen.getByLabelText(/volume/i)).toHaveValue("50");
  });
});

describe("Ask for Leave", () => {
  const balances = [
    { leaveTypeId: 1, name: "Casual Leave", code: "CL", active: true, requiresBalance: true, allocated: 5, used: 2, pending: 1, available: 2 },
    { leaveTypeId: 2, name: "Loss of Pay", code: "LOP", active: true, requiresBalance: false, allocated: 0, used: 0, pending: 0, available: 0 },
  ];
  const okPreview = { workingDays: 2, totalDays: 2, weeklyOffs: [], holidays: [], overlap: null, years: [{ year: 2026, requested: 2, available: 2 }], shortfall: 0, exceedsBalance: false, noWorkingDays: false, requiresBalance: true };
  const overPreview = { ...okPreview, workingDays: 4, totalDays: 5, weeklyOffs: ["2026-12-06"], holidays: [{ date: "2026-12-10", name: "Founders Day" }], years: [{ year: 2026, requested: 4, available: 2 }], shortfall: 2, exceedsBalance: true };

  beforeEach(() => {
    leaveApi.myBalances.mockResolvedValue({ year: 2026, balances });
    leaveApi.mine.mockResolvedValue([]);
    leaveApi.apply.mockResolvedValue({ data: { id: 1, exceedsBalance: false } });
  });

  const fill = async (preview) => {
    leaveApi.preview.mockResolvedValue(preview);
    render(<EmployeeLeave />);
    await screen.findByTestId("balance-CL");
    fireEvent.change(screen.getByLabelText(/leave type/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^from/i), { target: { value: "2026-12-07" } });
    fireEvent.change(screen.getByLabelText(/^to/i), { target: { value: "2026-12-08" } });
    fireEvent.change(screen.getByLabelText(/^reason/i), { target: { value: "Family function" } });
    await screen.findByTestId("leave-summary");
  };

  test("shows real balances from the backend", async () => {
    render(<EmployeeLeave />);
    const cl = await screen.findByTestId("balance-CL");
    expect(within(cl).getByText("Casual Leave")).toBeInTheDocument();
    expect(screen.getByTestId("available-CL")).toHaveTextContent("2");
    expect(within(cl).getByText("5")).toBeInTheDocument();
    expect(screen.getByTestId("balance-LOP")).toHaveTextContent(/not limited by a balance/i);
    expect(leaveApi.myBalances).toHaveBeenCalledWith(new Date().getFullYear());
  });

  test("submits the chosen type, dates and reason to the existing apply API", async () => {
    await fill(okPreview);
    expect(screen.getByTestId("leave-summary")).toHaveTextContent("2 working day(s)");
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));
    await waitFor(() => expect(leaveApi.apply).toHaveBeenCalled());
    expect(leaveApi.apply).toHaveBeenCalledWith(expect.objectContaining({ leaveTypeId: 1, startDate: "2026-12-07", endDate: "2026-12-08", reason: "Family function" }));
    expect(leaveApi.apply.mock.calls[0][0].exceptionRequested).toBeUndefined();
    expect(await screen.findByText(/pending HR approval/i)).toBeInTheDocument();
  });

  test("over-balance request needs the exception checkbox and an explanation, then is flagged", async () => {
    await fill(overPreview);
    expect(screen.getByTestId("exceeds-warning")).toHaveTextContent(/exceeds your available Casual Leave balance by 2 day/i);
    expect(screen.getByTestId("leave-summary")).toHaveTextContent(/Founders Day/);
    fireEvent.click(screen.getByRole("button", { name: /submit exception request/i }));
    expect(await screen.findByText(/tick the box/i)).toBeInTheDocument();
    expect(leaveApi.apply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/request an exception/i));
    fireEvent.change(screen.getByLabelText(/explanation for hr/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /submit exception request/i }));
    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(leaveApi.apply).not.toHaveBeenCalled();

    leaveApi.apply.mockResolvedValue({ data: { id: 2, exceedsBalance: true } });
    fireEvent.change(screen.getByLabelText(/explanation for hr/i), { target: { value: "Medical procedure, no leave left" } });
    fireEvent.click(screen.getByRole("button", { name: /submit exception request/i }));
    await waitFor(() => expect(leaveApi.apply).toHaveBeenCalledWith(expect.objectContaining({ exceptionRequested: true, exceptionReason: "Medical procedure, no leave left" })));
    expect(await screen.findByText(/flagged as exceeding your balance/i)).toBeInTheDocument();
  });

  test("overlap blocks submission", async () => {
    await fill({ ...okPreview, overlap: { id: 3, status: "Approved", startDate: "2026-12-07", endDate: "2026-12-09" } });
    expect(await screen.findByText(/already have a approved leave/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit request/i })).toBeDisabled();
  });

  test("history shows status, HR response and the exception flag; pending leave can be cancelled", async () => {
    leaveApi.mine.mockResolvedValue([
      { id: 11, leaveType: "Casual Leave", startDate: "2026-12-07", endDate: "2026-12-09", workingDays: 3, status: "Pending", appliedDate: "2026-11-13", reason: "Wedding", exceedsBalance: true, balanceShortfall: 1, exceptionReason: "No balance left", hrComment: null },
      { id: 12, leaveType: "Casual Leave", startDate: "2026-01-07", endDate: "2026-01-07", workingDays: 1, status: "Rejected", appliedDate: "2026-01-02", reason: "Trip", hrComment: "Peak season" },
    ]);
    leaveApi.cancel.mockResolvedValue({});
    render(<EmployeeLeave />);
    const pending = await screen.findByTestId("leave-row-11");
    expect(pending).toHaveTextContent("Pending");
    expect(pending).toHaveTextContent("Exceeds balance by 1");
    expect(pending).toHaveTextContent("No balance left");
    expect(screen.getByTestId("leave-row-12")).toHaveTextContent("HR: Peak season");
    fireEvent.click(within(pending).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(leaveApi.cancel).toHaveBeenCalledWith(11, expect.any(String)));
  });

  test("validateLeaveForm", () => {
    expect(Object.keys(validateLeaveForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" }, null)).sort()).toEqual(["endDate", "leaveTypeId", "reason", "startDate"]);
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-12-09", endDate: "2026-12-07", reason: "abc" }, null).endDate).toMatch(/before/);
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-12-07", endDate: "2026-12-07", reason: "abc" }, { exceedsBalance: true })).toHaveProperty("exceptionReason");
    expect(validateLeaveForm({ leaveTypeId: "1", startDate: "2026-12-07", endDate: "2026-12-07", reason: "abc", exceptionRequested: true, exceptionReason: "long enough text" }, { exceedsBalance: true })).toEqual({});
  });
});

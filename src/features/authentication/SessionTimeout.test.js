import React from "react";
import { render, screen, act } from "@testing-library/react";
import SessionTimeout from "./SessionTimeout";
import { markActivity, clearActivity } from "../../utils/activityTracker";
import * as executiveService from "../../services/executiveService";

const mockLogout = jest.fn();
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ logout: mockLogout }) }));
jest.mock("../../services/executiveService", () => ({ getInactivitySettings: jest.fn() }));

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("SessionTimeout (automatic inactivity logout)", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-10T09:00:00Z"));
    localStorage.clear();
    clearActivity();
    localStorage.setItem("token", "t");
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "Executive" }));
    mockLogout.mockResolvedValue(undefined);
    executiveService.getInactivitySettings.mockResolvedValue({ enabled: true, minutes: 5 });
  });
  afterEach(() => jest.useRealTimers());

  test("logs the user out with reason 'inactivity' once the tenant limit is reached", async () => {
    render(<SessionTimeout />);
    await flush();
    markActivity(true);
    act(() => jest.advanceTimersByTime(4 * 60 * 1000));
    expect(mockLogout).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(61 * 1000));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledWith({ reason: "inactivity" });
  });

  test("warns during the final minute and activity cancels the warning", async () => {
    render(<SessionTimeout />);
    await flush();
    markActivity(true);
    act(() => jest.advanceTimersByTime(4 * 60 * 1000 + 30 * 1000));
    expect(screen.getByRole("alert")).toHaveTextContent(/logged out for inactivity/);
    act(() => {
      markActivity(true);
      jest.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("a clock jump (sleep / throttled background tab) logs out at the very next check", async () => {
    render(<SessionTimeout />);
    await flush();
    markActivity(true);
    jest.setSystemTime(new Date("2026-06-10T11:00:00Z")); // two hours pass with no timers firing
    act(() => jest.advanceTimersByTime(1000));
    expect(mockLogout).toHaveBeenCalledWith({ reason: "inactivity" });
  });

  test("does nothing when the Admin has switched the feature off", async () => {
    executiveService.getInactivitySettings.mockResolvedValue({ enabled: false, minutes: 5 });
    render(<SessionTimeout />);
    await flush();
    markActivity(true);
    act(() => jest.advanceTimersByTime(60 * 60 * 1000));
    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("does nothing when nobody is signed in", async () => {
    localStorage.removeItem("token");
    render(<SessionTimeout />);
    await flush();
    act(() => jest.advanceTimersByTime(60 * 60 * 1000));
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

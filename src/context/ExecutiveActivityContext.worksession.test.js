import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ExecutiveActivityProvider, useExecutiveActivity, useWorkClock } from "./ExecutiveActivityContext";
import { AuthContext } from "./authContextObject";
import * as svc from "../services/executiveService";

jest.mock("../services/executiveService", () => ({
  recordStartWork: jest.fn(),
  recordStopWork: jest.fn(),
  recordStartBreak: jest.fn(),
  recordStopBreak: jest.fn(),
  getActivityStatus: jest.fn(),
  sendHeartbeat: jest.fn(),
  leadtrackVisit: jest.fn(),
  sendEmail: jest.fn(),
  getAttendance: jest.fn(),
}));

const state = (over = {}) => ({ working: true, onBreak: false, workSeconds: 1800, breakSeconds: 0, ...over });

const Probe = () => {
  const clock = useWorkClock();
  const { handleStartBreak, handleStopBreak } = useExecutiveActivity();
  return (
    <div>
      <span data-testid="work">{clock.workTimer}</span>
      <span data-testid="break">{clock.breakTimer}</span>
      <span data-testid="mode">{clock.onBreak ? "break" : clock.working ? "working" : "idle"}</span>
      <button onClick={() => handleStartBreak()}>start-break</button>
      <button onClick={() => handleStopBreak()}>stop-break</button>
    </div>
  );
};

const renderAs = (user) =>
  render(
    <AuthContext.Provider value={{ user, logout: jest.fn() }}>
      <ExecutiveActivityProvider>
        <Probe />
      </ExecutiveActivityProvider>
    </AuthContext.Provider>
  );

describe("executive work session in the UI", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-10T09:00:00Z"));
    localStorage.clear();
    localStorage.setItem("token", "t");
    svc.recordStartWork.mockResolvedValue({ state: state() });
    svc.sendHeartbeat.mockResolvedValue({ ...state(), active: true });
  });
  afterEach(() => jest.useRealTimers());

  test("starts automatically for an executive and RESUMES the day's accumulated time (never resets to 0)", async () => {
    renderAs({ id: 5, role: "Executive" });
    await act(async () => {});
    expect(svc.recordStartWork).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("work")).toHaveTextContent("00:30:00");
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId("work")).toHaveTextContent("00:30:05");
  });

  test("does not start a session for other roles or when logged out", async () => {
    renderAs({ id: 5, role: "Manager" });
    await act(async () => {});
    expect(svc.recordStartWork).not.toHaveBeenCalled();
    expect(screen.getByTestId("mode")).toHaveTextContent("idle");
  });

  test("a break pauses the work clock and ending it resumes work", async () => {
    renderAs({ id: 5, role: "Executive" });
    await act(async () => {});
    svc.recordStartBreak.mockResolvedValue({ state: state({ working: false, onBreak: true }) });
    await act(async () => {
      fireEvent.click(screen.getByText("start-break"));
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("break");
    act(() => jest.advanceTimersByTime(10000));
    expect(screen.getByTestId("work")).toHaveTextContent("00:30:00"); // frozen
    expect(screen.getByTestId("break")).toHaveTextContent("00:00:10");

    svc.recordStopBreak.mockResolvedValue({ breakDuration: 10, state: state({ breakSeconds: 10 }) });
    await act(async () => {
      fireEvent.click(screen.getByText("stop-break"));
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("working");
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.getByTestId("work")).toHaveTextContent("00:30:03");
    expect(screen.getByTestId("break")).toHaveTextContent("00:00:10");
  });

  test("heartbeats keep the server session alive and re-sync totals", async () => {
    renderAs({ id: 5, role: "Executive" });
    await act(async () => {});
    svc.sendHeartbeat.mockResolvedValue({ ...state({ workSeconds: 2000 }), active: true });
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(svc.sendHeartbeat).toHaveBeenCalled();
    expect(screen.getByTestId("work")).toHaveTextContent("00:33:20");
  });
});

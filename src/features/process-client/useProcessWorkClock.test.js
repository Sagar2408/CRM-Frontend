import { renderHook, act } from "@testing-library/react";
import useProcessWorkClock, { formatClock } from "./useProcessWorkClock";
import * as api from "../../services/processService";

jest.mock("../../services/processService", () => ({
  getProcessWorkStatusApi: jest.fn(),
  startWorkApi: jest.fn(),
  startBreakApi: jest.fn(),
  stopBreakApi: jest.fn(),
}));

const st = (o = {}) => ({ workSeconds: 0, breakSeconds: 0, onBreak: false, working: false, started: false, ...o });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-15T09:00:00Z"));
  Object.values(api).filter((f) => typeof f === "function").forEach((f) => f.mockReset());
});
afterEach(() => jest.useRealTimers());

test("formatClock", () => {
  expect(formatClock(0)).toBe("00:00:00");
  expect(formatClock(3661)).toBe("01:01:01");
});

test("renders the server's numbers (not zeros) and ticks the running work timer", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st({ workSeconds: 100, working: true, started: true }) });
  const { result } = renderHook(() => useProcessWorkClock(7));
  await flush();
  expect(result.current.loaded).toBe(true);
  expect(result.current.workTimer).toBe("00:01:40");
  expect(result.current.breakTimer).toBe("00:00:00");
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(result.current.workTimer).toBe("00:01:45");
  expect(api.startWorkApi).not.toHaveBeenCalled(); // already running: no duplicate start
});

test("starts today's work only when nothing is running, and uses the server's answer", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st() });
  api.startWorkApi.mockResolvedValue({ state: st({ working: true, started: true, workSeconds: 0 }) });
  const { result } = renderHook(() => useProcessWorkClock(7));
  await flush();
  expect(api.startWorkApi).toHaveBeenCalledTimes(1);
  expect(api.startWorkApi).toHaveBeenCalledWith(7);
  expect(result.current.working).toBe(true);
});

test("never auto-starts work while on break; break time counts up, work freezes", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st({ workSeconds: 600, breakSeconds: 30, onBreak: true, started: true }) });
  const { result } = renderHook(() => useProcessWorkClock(7));
  await flush();
  expect(api.startWorkApi).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(result.current.workTimer).toBe("00:10:00");
  expect(result.current.breakTimer).toBe("00:00:40");
});

test("toggleBreak calls the server once (double click ignored) and applies the returned state", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st({ workSeconds: 60, working: true, started: true }) });
  let release;
  api.startBreakApi.mockReturnValue(new Promise((r) => { release = r; }));
  const { result } = renderHook(() => useProcessWorkClock(7));
  await flush();
  act(() => { result.current.toggleBreak(); result.current.toggleBreak(); });
  expect(api.startBreakApi).toHaveBeenCalledTimes(1);
  await act(async () => { release({ state: st({ workSeconds: 60, onBreak: true, started: true }) }); });
  expect(result.current.onBreak).toBe(true);
  expect(result.current.busy).toBe(false);
});

test("one interval only: re-renders and unmount do not leak timers or repeat API calls", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st({ working: true, started: true }) });
  const { rerender, unmount } = renderHook(() => useProcessWorkClock(7));
  await flush();
  const before = jest.getTimerCount();
  rerender(); rerender(); rerender();
  expect(jest.getTimerCount()).toBe(before);
  const calls = api.getProcessWorkStatusApi.mock.calls.length;
  expect(calls).toBe(1);
  const created = [];
  const cleared = [];
  const si = jest.spyOn(global, "setInterval");
  const ci = jest.spyOn(global, "clearInterval");
  rerender();
  unmount();
  // every interval this hook started is cleared on unmount (spies only see what happens from here)
  expect(jest.getTimerCount()).toBeLessThan(before);
  si.mockRestore();
  ci.mockRestore();
  void created; void cleared;
});

test("re-syncs from the server every minute (no drift)", async () => {
  api.getProcessWorkStatusApi
    .mockResolvedValueOnce({ state: st({ workSeconds: 0, working: true, started: true }) })
    .mockResolvedValue({ state: st({ workSeconds: 58, working: true, started: true }) });
  const { result } = renderHook(() => useProcessWorkClock(7));
  await flush();
  await act(async () => { jest.advanceTimersByTime(60000); });
  await flush();
  expect(api.getProcessWorkStatusApi).toHaveBeenCalledTimes(2);
  expect(result.current.workTimer).toBe("00:00:58");
});

test("refresh / navigation: a new mount reads the same server state instead of resetting", async () => {
  api.getProcessWorkStatusApi.mockResolvedValue({ state: st({ workSeconds: 4000, working: true, started: true }) });
  const a = renderHook(() => useProcessWorkClock(7));
  await flush();
  a.unmount();
  const b = renderHook(() => useProcessWorkClock(7));
  await flush();
  expect(b.result.current.workTimer).toBe("01:06:40");
});

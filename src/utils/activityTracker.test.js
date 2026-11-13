import { markActivity, getLastActivity, getIdleSeconds, clearActivity, installActivityListeners, ACTIVITY_STORAGE_KEY } from "./activityTracker";

describe("activityTracker", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-10T09:00:00Z"));
    localStorage.clear();
    clearActivity();
  });
  afterEach(() => jest.useRealTimers());

  test("idle time is measured against an absolute timestamp, so a frozen/throttled timer cannot hide it", () => {
    markActivity(true);
    jest.setSystemTime(new Date("2026-06-10T09:20:00Z")); // e.g. the laptop slept for 20 minutes
    expect(getIdleSeconds()).toBe(20 * 60);
  });

  test("activity in another tab (shared localStorage) counts", () => {
    markActivity(true);
    jest.setSystemTime(new Date("2026-06-10T09:10:00Z"));
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now())); // written by another tab
    expect(getIdleSeconds()).toBe(0);
  });

  test("real user events refresh the timestamp, and listeners are removed when the last consumer leaves", () => {
    const uninstall = installActivityListeners();
    markActivity(true);
    jest.setSystemTime(new Date("2026-06-10T09:05:00Z"));
    expect(getIdleSeconds()).toBe(300);
    window.dispatchEvent(new Event("keydown"));
    expect(getIdleSeconds()).toBe(0);
    uninstall();
    jest.setSystemTime(new Date("2026-06-10T09:06:00Z"));
    window.dispatchEvent(new Event("keydown"));
    expect(getLastActivity()).toBe(new Date("2026-06-10T09:05:00Z").getTime());
  });
});

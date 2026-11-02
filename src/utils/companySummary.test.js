import {
  computeCompanySummary,
  getSubscriptionStatus,
  RECENTLY_ADDED_WINDOW_DAYS,
} from "./companySummary";

const NOW = new Date("2026-10-31T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const daysFromNow = (n) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("computeCompanySummary", () => {
  test("returns all zeros for an empty list", () => {
    expect(computeCompanySummary([], NOW)).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      recentlyAdded: 0,
    });
  });

  test("counts total/active/inactive from the real status field", () => {
    const companies = [
      { status: "active", createdAt: daysAgo(100) },
      { status: "active", createdAt: daysAgo(100) },
      { status: "paused", createdAt: daysAgo(100) },
      { status: "blacklisted", createdAt: daysAgo(100) },
    ];
    expect(computeCompanySummary(companies, NOW)).toEqual({
      total: 4,
      active: 2,
      inactive: 2,
      recentlyAdded: 0,
    });
  });

  test("Recently Added counts companies created within the last 30 days (inclusive of the boundary)", () => {
    const companies = [
      { status: "active", createdAt: daysAgo(1) }, // well inside window
      { status: "active", createdAt: daysAgo(RECENTLY_ADDED_WINDOW_DAYS) }, // exactly on boundary
      { status: "active", createdAt: daysAgo(RECENTLY_ADDED_WINDOW_DAYS + 1) }, // just outside
      { status: "active", createdAt: daysAgo(365) }, // long ago
    ];
    expect(computeCompanySummary(companies, NOW).recentlyAdded).toBe(2);
  });

  test("never throws on malformed/missing fields", () => {
    const companies = [{}, { status: "active" }, null, undefined];
    expect(() => computeCompanySummary(companies, NOW)).not.toThrow();
  });
});

describe("getSubscriptionStatus", () => {
  test("not_configured when there is no expiryDate", () => {
    expect(getSubscriptionStatus({ expiryDate: null }, NOW)).toBe("not_configured");
    expect(getSubscriptionStatus({}, NOW)).toBe("not_configured");
  });

  test("active when far from expiring", () => {
    expect(
      getSubscriptionStatus({ expiryDate: daysFromNow(60).toISOString() }, NOW)
    ).toBe("active");
  });

  test("expiring_soon within the warning window", () => {
    expect(
      getSubscriptionStatus({ expiryDate: daysFromNow(3).toISOString() }, NOW)
    ).toBe("expiring_soon");
  });

  test("valid through the entirety of the expiry date itself", () => {
    const todayLateInDay = new Date("2026-10-31T23:00:00.000Z");
    expect(
      getSubscriptionStatus({ expiryDate: "2026-10-31" }, todayLateInDay)
    ).not.toBe("expired");
  });

  test("expired starting the day after the expiry date", () => {
    const dayAfter = new Date("2026-11-01T00:00:01.000Z");
    expect(getSubscriptionStatus({ expiryDate: "2026-10-31" }, dayAfter)).toBe(
      "expired"
    );
  });
});

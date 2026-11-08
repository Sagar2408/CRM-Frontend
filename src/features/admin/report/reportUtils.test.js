import {
  rangeFor, rangeError, rangeParams, toISODate, summarize, latestFollowUps, conversionRate,
  rowsFor, exportRows, buildInsights, secondsToHours, COLUMNS,
} from "./reportUtils";

const report = {
  leads: [
    { id: 1, name: "Fresh One", email: "a@x.com", phone: "1", status: "New", assignmentDate: "2025-02-03" },
    { id: 2, name: "Assigned Two", status: "Assigned", createdAt: "2025-02-04T10:00:00Z" },
    { id: 3, name: "Followup Three", status: "Follow-Up" },
    { id: 4, name: "Nested", status: "", clientLead: { status: "assigned" } },
  ],
  followUps: [
    { id: 10, fresh_lead_id: 7, createdAt: "2025-02-01T00:00:00Z", clientLeadStatus: "Follow-Up", freshLead: { name: "Old", email: "o@x.com", phone: "9" } },
    { id: 11, fresh_lead_id: 7, createdAt: "2025-02-05T00:00:00Z", clientLeadStatus: "Follow-Up", freshLead: { name: "Old", email: "o@x.com", phone: "9" } },
    { id: 12, fresh_lead_id: 8, createdAt: "2025-02-02T00:00:00Z", clientLeadStatus: "Converted", freshLead: { name: "Done" } },
    { id: 13, fresh_lead_id: 9, createdAt: "2025-02-02T00:00:00Z", clientLeadStatus: "Follow-Up", freshLead: { name: "Nine" } },
  ],
  converted: [{ fresh_lead_id: 20, name: "Conv", email: "c@x.com", phone: "2", convertedAt: "2025-02-06T00:00:00Z" }],
  closed: [{ freshLeadId: 30, name: "Cl1", createdAt: "2025-02-07T00:00:00Z" }, { freshLeadId: 31, name: "Cl2" }],
  meetings: [{ id: 1, clientName: "Mee", clientEmail: "m@x.com", clientPhone: "3", startTime: "2025-02-08T09:00:00Z", endTime: "2025-02-08T10:00:00Z" }],
};

describe("date ranges", () => {
  const now = new Date(2025, 5, 18, 15, 30); // 18 Jun 2025, local time
  test("presets use the local calendar date (no UTC day shift)", () => {
    expect(rangeFor("today", {}, now)).toEqual({ startDate: "2025-06-18", endDate: "2025-06-18" });
    expect(rangeFor("7", {}, now)).toEqual({ startDate: "2025-06-12", endDate: "2025-06-18" });
    expect(rangeFor("month", {}, now)).toEqual({ startDate: "2025-06-01", endDate: "2025-06-18" });
    expect(rangeFor("all", {}, now)).toEqual({ startDate: "", endDate: "" });
    expect(rangeFor("custom", { from: "2025-01-01", to: "2025-01-31" }, now)).toEqual({ startDate: "2025-01-01", endDate: "2025-01-31" });
    expect(toISODate(new Date(2025, 0, 5, 23, 59))).toBe("2025-01-05");
  });
  test("reversed ranges are flagged; params only include set bounds", () => {
    expect(rangeError({ startDate: "2025-02-01", endDate: "2025-01-01" })).toMatch(/before/);
    expect(rangeError({ startDate: "2025-01-01", endDate: "" })).toBe("");
    expect(rangeParams({ startDate: "", endDate: "2025-01-01" })).toEqual({ endDate: "2025-01-01" });
    expect(rangeParams({ startDate: "", endDate: "" })).toEqual({});
  });
});

describe("KPI calculations", () => {
  test("counts: fresh = new/assigned (also via nested clientLead), follow-up = distinct leads still in Follow-Up", () => {
    expect(summarize(report)).toEqual({ fresh: 3, followUp: 2, converted: 1, closed: 2, meetings: 1 });
  });
  test("latest follow-up per lead wins", () => {
    const fu = latestFollowUps(report.followUps);
    expect(fu.map((f) => f.id).sort()).toEqual([11, 13]);
  });
  test("empty report is all zeros", () => {
    expect(summarize({})).toEqual({ fresh: 0, followUp: 0, converted: 0, closed: 0, meetings: 0 });
  });
  test("conversion rate = converted / (fresh + follow-up + converted + closed); null with no data", () => {
    expect(conversionRate({ fresh: 3, followUp: 2, converted: 1, closed: 2, meetings: 5 })).toBe(12.5);
    expect(conversionRate({ fresh: 0, followUp: 0, converted: 0, closed: 0, meetings: 4 })).toBeNull();
  });
  test("the table lists exactly the records that were counted", () => {
    ["fresh", "followUp", "converted", "closed", "meetings"].forEach((k) =>
      expect(rowsFor(k, report)).toHaveLength(summarize(report)[k])
    );
  });
  test("fresh rows show the assignment date, falling back to createdAt", () => {
    const rows = rowsFor("fresh", report);
    expect(rows[0].date).toBe("2025-02-03");
    expect(rows[1].date).toBe("2025-02-04T10:00:00Z");
  });
});

describe("export rows", () => {
  test("keyed by readable headers, matching the on-screen columns, for every metric", () => {
    ["fresh", "followUp", "converted", "closed", "meetings"].forEach((k) => {
      const out = exportRows(k, rowsFor(k, report));
      expect(Object.keys(out[0])).toEqual(COLUMNS[k].map((c) => c.header));
    });
    const meet = exportRows("meetings", rowsFor("meetings", report))[0];
    expect(meet.Client).toBe("Mee");
    expect(meet.Email).toBe("m@x.com"); // was blank before (wrong field names)
    expect(meet.Phone).toBe("3");
  });
});

describe("insights only state what the data supports", () => {
  const e = (name, counts, extra = {}) => ({ name, counts: { fresh: 0, followUp: 0, converted: 0, closed: 0, meetings: 0, ...counts }, rate: null, workHours: null, ...extra });
  test("single executive or all-zero data -> no insights", () => {
    expect(buildInsights([e("a", { converted: 3 })])).toEqual([]);
    expect(buildInsights([e("a"), e("b")])).toEqual([]);
  });
  test("names the leader, handles ties, ignores zeros", () => {
    const out = buildInsights([
      e("Ann", { converted: 4, meetings: 2 }, { rate: 40, workHours: 30 }),
      e("Bob", { converted: 1, meetings: 2 }, { rate: 10, workHours: 12 }),
    ]);
    expect(out).toContain("Ann — most converted clients (4).");
    expect(out).toContain("Ann and Bob (tied) — most meetings (2).");
    expect(out).toContain("Ann — highest conversion rate (40%).");
    expect(out).toContain("Ann — most work time logged (30 h).");
    expect(out.join(" ")).not.toMatch(/follow/); // nobody has follow-ups -> no claim
  });
  test("secondsToHours rounds to 2 decimals", () => expect(secondsToHours(5400)).toBe(1.5));
});

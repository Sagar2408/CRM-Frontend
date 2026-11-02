import React from "react";
import { render, act } from "@testing-library/react";
import {
  ExecutiveActivityProvider,
  useExecutiveActivity,
} from "./ExecutiveActivityContext";

// Regression guard: `leadtrack` (used unguarded by FreshLead.js's
// `}, [leadtrack])` effect) and `handleGetAttendance` (used by
// AttendanceTable.js's `fetchAttendance` callback) were plain
// `async () => {}` consts that call `setLoading(true)` then
// `setLoading(false)` on every invocation — guaranteeing two
// re-renders of ExecutiveActivityProvider per call, which recreated
// their own identity and re-fed the dependent effects into a loop.
//
// This test re-renders the provider and asserts both keep the same
// reference, so the bug can't silently come back.

const makeServiceProxy = () =>
  new Proxy(
    {},
    {
      get: () => jest.fn().mockResolvedValue(undefined),
    }
  );

jest.mock("../services/executiveService", () => makeServiceProxy());

describe("ExecutiveActivityContext function identity stability", () => {
  const STABLE_KEYS = ["leadtrack", "handleGetAttendance"];

  it("keeps fetch-callback identities stable across re-renders", async () => {
    localStorage.clear();

    const captured = [];
    const Capture = () => {
      const api = useExecutiveActivity();
      captured.push(api);
      return null;
    };

    let forceRerender;
    const Harness = () => {
      const [, setTick] = React.useState(0);
      forceRerender = () => setTick((t) => t + 1);
      return (
        <ExecutiveActivityProvider>
          <Capture />
        </ExecutiveActivityProvider>
      );
    };

    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      forceRerender();
    });

    expect(captured.length).toBeGreaterThanOrEqual(2);
    const first = captured[0];
    const last = captured[captured.length - 1];

    for (const key of STABLE_KEYS) {
      expect(typeof first[key]).toBe("function");
      expect(last[key]).toBe(first[key]);
    }
  });
});

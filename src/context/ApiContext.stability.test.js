import React from "react";
import { render, act } from "@testing-library/react";
import { ApiProvider, useApi } from "./ApiContext";

// Regression guard for the request-storm bug class: several ApiContext
// fetch functions used to be declared as plain `async () => {}` consts
// instead of `useCallback`, so they got a new identity on every
// ApiProvider render. Any component effect depending on one of them
// (e.g. `}, [fetchAllClients])`) would then re-fire on every render,
// call setState, re-render ApiProvider, and loop forever (see
// AdminNavbar/Summary/RevenueChart/TaskManagement/TLNavbar fixes).
//
// This test re-renders ApiProvider and asserts the fixed functions keep
// the same reference, so the bug can't silently come back.

// Manual Proxy-based mocks: the real apiService.js pulls in axios, whose
// published build this project's CRA/jest config can't transform from
// node_modules, so `jest.mock(path)` (automock) can't even load the real
// module to introspect its shape. A Proxy sidesteps that entirely by never
// requiring the real file, while still answering any property access with
// a resolved-undefined jest.fn (every call site in ApiContext.js already
// guards against undefined/empty responses).
const makeApiProxy = () =>
  new Proxy(
    {},
    {
      get: () => jest.fn().mockResolvedValue(undefined),
    }
  );

jest.mock("../services/apiService", () => makeApiProxy());
jest.mock("../services/fileUpload", () => makeApiProxy());

describe("ApiContext function identity stability", () => {
  const STABLE_KEYS = [
    "fetchExecutiveDashboardData",
    "getDealFunnel",
    "fetchRevenueChartDataAPI",
    "fetchAllExecutiveActivitiesByDateAPI",
    "fetchAllClients",
    "getAllConverted",
    "getAllProfile",
    "fetchSettings",
    "createCopyNotification",
    "refreshMeetings",
  ];

  it("keeps fetch-callback identities stable across re-renders", async () => {
    localStorage.clear();

    const captured = [];
    const Capture = () => {
      const api = useApi();
      captured.push(api);
      return null;
    };

    let forceRerender;
    const Harness = () => {
      const [, setTick] = React.useState(0);
      forceRerender = () => setTick((t) => t + 1);
      return (
        <ApiProvider>
          <Capture />
        </ApiProvider>
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

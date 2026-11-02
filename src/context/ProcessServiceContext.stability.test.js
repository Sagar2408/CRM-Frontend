import React from "react";
import { render, act } from "@testing-library/react";
import { ProcessServiceProvider, useProcessService } from "./ProcessServiceContext";

// Regression guard for the `processperson/` request storm reported on
// /admin/leadassign: `getAllProcessPersons` (and the sibling
// `getProcessAllFollowup`) were declared as plain `async () => {}`
// consts, so they got a new identity every time ProcessServiceProvider
// re-rendered. TaskManagement.js's effect `}, [getAllProcessPersons])`
// then re-fired on every render, re-called the API, which itself
// re-rendered the provider via setLoading — a self-sustaining loop.
//
// This test re-renders the provider and asserts the fixed functions
// keep the same reference, so the bug can't silently come back.

const makeServiceProxy = () =>
  new Proxy(
    {},
    {
      get: () => jest.fn().mockResolvedValue(undefined),
    }
  );

jest.mock("../services/processService", () => makeServiceProxy());

describe("ProcessServiceContext function identity stability", () => {
  const STABLE_KEYS = ["getAllProcessPersons", "getProcessAllFollowup"];

  it("keeps fetch-callback identities stable across re-renders", async () => {
    localStorage.clear();

    const captured = [];
    const Capture = () => {
      const api = useProcessService();
      captured.push(api);
      return null;
    };

    let forceRerender;
    const Harness = () => {
      const [, setTick] = React.useState(0);
      forceRerender = () => setTick((t) => t + 1);
      return (
        <ProcessServiceProvider>
          <Capture />
        </ProcessServiceProvider>
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

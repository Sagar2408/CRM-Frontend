import React from "react";
import { render, act } from "@testing-library/react";
import ExecutiveDetails from "./ExecutiveDetails";

// Regression guard: the mount effect that restores cooldowns from
// localStorage (ExecutiveDetails.js ~line 90-122) used to list
// `cooldownTimers` as its own dependency while also calling
// `setCooldownTimers(...)` inside itself with a brand-new Map every
// run. That self-reference made the effect re-fire forever, producing
// React's "Maximum update depth exceeded" (seen ~3,363 times in the
// console at /admin). The fix makes the effect mount-only (`[]`).
//
// This test mounts the real component (with its real cooldown effect)
// against stubbed contexts and asserts React never reports the loop.

// IMPORTANT: `useApi()` must return the *same* object/function references
// on every call, exactly like the real context (whose fetch callbacks are
// useCallback-memoized). Building a fresh object (with fresh jest.fn()s)
// inside the `useApi: () => ({...})` arrow on every render would make
// ExecutiveDetails's own `}, [filter, fetchAllHRsAPI, ...])` effect
// (line ~347) see "new" dependencies on every render and loop forever —
// that would be a bug in this mock, not in the component.
jest.mock("../../context/ApiContext", () => {
  const mockApiValue = {
    fetchExecutivesAPI: jest.fn().mockResolvedValue([]),
    fetchAllManagersAPI: jest.fn().mockResolvedValue([]),
    fetchAllHRsAPI: jest.fn().mockResolvedValue([]),
    fetchAllProcessPersonsAPI: jest.fn().mockResolvedValue([]),
    fetchAllTeamLeadsAPI: jest.fn().mockResolvedValue([]),
    createManagerTeam: jest.fn(),
    fetchAllTeamsAPI: jest.fn().mockResolvedValue([]),
    managerTeams: [],
    assignExecutiveToTeam: jest.fn(),
    updateUserLoginStatus: jest.fn(),
    toggleManagerLoginAccess: jest.fn(),
    toggleHrLoginAccess: jest.fn(),
    toggleProcessPersonLoginAccess: jest.fn(),
    toggleTlLoginAccess: jest.fn(),
    deleteTeamById: jest.fn(),
  };
  return { useApi: () => mockApiValue };
});

jest.mock("../../context/AuthContext", () => {
  const mockAuthValue = { user: { role: "Admin" } };
  return { useAuth: () => mockAuthValue };
});

jest.mock("../../context/LoadingContext", () => {
  const mockLoadingValue = {
    showLoader: jest.fn(),
    hideLoader: jest.fn(),
    isLoading: false,
    variant: "admin",
  };
  return { useLoading: () => mockLoadingValue };
});

describe("ExecutiveDetails cooldown-restore effect", () => {
  it("does not enter an infinite update loop on mount", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    localStorage.clear();
    // No active cooldown needed to reproduce the bug: the effect created a
    // brand-new (even empty) Map every run and put that Map in its own
    // dependency array, which alone was enough to loop. Deliberately not
    // seeding an active cooldown here so the test doesn't spin up a real
    // setInterval (startCooldown), keeping this fast and deterministic.

    await act(async () => {
      render(<ExecutiveDetails />);
    });

    const maxDepthCalls = errorSpy.mock.calls.filter((args) =>
      args.some(
        (a) => typeof a === "string" && a.includes("Maximum update depth")
      )
    );
    expect(maxDepthCalls.length).toBe(0);

    errorSpy.mockRestore();
  });
});

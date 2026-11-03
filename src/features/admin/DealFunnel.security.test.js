import React from "react";
import { render, cleanup } from "@testing-library/react";
import io from "socket.io-client";
import DealFunnel from "./DealFunnel";

// Regression test for the Phase 5 CSP-regression fix: DealFunnel.js
// used to hardcode its Socket.IO connection to "http://localhost:5000"
// — the one thing that happened to match this project's local .env
// today, but would silently fail in any other deployment. It now
// derives the socket origin from the same REACT_APP_API_BASE_URL every
// other service in this app already uses.

jest.mock("socket.io-client");

jest.mock("../../context/ApiContext", () => ({
  useApi: () => ({
    fetchDealFunnelData: jest.fn().mockResolvedValue({ statusCounts: {}, totalLeads: 0 }),
    fetchAssignedLeads: jest.fn().mockResolvedValue([]),
  }),
}));

// recharts' <ResponsiveContainer> uses ResizeObserver, which jsdom
// doesn't implement — unrelated to the fix under test, just needed so
// the component can render at all in this environment.
beforeAll(() => {
  global.ResizeObserver =
    global.ResizeObserver ||
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

describe("DealFunnel — Socket.IO origin is environment-derived, not hardcoded", () => {
  beforeEach(() => {
    io.mockReturnValue({ on: jest.fn(), disconnect: jest.fn() });
  });

  afterEach(() => {
    cleanup();
    io.mockClear();
  });

  it("connects to the backend origin derived from REACT_APP_API_BASE_URL, not a hardcoded localhost URL", () => {
    render(<DealFunnel />);

    expect(io).toHaveBeenCalledTimes(1);
    const calledWith = io.mock.calls[0][0];
    // Must be derived from REACT_APP_API_BASE_URL (http://localhost:5000/api
    // in this project's test env) with the trailing /api path stripped —
    // never a literal hardcoded string independent of that env var.
    expect(calledWith).toBe(
      (process.env.REACT_APP_API_BASE_URL || "").replace(/\/api\/?$/, "")
    );
    expect(calledWith).not.toMatch(/\/api\/?$/);
  });

  it("disconnects the socket on unmount instead of leaking the connection/listener", () => {
    const disconnect = jest.fn();
    io.mockReturnValue({ on: jest.fn(), disconnect });

    const { unmount } = render(<DealFunnel />);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

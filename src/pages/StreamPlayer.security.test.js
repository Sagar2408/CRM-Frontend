import React from "react";
import { render, cleanup } from "@testing-library/react";
import io from "socket.io-client";
import StreamPlayer from "./StreamPlayer";

// Regression tests for the Employee Monitoring lock: StreamPlayer.js
// used to open its Socket.IO connection as a module-level singleton
// (`const socket = io(...)` at the top of the file), meaning it
// connected the moment this file was merely imported — regardless of
// whether the component ever rendered a stream — and never
// disconnected. It's now created per-mount, inside the effect that
// actually uses it, and disconnected on cleanup.

jest.mock("socket.io-client");

describe("StreamPlayer — Socket.IO connection lifecycle", () => {
  beforeEach(() => {
    io.mockReturnValue({ on: jest.fn(), off: jest.fn(), disconnect: jest.fn() });
    io.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not connect until the component actually mounts with a valid executiveId/executiveName/type", () => {
    render(<StreamPlayer executiveId={null} executiveName={null} type={null} />);
    expect(io).not.toHaveBeenCalled();
  });

  it("connects exactly once when mounted with valid props", () => {
    render(<StreamPlayer executiveId={1} executiveName="sagar" type="screen" />);
    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith("https://monitoring-w28p.onrender.com");
  });

  it("disconnects the socket on unmount instead of leaking the connection", () => {
    const disconnect = jest.fn();
    io.mockReturnValue({ on: jest.fn(), off: jest.fn(), disconnect });

    const { unmount } = render(<StreamPlayer executiveId={1} executiveName="sagar" type="screen" />);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

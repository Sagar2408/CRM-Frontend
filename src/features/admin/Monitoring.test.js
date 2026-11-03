import React from "react";
import { render, screen } from "@testing-library/react";
import io from "socket.io-client";
import Monitoring from "./Monitoring";

// Employee Monitoring is temporarily locked. These tests confirm the
// locked message renders instead of the old executive grid/stream
// controls, and — the actual point of the fix — that no Socket.IO
// connection to monitoring-w28p.onrender.com is created just by
// rendering this page. StreamPlayer.js (the only thing that ever opened
// that socket) is no longer imported by Monitoring.js at all, so `io`
// should never be called.
jest.mock("socket.io-client");

describe("Monitoring — temporarily locked", () => {
  beforeEach(() => {
    io.mockClear();
  });

  it("shows the exact locked message instead of the monitoring dashboard", () => {
    render(<Monitoring />);

    expect(screen.getByText("Employee Monitoring")).toBeInTheDocument();
    expect(
      screen.getByText("This page is currently locked by Master User AdAgency360.")
    ).toBeInTheDocument();
    expect(screen.getByText("We will be serving this functionality in the future.")).toBeInTheDocument();
    expect(screen.getByText("Thank you for your patience.")).toBeInTheDocument();
  });

  it("does not render the old executive grid, filters or stream controls", () => {
    render(<Monitoring />);

    expect(screen.queryByText("Choose Executives")).not.toBeInTheDocument();
    expect(screen.queryByText("Start Screen Cast")).not.toBeInTheDocument();
    expect(screen.queryByText("Start Webcam")).not.toBeInTheDocument();
    expect(screen.queryByText("Start Audio Stream")).not.toBeInTheDocument();
    expect(document.querySelector("select")).not.toBeInTheDocument();
  });

  it("never opens a Socket.IO connection — io() is not called at all while this page is locked", () => {
    render(<Monitoring />);

    expect(io).not.toHaveBeenCalled();
  });
});

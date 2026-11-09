import React from "react";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";

const mockHandlers = {};
const mockSocket = { on: (evt, fn) => { mockHandlers[evt] = fn; }, close: jest.fn(), io: { on: jest.fn() } };
jest.mock("socket.io-client", () => ({ io: jest.fn(() => mockSocket) }));
jest.mock("../../../services/apiService", () => ({ __esModule: true, default: { get: jest.fn() } }));

import { io } from "socket.io-client";
import apiService from "../../../services/apiService";
import EmployeeLiveStatus, { applyPresence } from "./EmployeeLiveStatus";

const employees = [
  { key: "user:7", id: 7, name: "Ravi K", role: "Executive", online: true, sessions: 1, lastSeen: "2026-11-09T10:00:00Z" },
  { key: "user:8", id: 8, name: "Tina", role: "TL", online: false, sessions: 0, lastSeen: "2026-11-09T08:00:00Z" },
  { key: "manager:1", id: 1, name: "Mina", role: "Manager", online: false, sessions: 0, lastSeen: null },
];

beforeEach(() => {
  // CRA runs with resetMocks:true, so implementations are set per test.
  io.mockImplementation(() => mockSocket);
  apiService.get.mockResolvedValue({ data: { online: 1, offline: 2, employees } });
  localStorage.setItem("token", "jwt");
});

test("applyPresence updates only the matching employee", () => {
  const out = applyPresence(employees, { key: "user:8", online: true, lastSeen: "2026-11-09T11:00:00Z" });
  expect(out.find((e) => e.key === "user:8")).toMatchObject({ online: true, lastSeen: "2026-11-09T11:00:00Z" });
  expect(out.find((e) => e.key === "user:7")).toBe(employees[0]);
});

test("shows server counts, names, roles, last seen; connects with the token; updates live; filters", async () => {
  render(<EmployeeLiveStatus />);
  await waitFor(() => expect(screen.getByText("Ravi K")).toBeInTheDocument());
  expect(apiService.get).toHaveBeenCalledWith("/presence");
  expect(io).toHaveBeenCalledWith(expect.any(String), { auth: { token: "jwt" } });
  expect(screen.getByTestId("live-online")).toHaveTextContent("1");
  expect(screen.getByTestId("live-offline")).toHaveTextContent("2");
  expect(screen.getByText("Online now")).toBeInTheDocument();
  expect(screen.getByText(/No activity recorded/)).toBeInTheDocument(); // never seen: no fabricated timestamp
  expect(screen.getAllByRole("img", { name: "Online" })).toHaveLength(1);
  expect(screen.getAllByRole("img", { name: "Offline" })).toHaveLength(2);

  // live event: Tina comes online, Ravi goes offline
  act(() => { mockHandlers.presence_update({ key: "user:8", online: true, lastSeen: "2026-11-09T11:00:00Z" }); });
  act(() => { mockHandlers.presence_update({ key: "user:7", online: false, lastSeen: "2026-11-09T11:01:00Z" }); });
  expect(screen.getByTestId("live-online")).toHaveTextContent("1");
  const tina = screen.getByText("Tina").closest("li");
  expect(within(tina).getByText("Online now")).toBeInTheDocument();
  expect(within(screen.getByText("Ravi K").closest("li")).getByRole("img")).toHaveAttribute("aria-label", "Offline");

  fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "min" } });
  expect(screen.queryByText("Tina")).toBeNull();
  expect(screen.getByText("Mina")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "TL" } });
  expect(screen.queryByText("Mina")).toBeNull();
  expect(screen.getByText("Tina")).toBeInTheDocument();
});

test("shows an error and no fake statuses when the API fails", async () => {
  apiService.get.mockRejectedValue(new Error("boom"));
  jest.spyOn(console, "error").mockImplementation(() => {});
  render(<EmployeeLiveStatus />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not load employee status."));
  expect(screen.queryByText("Online now")).toBeNull();
});

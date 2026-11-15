import React from "react";
import { render, act } from "@testing-library/react";
import { ProcessProvider, useProcess } from "./ProcessAuthContext";
import * as auth from "../services/processAuth";

const mockNavigate = jest.fn();
const mockStopWork = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("./ProcessServiceContext", () => ({ useProcessService: () => ({ stopWork: mockStopWork }) }));
jest.mock("../services/processAuth", () => ({ loginUser: jest.fn(), signupUser: jest.fn(), logoutUser: jest.fn() }));

let api;
const Probe = () => {
  api = useProcess();
  return null;
};

const session = () => {
  localStorage.setItem("token", "t");
  localStorage.setItem("userType", "processperson");
  localStorage.setItem("workStartTime", "x");
  localStorage.setItem("user", JSON.stringify({ id: 9, fullName: "Pat", type: "processperson" }));
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  session();
});

const renderIt = () => render(<ProcessProvider><Probe /></ProcessProvider>);

test("closes the work session BEFORE revoking the token, then clears everything and goes to /login", async () => {
  const order = [];
  mockStopWork.mockImplementation(async () => order.push("stopWork"));
  auth.logoutUser.mockImplementation(async () => order.push("logout"));
  renderIt();
  await act(async () => { await api.logout(); });
  expect(order).toEqual(["stopWork", "logout"]);
  expect(auth.logoutUser).toHaveBeenCalledWith("processperson"); // not the customer endpoint
  expect(mockStopWork).toHaveBeenCalledWith(9);
  ["token", "user", "userType", "workStartTime"].forEach((k) => expect(localStorage.getItem(k)).toBeNull());
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});

test("a failing work-session call can no longer block logout", async () => {
  mockStopWork.mockRejectedValue(new Error("Work session not started"));
  auth.logoutUser.mockResolvedValue({});
  renderIt();
  await act(async () => { await api.logout(); });
  expect(auth.logoutUser).toHaveBeenCalledWith("processperson");
  expect(localStorage.getItem("token")).toBeNull();
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});

test("even if the server call fails the local session ends and the user lands on /login", async () => {
  mockStopWork.mockResolvedValue({});
  auth.logoutUser.mockRejectedValue(new Error("network down"));
  renderIt();
  await act(async () => { await api.logout(); });
  expect(localStorage.getItem("token")).toBeNull();
  expect(localStorage.getItem("user")).toBeNull();
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});

test("Customer logout is unchanged: customer endpoint, no work-session call", async () => {
  localStorage.setItem("userType", "customer");
  localStorage.setItem("user", JSON.stringify({ id: 3, type: "customer" }));
  auth.logoutUser.mockResolvedValue({});
  renderIt();
  await act(async () => { await api.logout(); });
  expect(auth.logoutUser).toHaveBeenCalledWith("customer");
  expect(mockStopWork).not.toHaveBeenCalled();
});

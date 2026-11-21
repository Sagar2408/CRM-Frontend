import React from "react";
import { render, act } from "@testing-library/react";

// Client Portal sessions: an idle timeout (AuthContext.logout) must revoke the session on the SERVER before the
// local state is cleared, and a login refused because the legacy password is the phone number stores nothing.
// react-router-dom cannot be resolved by this repo's Jest setup, so useNavigate is stubbed.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../services/auth", () => ({ loginUser: jest.fn(), logoutUser: jest.fn() }));
jest.mock("../services/clientPortalApi", () => ({ logoutClient: jest.fn() }));
jest.mock("../services/executiveService", () => ({ recordStartWork: jest.fn(), recordStopWork: jest.fn() }));
jest.mock("../features/executive/useLoginTimer", () => () => {});
jest.mock("../features/admin/ThemeContext", () => {
  const ReactLib = require("react");
  return { ThemeContext: ReactLib.createContext({ forceLightTheme: () => {} }) };
});
jest.mock("../utils/authEvents", () => ({ emitSubscriptionExpired: jest.fn() }));
const mockToastError = jest.fn();
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: (...a) => mockToastError(...a) } }));

const authService = require("../services/auth");
const { logoutClient } = require("../services/clientPortalApi");
const { AuthProvider, useAuth } = require("./AuthContext");

function renderAuth() {
  let api;
  const Harness = () => {
    api = useAuth();
    return null;
  };
  act(() => {
    render(<AuthProvider><Harness /></AuthProvider>);
  });
  return () => api;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  authService.logoutUser.mockResolvedValue({}); // CRA resetMocks wipes factory implementations
  delete window.location;
  window.location = { href: "" };
});

describe("client session logout (manual or idle timeout)", () => {
  const clientSession = () => {
    localStorage.setItem("token", "client-token");
    localStorage.setItem("userType", "client");
    localStorage.setItem("user", JSON.stringify({ id: 5, type: "client" }));
  };

  test("revokes the session on the server FIRST, then clears local state and goes to /login", async () => {
    clientSession();
    const order = [];
    logoutClient.mockImplementation(async () => {
      order.push(`server(token still stored: ${localStorage.getItem("token") === "client-token"})`);
    });
    const getApi = renderAuth();
    await act(async () => {
      await getApi().logout({ reason: "inactivity" });
    });
    expect(order).toEqual(["server(token still stored: true)"]);
    expect(logoutClient).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("userType")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(sessionStorage.getItem("crm.logoutNotice")).toBe("inactivity");
  });

  test("if the server call fails (offline / already revoked) the local session still ends", async () => {
    clientSession();
    logoutClient.mockRejectedValue(new Error("offline"));
    const getApi = renderAuth();
    await act(async () => {
      await getApi().logout({ reason: "inactivity" });
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("userType")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("a staff logout never calls the client revoke endpoint", async () => {
    localStorage.setItem("token", "staff");
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "Manager" }));
    authService.logoutUser.mockResolvedValue({});
    const getApi = renderAuth();
    await act(async () => {
      await getApi().logout();
    });
    expect(logoutClient).not.toHaveBeenCalled();
    expect(authService.logoutUser).toHaveBeenCalled();
  });
});

describe("a legacy customer whose password is the phone number", () => {
  test("login is refused with the server message; nothing is stored and nobody is redirected", async () => {
    authService.loginUser.mockRejectedValue(Object.assign(new Error("Your account needs a new password before you can sign in. Please ask your case officer to set up your client portal password."), { code: "PASSWORD_SETUP_REQUIRED" }));
    const getApi = renderAuth();
    await act(async () => {
      await getApi().login("legacy@x.test", "9876543210", "ACME01");
    });
    expect(mockToastError).toHaveBeenCalled();
    expect(JSON.stringify(mockToastError.mock.calls[0][0].props)).toMatch(/needs a new password/);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("userType")).toBeNull();
    expect(window.location.href).toBe("");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

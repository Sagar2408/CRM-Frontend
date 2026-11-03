import React from "react";
import { render, act, waitFor } from "@testing-library/react";

// Process Person / common-login-page integration regression tests:
// the general employee login page (Login.js, userType="executive")
// now also authenticates Process Person accounts by falling back to
// POST /processperson/login when the primary /login lookup finds no
// User account at all (404) — see AuthContext.js's login().
//
// react-router-dom is mocked rather than wrapped with a real
// MemoryRouter: this repo's Jest setup cannot resolve the real
// package in any test (a pre-existing, already-documented issue — see
// src/App.test.js and SECURITY_AUDIT.md's Phase 5 section). Mocking
// it here (a no-op useNavigate) avoids that entirely, independent of
// AuthContext.js's own (unrelated) use of it for post-login
// navigation.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));

jest.mock("../services/auth", () => ({
  loginUser: jest.fn(),
  loginProcessPersonAPI: jest.fn(),
}));
jest.mock("../services/executiveService", () => ({
  recordStartWork: jest.fn().mockResolvedValue({}),
  recordStopWork: jest.fn().mockResolvedValue({}),
}));
jest.mock("../features/executive/useLoginTimer", () => () => {});
jest.mock("../features/admin/ThemeContext", () => {
  const ReactLib = require("react");
  return { ThemeContext: ReactLib.createContext({ forceLightTheme: () => {} }) };
});
jest.mock("../utils/authEvents", () => ({ emitSubscriptionExpired: jest.fn() }));

const authService = require("../services/auth");
const { AuthProvider, useAuth } = require("./AuthContext");

function Harness({ onReady }) {
  const api = useAuth();
  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

function renderAuth() {
  let apiRef;
  act(() => {
    render(
      <AuthProvider>
        <Harness onReady={(api) => (apiRef = api)} />
      </AuthProvider>
    );
  });
  return () => apiRef;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  delete window.location;
  window.location = { href: "" };
});

describe("AuthContext login() — Process Person fallback on the common employee login page", () => {
  test("a 404 from the primary /login (no matching User account), on the executive page, falls back to Process Person login and stores the session", async () => {
    const notFound = Object.assign(new Error("User not found"), { status: 404 });
    authService.loginUser.mockRejectedValue(notFound);
    authService.loginProcessPersonAPI.mockResolvedValue({
      message: "Login successful.",
      token: "pp-token",
      refreshToken: "pp-refresh",
      person: { id: 7, fullName: "Pat Process", email: "pat@acme.com" },
    });

    const getApi = renderAuth();

    await act(async () => {
      await getApi().login("pat@acme.com", "secret123", "executive", "ACME01");
    });

    expect(authService.loginProcessPersonAPI).toHaveBeenCalledWith(
      "pat@acme.com",
      "secret123",
      "ACME01"
    );
    expect(localStorage.getItem("token")).toBe("pp-token");
    expect(localStorage.getItem("userType")).toBe("processperson");
    const storedUser = JSON.parse(localStorage.getItem("user"));
    expect(storedUser).toEqual({ id: 7, fullName: "Pat Process", email: "pat@acme.com", type: "processperson" });

    // Redirect to the Process Person dashboard is a full navigation
    // (window.location.href), not react-router's navigate() — see the
    // comment in AuthContext.js for why (two independent auth
    // providers, ProcessAuthContext only rehydrates from localStorage
    // on its own initial mount).
    await waitFor(() => expect(window.location.href).toBe("/process"), { timeout: 2000 });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("a non-404 error (wrong password against a real User account) is surfaced as-is — never silently retried as Process Person", async () => {
    const wrongPassword = Object.assign(new Error("Invalid credentials"), { status: 401 });
    authService.loginUser.mockRejectedValue(wrongPassword);

    const getApi = renderAuth();

    await act(async () => {
      await getApi().login("real.user@acme.com", "wrong", "executive", "ACME01");
    });

    expect(authService.loginProcessPersonAPI).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("the Admin login page (role='admin') never attempts the Process Person fallback, even on a 404", async () => {
    const notFound = Object.assign(new Error("User not found"), { status: 404 });
    authService.loginUser.mockRejectedValue(notFound);

    const getApi = renderAuth();

    await act(async () => {
      await getApi().login("someone@acme.com", "secret123", "admin", "ACME01");
    });

    expect(authService.loginProcessPersonAPI).not.toHaveBeenCalled();
  });

  test("a real Executive login (no 404) is completely unaffected by the fallback path", async () => {
    authService.loginUser.mockResolvedValue({
      token: "exec-token",
      user: { id: 3, role: "Executive", username: "exec1" },
    });

    const getApi = renderAuth();

    await act(async () => {
      await getApi().login("exec1@acme.com", "secret123", "executive", "ACME01");
    });

    expect(authService.loginProcessPersonAPI).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBe("exec-token");
    expect(JSON.parse(localStorage.getItem("user")).role).toBe("Executive");
  });
});

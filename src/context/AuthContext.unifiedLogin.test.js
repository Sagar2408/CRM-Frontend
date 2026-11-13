import React from "react";
import { render, act } from "@testing-library/react";

// One login page for every tenant role. AuthContext.login() sends credentials +
// company code only, then uses the role the SERVER verified (response.identity
// and the returned profile) to pick the session shape and dashboard.
// react-router-dom cannot be resolved by this repo's Jest setup (documented), so
// useNavigate is stubbed.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../services/auth", () => ({ loginUser: jest.fn() }));
jest.mock("../services/executiveService", () => ({
  recordStartWork: jest.fn(),
  recordStopWork: jest.fn(),
}));
jest.mock("../features/executive/useLoginTimer", () => () => {});
jest.mock("../features/admin/ThemeContext", () => {
  const ReactLib = require("react");
  return { ThemeContext: ReactLib.createContext({ forceLightTheme: () => {} }) };
});
const mockEmitExpired = jest.fn();
jest.mock("../utils/authEvents", () => ({ emitSubscriptionExpired: (...a) => mockEmitExpired(...a) }));

const authService = require("../services/auth");
const { recordStartWork } = require("../services/executiveService");
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
    render(<AuthProvider><Harness onReady={(a) => (apiRef = a)} /></AuthProvider>);
  });
  return () => apiRef;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  localStorage.clear();
  // CRA resetMocks wipes factory implementations
  recordStartWork.mockResolvedValue({});
  delete window.location;
  window.location = { href: "" };
});
afterEach(() => jest.useRealTimers());

const run = async (getApi, ...args) => {
  await act(async () => {
    await getApi().login(...args);
  });
  act(() => {
    jest.advanceTimersByTime(2500);
  });
};

describe("staff roles (Admin, Executive, HR, Manager) use the same call and land on their own dashboard", () => {
  test.each([
    ["Admin", { identity: "user", user: { id: 1, role: "Admin" } }, "/admin"],
    ["Executive", { identity: "user", user: { id: 2, role: "Executive" } }, "/executive"],
    ["HR", { identity: "hr", hr: { id: 4, role: "HR" } }, "/hr"],
    ["Manager", { identity: "manager", manager: { id: 5, role: "Manager" } }, "/manager"],
  ])("%s -> %s", async (role, body, path) => {
    authService.loginUser.mockResolvedValue({ token: `tok-${role}`, ...body });
    const getApi = renderAuth();
    await run(getApi, "a@acme.com", "pw", "ACME01");

    // exactly three arguments: no role / page identifier is ever passed
    expect(authService.loginUser).toHaveBeenCalledTimes(1);
    expect(authService.loginUser).toHaveBeenCalledWith("a@acme.com", "pw", "ACME01");
    expect(mockNavigate).toHaveBeenCalledWith(path);
    expect(localStorage.getItem("token")).toBe(`tok-${role}`);
    expect(JSON.parse(localStorage.getItem("user")).role).toBe(role);
  });

  test("the dashboard comes from the server-verified role, not from anything already in localStorage", async () => {
    localStorage.setItem("user", JSON.stringify({ id: 99, role: "Admin" })); // stale / tampered
    localStorage.setItem("userType", "customer");
    authService.loginUser.mockResolvedValue({ token: "t", identity: "user", user: { id: 2, role: "Executive" } });
    const getApi = renderAuth();
    await run(getApi, "e@acme.com", "pw", "ACME01");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/executive");
    expect(JSON.parse(localStorage.getItem("user")).role).toBe("Executive");
    expect(localStorage.getItem("userType")).toBeNull(); // stale portal marker cleared
  });

  test("a legacy Team Lead role is not a recognised role: no session, no dashboard (there is no /team-lead any more)", async () => {
    authService.loginUser.mockResolvedValue({ token: "t", identity: "user", user: { id: 3, role: "TL" } });
    const getApi = renderAuth();
    await run(getApi, "tl@acme.com", "pw", "ACME01");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("an unrecognised role never reaches a dashboard", async () => {
    authService.loginUser.mockResolvedValue({ token: "t", identity: "user", user: { id: 2, role: "Superuser" } });
    const getApi = renderAuth();
    await run(getApi, "e@acme.com", "pw", "ACME01");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("Process Person and Customer", () => {
  test("Process Person: session stored the way the process portal expects, then /process", async () => {
    authService.loginUser.mockResolvedValue({ token: "pp-tok", identity: "processperson", person: { id: 7, fullName: "Pat", email: "p@acme.com" } });
    const getApi = renderAuth();
    await run(getApi, "p@acme.com", "pw", "ACME01");
    expect(localStorage.getItem("token")).toBe("pp-tok");
    expect(localStorage.getItem("userType")).toBe("processperson");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual({ id: 7, fullName: "Pat", email: "p@acme.com", type: "processperson" });
    expect(window.location.href).toBe("/process");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("Customer: session stored the way the customer portal expects, then the customer dashboard", async () => {
    authService.loginUser.mockResolvedValue({ token: "c-tok", identity: "customer", customer: { id: 8, fullName: "Cleo", email: "c@acme.com" } });
    const getApi = renderAuth();
    await run(getApi, "c@acme.com", "pw", "ACME01");
    expect(localStorage.getItem("userType")).toBe("customer");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual({ id: 8, fullName: "Cleo", email: "c@acme.com", type: "customer" });
    expect(window.location.href).toBe("/customer/client/dashboard");
  });
});

describe("failures never create a session", () => {
  test.each([
    ["wrong password", { status: 401, message: "Invalid credentials" }],
    ["unknown e-mail", { status: 404, message: "User not found" }],
    ["deactivated account", { status: 403, message: "Login access is disabled. Please contact admin." }],
    ["ambiguous e-mail", { status: 409, code: "AMBIGUOUS_ACCOUNT", message: "more than one account type" }],
    ["invalid company code", { status: 404, message: "Invalid company code" }],
  ])("%s", async (_name, err) => {
    authService.loginUser.mockRejectedValue(Object.assign(new Error(err.message), err));
    const getApi = renderAuth();
    await run(getApi, "a@acme.com", "bad", "ACME01");
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
    expect(authService.loginUser).toHaveBeenCalledTimes(1); // no fallback to any other login endpoint
  });

  test("an expired subscription raises the existing popup", async () => {
    authService.loginUser.mockRejectedValue(Object.assign(new Error("expired"), { code: "SUBSCRIPTION_EXPIRED", companyName: "Acme", expiryDate: "2020-01-01" }));
    const getApi = renderAuth();
    await run(getApi, "a@acme.com", "pw", "ACME01");
    expect(mockEmitExpired).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Acme" }));
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("missing fields are rejected locally without a request", async () => {
    const getApi = renderAuth();
    await run(getApi, "a@acme.com", "pw", "");
    expect(authService.loginUser).not.toHaveBeenCalled();
  });
});

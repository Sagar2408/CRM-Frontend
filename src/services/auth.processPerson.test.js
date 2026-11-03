// Process Person / common-login-page integration: regression tests for
// the new loginProcessPersonAPI() and loginError()'s status-capture
// change in services/auth.js. Kept at the service layer (no
// react-router-dom import) rather than exercising AuthContext.js
// directly — this repo's Jest setup has a pre-existing, already-
// documented react-router-dom module-resolution failure for any test
// that imports it (see src/App.test.js, and SECURITY_AUDIT.md's Phase
// 5 section), which AuthContext.js pulls in transitively via
// `useNavigate`. Not something this change caused or can work around.

// This repo's Jest setup cannot resolve the real react-router-dom
// package in a test (a pre-existing, already-documented issue — see
// src/App.test.js and SECURITY_AUDIT.md's Phase 5 section), and
// services/auth.js imports `Navigate` from it (for its PrivateRoute/
// PublicRoute route-guard components, unrelated to the functions under
// test here). Mocking the module avoids ever resolving the real
// package, without touching the pre-existing issue itself.
jest.mock("react-router-dom", () => ({ Navigate: () => null }));

import { loginUser, loginProcessPersonAPI } from "./auth";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function mockFetchOnce(status, body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  jest.resetAllMocks();
});

describe("loginUser() — status is now captured on a thrown error", () => {
  test("a 404 (no matching User account) throws an error with status 404", async () => {
    mockFetchOnce(404, { message: "User not found" });
    await expect(loginUser("a@a.com", "pw", "executive", "ACME01")).rejects.toMatchObject({
      message: "User not found",
      status: 404,
    });
  });

  test("a 401 (wrong password) throws an error with status 401, distinguishable from a 404", async () => {
    mockFetchOnce(401, { message: "Invalid credentials" });
    await expect(loginUser("a@a.com", "wrong", "executive", "ACME01")).rejects.toMatchObject({
      message: "Invalid credentials",
      status: 401,
    });
  });

  test("a successful login still returns the response body unchanged", async () => {
    mockFetchOnce(200, { token: "t", user: { id: 1, role: "Executive" } });
    const result = await loginUser("a@a.com", "pw", "executive", "ACME01");
    expect(result).toEqual({ token: "t", user: { id: 1, role: "Executive" } });
  });
});

describe("loginProcessPersonAPI() — hits the same backend endpoint the dedicated Process Person login page already uses", () => {
  test("posts to /processperson/login with {email, password, companyCode}", async () => {
    mockFetchOnce(200, {
      message: "Login successful.",
      token: "pp-token",
      refreshToken: "pp-refresh",
      person: { id: 7, fullName: "Pat Process", email: "pat@acme.com" },
    });

    const result = await loginProcessPersonAPI("pat@acme.com", "secret123", "ACME01");

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/processperson/login`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "pat@acme.com", password: "secret123", companyCode: "ACME01" }),
      })
    );
    expect(result.person.fullName).toBe("Pat Process");
  });

  test("an invalid/unknown company code surfaces the backend's 404 message", async () => {
    mockFetchOnce(404, { message: "Invalid company code" });
    await expect(loginProcessPersonAPI("pat@acme.com", "secret123", "WRONGCODE")).rejects.toMatchObject({
      message: "Invalid company code",
      status: 404,
    });
  });

  test("wrong credentials surface the backend's 401 message, not a generic failure", async () => {
    mockFetchOnce(401, { message: "Invalid credentials." });
    await expect(loginProcessPersonAPI("pat@acme.com", "wrongpass", "ACME01")).rejects.toMatchObject({
      message: "Invalid credentials.",
      status: 401,
    });
  });

  test("a disabled/expired subscription (SUBSCRIPTION_EXPIRED) carries its code through", async () => {
    mockFetchOnce(403, {
      code: "SUBSCRIPTION_EXPIRED",
      message: "Your company's subscription/payment period has expired.",
      companyName: "Acme Co",
    });
    await expect(loginProcessPersonAPI("pat@acme.com", "secret123", "ACME01")).rejects.toMatchObject({
      code: "SUBSCRIPTION_EXPIRED",
      companyName: "Acme Co",
    });
  });
});

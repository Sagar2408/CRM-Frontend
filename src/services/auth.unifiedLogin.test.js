// This repo's Jest setup cannot resolve the real react-router-dom (pre-existing,
// documented in SECURITY_AUDIT.md); services/auth.js only needs `Navigate`.
jest.mock("react-router-dom", () => ({ Navigate: () => null }));

import { loginUser } from "./auth";

const mockFetchOnce = (status, body) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
};
afterEach(() => jest.resetAllMocks());

describe("loginUser() - the single tenant login request", () => {
  test("posts ONLY email, password and companyCode to /login (no role, no page identifier)", async () => {
    mockFetchOnce(200, { token: "t", identity: "hr", hr: { id: 1, role: "HR" } });
    const out = await loginUser("a@a.com", "pw", "ACME01");
    expect(out).toEqual({ token: "t", identity: "hr", hr: { id: 1, role: "HR" } });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/login$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@a.com", password: "pw", companyCode: "ACME01" });
  });

  test("failures keep the server message, status and structured code", async () => {
    mockFetchOnce(401, { message: "Invalid credentials" });
    await expect(loginUser("a@a.com", "bad", "ACME01")).rejects.toMatchObject({ message: "Invalid credentials", status: 401 });
    mockFetchOnce(409, { code: "AMBIGUOUS_ACCOUNT", message: "registered for more than one account type" });
    await expect(loginUser("a@a.com", "pw", "ACME01")).rejects.toMatchObject({ code: "AMBIGUOUS_ACCOUNT", status: 409 });
    mockFetchOnce(403, { code: "SUBSCRIPTION_EXPIRED", message: "expired", companyName: "Acme", expiryDate: "2020-01-01" });
    await expect(loginUser("a@a.com", "pw", "ACME01")).rejects.toMatchObject({ code: "SUBSCRIPTION_EXPIRED", companyName: "Acme" });
  });

  test("HR / Manager style error bodies ({error}) still surface a message", async () => {
    mockFetchOnce(403, { error: "Login access is disabled." });
    await expect(loginUser("a@a.com", "pw", "ACME01")).rejects.toMatchObject({ message: "Login access is disabled." });
  });
});

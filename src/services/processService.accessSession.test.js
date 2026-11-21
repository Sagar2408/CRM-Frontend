// The Dashboard / Documents / stage calls a Process Person makes carry the Manage Clients access session.
// (The SERVER enforces it; this proves the browser actually sends it, and nothing else leaks.)
import { getCustomerStagesById, getCustomerDocuments, uploadCustomerDocuments } from "./processService";
import { storeClientAccessGrant, clearClientAccessGrant } from "./clientAccess";

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });
const lastHeaders = () => global.fetch.mock.calls[global.fetch.mock.calls.length - 1][1].headers;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem("token", "login-token");
  localStorage.setItem("user", JSON.stringify({ id: 7 }));
  global.fetch = jest.fn().mockResolvedValue(ok());
});

describe("Process Person client calls and the access session", () => {
  test("stage + document reads send the grant next to the login token", async () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    await getCustomerStagesById(4);
    expect(lastHeaders()).toMatchObject({ Authorization: "Bearer login-token", "X-Client-Access": "grant-1" });
    await getCustomerDocuments("customer", 4);
    expect(lastHeaders()["X-Client-Access"]).toBe("grant-1");
  });

  test("uploads send it too (multipart: no JSON content type is forced)", async () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    await uploadCustomerDocuments(new FormData());
    expect(lastHeaders()).toMatchObject({ Authorization: "Bearer login-token", "X-Client-Access": "grant-1" });
    expect(lastHeaders()["Content-Type"]).toBeUndefined();
  });

  test("with no (or an expired / foreign) grant nothing is sent - the server then answers 403", async () => {
    clearClientAccessGrant();
    await getCustomerStagesById(4);
    expect(lastHeaders()["X-Client-Access"]).toBeUndefined();
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    localStorage.setItem("user", JSON.stringify({ id: 8 })); // another person on this tab
    await getCustomerStagesById(4);
    expect(lastHeaders()["X-Client-Access"]).toBeUndefined();
  });

  test("a server refusal for a missing access session is surfaced as an error, not swallowed", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: "CLIENT_ACCESS_REQUIRED", message: "Enter your Client Portal Access Password to continue." }) });
    await expect(getCustomerStagesById(4)).rejects.toBeDefined();
  });
});

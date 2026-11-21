import {
  clearClientAccessGrant,
  readClientAccessGrant,
  storeClientAccessGrant,
  getManagedClients,
  verifyClientAccessPassword,
  setClientPortalPassword,
  setClientPortalActive,
  getClientPortalInfo,
  setClientAccessPassword,
  changeClientAccessPassword,
  CLIENT_ACCESS_LOCKED_EVENT,
  lockClientAccess,
} from "./clientAccess";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const base = process.env.REACT_APP_API_BASE_URL;
const last = () => {
  const [url, init] = global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
  return { url: String(url).replace(String(base), ""), init };
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem("token", "login-token");
  localStorage.setItem("user", JSON.stringify({ id: 7 }));
  global.fetch = jest.fn().mockResolvedValue(reply(200, {}));
});

describe("grant storage", () => {
  test("stores only the server grant, scoped to the signed-in person, and expires", () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 60 });
    expect(readClientAccessGrant().token).toBe("g1");
    expect(sessionStorage.getItem("crm.pp.clientAccess")).not.toMatch(/password/i);
    localStorage.setItem("user", JSON.stringify({ id: 8 }));
    expect(readClientAccessGrant()).toBeNull(); // another person on the same tab
    expect(sessionStorage.getItem("crm.pp.clientAccess")).toBeNull(); // and it is discarded
  });

  test("clear removes it; an expired grant is dropped", () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 60 });
    clearClientAccessGrant();
    expect(readClientAccessGrant()).toBeNull();
    storeClientAccessGrant({ token: "g1", expiresInSeconds: -1 });
    expect(readClientAccessGrant()).toBeNull();
  });
});

describe("lock", () => {
  test("revokes the access session on the server, then forgets it locally and tells the page to lock", async () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 900 });
    const heard = jest.fn();
    window.addEventListener(CLIENT_ACCESS_LOCKED_EVENT, heard);
    await lockClientAccess();
    expect(last()).toMatchObject({ url: "/processperson/client-access/lock", init: { method: "POST" } });
    expect(last().init.headers["X-Client-Access"]).toBe("g1"); // the grant being revoked is the one sent
    expect(readClientAccessGrant()).toBeNull();
    expect(heard).toHaveBeenCalled();
    window.removeEventListener(CLIENT_ACCESS_LOCKED_EVENT, heard);
  });

  test("still locks locally when the server call fails", async () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 900 });
    global.fetch.mockRejectedValue(new Error("offline"));
    await lockClientAccess();
    expect(readClientAccessGrant()).toBeNull();
  });
});

describe("requests", () => {
  test("verify posts the password once and keeps only the returned grant", async () => {
    global.fetch.mockResolvedValue(reply(200, { accessGrant: { token: "g1", expiresInSeconds: 900 } }));
    await verifyClientAccessPassword("Access#2024");
    expect(last()).toMatchObject({ url: "/processperson/client-access/verify", init: { method: "POST" } });
    expect(JSON.parse(last().init.body)).toEqual({ password: "Access#2024" });
    expect(readClientAccessGrant().token).toBe("g1");
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain("Access#2024");
  });

  test("Manage Clients calls send the bearer token AND the grant; a renewed grant replaces it", async () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 900 });
    global.fetch.mockResolvedValue(reply(200, { clients: [{ id: 1 }], accessGrant: { token: "g2", expiresInSeconds: 900 } }));
    await expect(getManagedClients()).resolves.toEqual([{ id: 1 }]);
    expect(last().init.headers.Authorization).toBe("Bearer login-token");
    expect(last().init.headers["X-Client-Access"]).toBe("g1");
    expect(readClientAccessGrant().token).toBe("g2");
  });

  test("an expired grant answer clears it and tells the page to lock", async () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 900 });
    const heard = jest.fn();
    window.addEventListener(CLIENT_ACCESS_LOCKED_EVENT, heard);
    global.fetch.mockResolvedValue(reply(403, { code: "CLIENT_ACCESS_EXPIRED", message: "expired" }));
    await expect(getManagedClients()).rejects.toMatchObject({ code: "CLIENT_ACCESS_EXPIRED", status: 403 });
    expect(readClientAccessGrant()).toBeNull();
    expect(heard).toHaveBeenCalled();
    window.removeEventListener(CLIENT_ACCESS_LOCKED_EVENT, heard);
  });

  test("credential endpoints: URLs, verbs and bodies", async () => {
    storeClientAccessGrant({ token: "g1", expiresInSeconds: 900 });
    global.fetch.mockResolvedValue(reply(200, { portal: { status: "active" } }));
    await getClientPortalInfo(5);
    expect(last().url).toBe("/processperson/managed-clients/5/portal");
    await setClientPortalPassword(5, "Client#2024", "Client#2024");
    expect(last()).toMatchObject({ url: "/processperson/managed-clients/5/portal/password", init: { method: "PUT" } });
    expect(JSON.parse(last().init.body)).toEqual({ password: "Client#2024", confirmPassword: "Client#2024" });
    await setClientPortalActive(5, false);
    expect(last()).toMatchObject({ url: "/processperson/managed-clients/5/portal", init: { method: "PATCH" } });
    expect(JSON.parse(last().init.body)).toEqual({ isActive: false });
  });

  test("access password set / change endpoints", async () => {
    await setClientAccessPassword("login", "New#Pass123", "New#Pass123");
    expect(last()).toMatchObject({ url: "/processperson/client-access/set", init: { method: "POST" } });
    await changeClientAccessPassword("old", "New#Pass123", "New#Pass123");
    expect(last()).toMatchObject({ url: "/processperson/client-access/change", init: { method: "PUT" } });
  });

  test("field errors from the server are included in the message", async () => {
    global.fetch.mockResolvedValue(reply(400, { message: "Invalid request body.", errors: [{ field: "password", message: "'password' is too weak" }] }));
    await expect(setClientPortalPassword(5, "x", "x")).rejects.toThrow(/Invalid request body\..*too weak/);
  });
});

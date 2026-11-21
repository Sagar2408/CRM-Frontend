// Process Person > Manage Clients: access password, the short-lived grant that unlocks the page, the
// assigned-client list and each client's portal credentials.
//
// The grant is NOT the password: it is a signed, server-issued token bound to this person and this login
// session. It lives in sessionStorage (gone when the tab closes), is renewed by the server on every guarded
// call (sliding idle expiry) and is cleared on logout / when the server says it expired. The password itself
// is only ever sent to the server and is never stored anywhere.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const KEY = "crm.pp.clientAccess";
export const CLIENT_ACCESS_LOCKED_EVENT = "crm:client-access-locked";

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.id ?? null;
  } catch (_) {
    return null;
  }
};

export const clearClientAccessGrant = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch (_) {
    /* storage unavailable */
  }
};

export const readClientAccessGrant = () => {
  try {
    const g = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!g?.token || g.userId !== currentUserId() || Date.now() >= g.expiresAt) {
      if (g) clearClientAccessGrant();
      return null;
    }
    return g;
  } catch (_) {
    return null;
  }
};

export const storeClientAccessGrant = (grant) => {
  if (!grant?.token) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token: grant.token, expiresAt: Date.now() + (grant.expiresInSeconds || 900) * 1000, userId: currentUserId() }));
  } catch (_) {
    /* the page simply asks again after a refresh */
  }
};

const authHeaders = ({ grant } = {}) => {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (grant) {
    const g = readClientAccessGrant();
    if (g) headers["X-Client-Access"] = g.token;
  }
  return headers;
};

async function call(method, path, { body, grant = false } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders({ grant }),
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    if (data.accessGrant) storeClientAccessGrant(data.accessGrant); // sliding renewal
    return data;
  }
  if (grant && (data.code === "CLIENT_ACCESS_REQUIRED" || data.code === "CLIENT_ACCESS_EXPIRED")) {
    clearClientAccessGrant();
    window.dispatchEvent(new Event(CLIENT_ACCESS_LOCKED_EVENT));
  }
  const detail = Array.isArray(data.errors) && data.errors.length ? ` (${data.errors.map((e) => e.message).join("; ")})` : "";
  const err = new Error(`${data.message || data.error || "Request failed"}${detail}`);
  err.status = res.status;
  err.code = data.code;
  err.data = data;
  throw err;
}

// ---- access password (Settings + the unlock screen) ----
export const getClientAccessStatus = () => call("GET", "/processperson/client-access/status");
export const setClientAccessPassword = (loginPassword, newPassword, confirmPassword) =>
  call("POST", "/processperson/client-access/set", { body: { loginPassword, newPassword, confirmPassword } });
export const changeClientAccessPassword = (currentPassword, newPassword, confirmPassword) =>
  call("PUT", "/processperson/client-access/change", { body: { currentPassword, newPassword, confirmPassword } });
export const verifyClientAccessPassword = async (password) => {
  const data = await call("POST", "/processperson/client-access/verify", { body: { password } });
  storeClientAccessGrant(data.accessGrant);
  return data;
};
// Ends the access session on the SERVER (the grant is revoked), then forgets it locally.
export const lockClientAccess = async () => {
  try {
    await call("POST", "/processperson/client-access/lock", { grant: true });
  } catch (_) {
    /* the local grant is dropped regardless */
  }
  clearClientAccessGrant();
  window.dispatchEvent(new Event(CLIENT_ACCESS_LOCKED_EVENT));
};
export const renewClientAccessGrant = () => call("POST", "/processperson/client-access/renew", { grant: true });

// ---- Manage Clients (all need the grant; the server also enforces assignment) ----
export const getManagedClients = () => call("GET", "/processperson/managed-clients", { grant: true }).then((d) => d.clients || []);
export const getClientPortalInfo = (customerId) =>
  call("GET", `/processperson/managed-clients/${encodeURIComponent(customerId)}/portal`, { grant: true }).then((d) => d.portal);
export const setClientPortalPassword = (customerId, password, confirmPassword) =>
  call("PUT", `/processperson/managed-clients/${encodeURIComponent(customerId)}/portal/password`, { grant: true, body: { password, confirmPassword } });
export const setClientPortalActive = (customerId, isActive) =>
  call("PATCH", `/processperson/managed-clients/${encodeURIComponent(customerId)}/portal`, { grant: true, body: { isActive } });

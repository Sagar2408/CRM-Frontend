// Client Portal API (identity type "client"). Every call is the client's own data: no customer id is ever
// sent, the server derives it from the verified token.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const clearClientSession = () => {
  ["token", "user", "userType"].forEach((k) => localStorage.removeItem(k));
};

async function call(method, path) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const getClientOverview = () => call("GET", "/client-portal/overview");

export const logoutClient = async () => {
  try {
    await call("POST", "/client-portal/logout");
  } catch (_) {
    /* the local session ends regardless */
  }
  clearClientSession();
};

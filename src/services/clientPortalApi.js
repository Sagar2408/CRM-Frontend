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

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Multipart upload of ONE file; requestName (optional) ties it to a document the case officer requested.
export const uploadClientDocument = async (file, requestName) => {
  const body = new FormData();
  body.append("documents", file);
  if (requestName) body.append("requestName", requestName);
  const res = await fetch(`${API_BASE_URL}/client-portal/documents`, { method: "POST", headers: authHeader(), credentials: "include", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || "Upload failed");
    err.status = res.status;
    throw err;
  }
  return data;
};

// Fetches the client's own file with the bearer token (a plain link cannot send it) and returns a Blob.
export const fetchClientDocumentBlob = async (id, download = false) => {
  const res = await fetch(`${API_BASE_URL}/client-portal/documents/${encodeURIComponent(id)}/file${download ? "?download=1" : ""}`, { headers: authHeader(), credentials: "include" });
  if (!res.ok) {
    const err = new Error("Could not open the document.");
    err.status = res.status;
    throw err;
  }
  return res.blob();
};

export const getClientOverview = () => call("GET", "/client-portal/overview");

export const logoutClient = async () => {
  try {
    await call("POST", "/client-portal/logout");
  } catch (_) {
    /* the local session ends regardless */
  }
  clearClientSession();
};

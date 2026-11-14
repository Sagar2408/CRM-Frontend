import apiService from "./apiService";
import { Navigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Shared headers
const BASE_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Builds an Error carrying the backend's structured fields (e.g.
 * `code: "SUBSCRIPTION_EXPIRED"`, `companyName`, `expiryDate`) so
 * callers can distinguish an expired-subscription login from any other
 * login failure, instead of only getting a flat message string.
 */
function loginError(body, status) {
  const error = new Error(body?.message || body?.error || "Login failed");
  if (body?.code) error.code = body.code;
  if (body?.companyName) error.companyName = body.companyName;
  if (body?.expiryDate) error.expiryDate = body.expiryDate;
  // Lets a caller distinguish "no User account with this email" (404 —
  // safe to try a different identity type, e.g. Process Person) from a
  // real failure against a found account (wrong password, disabled
  // login, expired subscription) that must never be silently retried
  // against another identity type. Added for the Process Person /
  // common-login-page integration — AuthContext.js's login().
  if (typeof status === "number") error.status = status;
  return error;
}

/*------------------------------LOGIN (fetch)---------------------------*/
// The single tenant login. Only credentials and the company code are sent: the
// server resolves the company, finds the account in the right table, and
// returns `identity` (user | hr | manager | processperson | customer) with the
// matching profile object. A role or page identifier is never sent or needed.
export const loginUser = async (email, password, companyCode) => {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: BASE_HEADERS,
    credentials: "include",
    body: JSON.stringify({ email, password, companyCode }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw loginError(err, res.status);
  }

  return await res.json();
};

/*------------------------------MANAGER LOGOUT---------------------------*/
export const logoutManager = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/manager/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Logout failed");
  }

  return await res.json();
};

/*------------------------------HR LOGOUT---------------------------*/
export const logoutHr = async () => {
  const res = await fetch(`${API_BASE_URL}/hr/logout`, {
    method: "POST",
    credentials: "include",
    headers: BASE_HEADERS,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Logout failed");
  }

  return await res.json();
};

/*------------------------------LOGOUT---------------------------*/
export const logoutUser = async (executiveName) => {
  try {
    const token = localStorage.getItem("token");

    const response = await apiService.post(
      "/logout",
      {
        executiveName,
      },
      {
        headers: {
          ...BASE_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      }
    );

    return response;
  } catch (error) {
    console.error("Error in logoutUser:", error);
    throw error;
  }
};

/*------------------------------AUTHENTICATED CHECK---------------------------*/
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  return Boolean(token);
};

/*------------------------------PRIVATE ROUTES---------------------------*/
export const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token || !user?.role) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role.toLowerCase();

  if (!allowedRoles.includes(role)) {
    const fallback = `/${role}`;
    return <Navigate to={fallback} replace />;
  }

  return children;
};

/*------------------------------PUBLIC ROUTES---------------------------*/
export const PublicRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const currentPath = window.location.pathname;

  // If no token, allow access to public routes
  if (!token || !user?.role) return children;

  const role = user.role;

  // Prevent role-based access to wrong route
  if (role === "admin" && !currentPath.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (role === "executive" && !currentPath.startsWith("/executive")) {
    return <Navigate to="/executive" replace />;
  }

  // If current path already matches the role
  return <Navigate to={currentPath} replace />;
};
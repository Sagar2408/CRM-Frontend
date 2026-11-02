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
function loginError(body) {
  const error = new Error(body?.message || "Login failed");
  if (body?.code) error.code = body.code;
  if (body?.companyName) error.companyName = body.companyName;
  if (body?.expiryDate) error.expiryDate = body.expiryDate;
  return error;
}

/*------------------------------LOGIN (fetch)---------------------------*/
export const loginUser = async (email, password, role, companyCode) => {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({
      email,
      password,
      role,
      companyCode,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw loginError(err);
  }

  return await res.json();
};

/*------------------------------MANAGER LOGIN---------------------------*/
export const loginManager = async (email, password, companyCode) => {
  const res = await fetch(`${API_BASE_URL}/manager/login`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({ email, password, companyCode }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw loginError(err);
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

/*------------------------------HR LOGIN---------------------------*/
export const loginHr = async (email, password, companyCode) => {
  const res = await fetch(`${API_BASE_URL}/hr/login`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({ email, password, companyCode }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw loginError(err);
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

/*------------------------------FORGOT PASSWORD---------------------------*/
export const forgotPassword = async (email, companyCode) => {
  try {
    const response = await apiService.post(
      "/forgot-password",
      { email, companyCode },
      {
        headers: BASE_HEADERS,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error || "Failed to send reset link!"
    );
  }
};

/*------------------------------RESET PASSWORD---------------------------*/
export const resetPassword = async (token, newPassword, companyCode) => {
  try {
    const response = await apiService.post(
      "/reset-password",
      {
        token,
        newPassword,
        companyCode,
      },
      {
        headers: BASE_HEADERS,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error || "Failed to reset password!"
    );
  }
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
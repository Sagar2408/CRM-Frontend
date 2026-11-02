import { Navigate, useLocation } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Shared headers
const BASE_HEADERS = {
  "Content-Type": "application/json",
};

// ------------------------------LOGIN--------------------------- //
export const loginUser = async (email, password, companyCode) => {
  const tryLogin = async (userType) => {
    const res = await fetch(`${API_BASE_URL}/${userType}/login`, {
      method: "POST",
      headers: BASE_HEADERS,
      credentials: "include",
      body: JSON.stringify({ email, password, companyCode }),
    });

    if (!res.ok) throw await res.json();
    const data = await res.json();
    localStorage.setItem("userType", userType);
    return { ...data, type: userType };
  };

  try {
    return await tryLogin("customer");
  } catch (err1) {
    try {
      return await tryLogin("processperson");
    } catch (err2) {
      const errorMessage =
        err2?.message || err1?.message || "Login failed for both user types.";
      throw new Error(errorMessage);
    }
  }
};

// ------------------------------SIGNUP--------------------------- //
export const signupUser = async (fullName, email, password, userType = "processperson", companyCode) => {
  const res = await fetch(`${API_BASE_URL}/${userType}/signup`, {
    method: "POST",
    headers: BASE_HEADERS,
    credentials: "include",
    body: JSON.stringify({ fullName, email, password, companyCode }),
  });

  const responseBody = await res.json();
  localStorage.setItem("userType", userType);

  if (!res.ok) {
    console.error("Signup API error details:", responseBody);
    throw new Error(responseBody.error || "Signup failed");
  }

  return responseBody;
};

// ------------------------------LOGOUT--------------------------- //
export const logoutUser = async (userType = "customer") => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/${userType}/logout`, {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Logout failed");
  return data;
};

// ------------------------------UTILITIES--------------------------- //
export const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

export const getUserType = () => {
  const data = localStorage.getItem("userType");
  return data || null;
};

// ------------------------------PRIVATE ROUTES--------------------------- //
export const ProcessPrivateRoute = ({ children }) => {
  return isAuthenticated()
    ? children
    : <Navigate to="/process/client/login" replace />;
};

export const CustomerPrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // Save the full location (even nested) so it can be used post-login
    return <Navigate to="/customer/client/login" state={{ from: location }} replace />;
  }

  return children;
};

export const ProcessPublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const userType = localStorage.getItem("userType");
  const location = useLocation();

  if (!token) return children; // allow login if not authenticated

  // If coming from a protected route (i.e. via Navigate with state), go back to it
  const redirectTo = location.state?.from?.pathname;

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  // Otherwise, go to default dashboard based on userType
  if (userType === "customer") {
    return <Navigate to="/customer/client/dashboard" replace />;
  }

  if (userType === "processperson") {
    return <Navigate to="/process/client/all-clients" replace />;
  }

  return <Navigate to="/customer/client/dashboard" replace />;
};
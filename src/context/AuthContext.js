import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import * as authService from "../services/auth";
import { recordStartWork, recordStopWork } from "../services/executiveService";
import useWorkTimer from "../features/executive/useLoginTimer";
import { ThemeContext } from "../features/admin/ThemeContext";
import { emitSubscriptionExpired } from "../utils/authEvents";
// Removed unused import: import { useBreakTimer } from "./breakTimerContext";

// 1. Create Auth Context
const AuthContext = createContext();

// 2. Auth Provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearTimer, setClearTimer] = useState(false); // Used by workTimer
  const navigate = useNavigate();
  const { forceLightTheme } = useContext(ThemeContext);

  // Initialize work timer with clearTimer and setClearTimer
  useWorkTimer(clearTimer, setClearTimer);
   
  // Initialize user session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    setLoading(false);
  }, []);

  // -----------------------
  // LOGIN
  // -----------------------
  const startWorkTimer = () => {
    if (localStorage.getItem("workStartTime")) return;
    recordStartWork()
      .then((res) => {
        if (res?.activity?.startWorkTime) {
          localStorage.setItem("workStartTime", res.activity.startWorkTime);
        }
      })
      .catch((err) => console.warn("Start work failed after navigation:", err.message));
  };

  const loginSuccessToast = () =>
    toast.success(
      <div className="toast-content">
        <div className="textToast">Login Successful</div>
      </div>,
      { className: "custom-toast", bodyClassName: "custom-toast-body" }
    );

  // Dashboard for each staff role, taken from the role the SERVER verified in
  // the response - never from the page the user logged in on or localStorage.
  const DASHBOARD_BY_ROLE = {
    admin: "/admin",
    executive: "/executive",
    manager: "/manager",
    hr: "/hr",
  };

  // -----------------------
  // LOGIN (one page for every tenant role)
  // -----------------------
  // POST /login with { email, password, companyCode } only. The backend finds
  // the account in the company's identity tables, verifies the password and
  // answers with `identity` (which table matched) plus that table's profile.
  // Process Person and Customer sessions use the same storage keys their own
  // portals have always used, then a full navigation so ProcessAuthContext
  // (mounted once at the app root) picks the session up.
  const login = async (email, password, companyCode) => {
    if (!email || !password || !companyCode) {
      toast.error(<div className="textToast">All fields are required</div>, {
        className: "custom-toast-error",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await authService.loginUser(email, password, companyCode);

      if (response.identity === "processperson" || response.identity === "customer") {
        const isCustomer = response.identity === "customer";
        const type = isCustomer ? "customer" : "processperson";
        const profile = { ...(isCustomer ? response.customer : response.person), type };
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(profile));
        localStorage.setItem("userType", type);
        loginSuccessToast();
        setTimeout(() => {
          window.location.href = isCustomer ? "/customer/client/dashboard" : "/process";
        }, 1500);
        return;
      }

      const staff = response.user || response.hr || response.manager;
      const role = String(staff?.role || "").toLowerCase();
      if (!staff || !DASHBOARD_BY_ROLE[role]) {
        throw new Error("Login succeeded but the account role is not recognised.");
      }

      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(staff));
      if (response.identity === "user") localStorage.setItem("executiveId", staff.id);
      localStorage.removeItem("userType");
      setUser(staff);
      loginSuccessToast();
      startWorkTimer();
      setTimeout(() => navigate(DASHBOARD_BY_ROLE[role]), 2000);
    } catch (err) {
      if (err.code === "SUBSCRIPTION_EXPIRED") {
        emitSubscriptionExpired({
          companyName: err.companyName,
          expiryDate: err.expiryDate,
          message: err.message,
        });
      } else {
        toast.error(
          <div className="textToast">{err.message || "Login Failed"}</div>,
          { className: "custom-toast-error" }
        );
      }
    } finally {
      setLoading(false);
    }
  };


  // Inside AuthProvider

const handleLogoutManager = async () => {
  try {
    setLoading(true);

    await authService.logoutManager(); // <-- call the logout API

    // Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("workStartTime");

    // Reset user state
    setUser(null);
    setClearTimer(true); // stop work timer
    forceLightTheme(); // reset theme if needed
    setTimeout(() => {
      navigate("/login");
    }, 100);
    } catch (err) {
    console.error("Logout failed:", err.message);
    toast.error(
      <div className="textToast">{err.message || "Logout failed"}</div>,
      {
        className: "custom-toast-error",
      }
    );
  } finally {
    setLoading(false);
  }
};


  const handleLogoutHr = async () => {
    try {
      setLoading(true);
  
      await authService.logoutHr(); // <-- call the logout API
  
      // Clear local storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("workStartTime");
  
      // Reset user state
      setUser(null);
      setClearTimer(true); // stop work timer
      forceLightTheme(); // reset theme if needed
      setTimeout(() => {
        navigate("/login");
      }, 100);   
     } catch (err) {
      console.error("Logout failed:", err.message);
      toast.error(
        <div className="textToast">{err.message || "Logout failed"}</div>,
        {
          className: "custom-toast-error",
        }
      );
    } finally {
      setLoading(false);
    }
  };
  // -----------------------
  // LOGOUT
  // -----------------------
  const logout = async () => {
    try {
      await recordStopWork();

      // Clear localStorage and session data
      localStorage.removeItem("workStartTime");
      localStorage.removeItem("breakStartTime");
      localStorage.removeItem("accumulatedBreakTime");
     
     await authService.logoutUser();
     
     localStorage.removeItem("token");
     localStorage.removeItem("user");
     localStorage.removeItem("executiveId");

      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  // -----------------------
  // FORGOT PASSWORD
  // -----------------------
  const forgotPassword = async (email, companyCode) => {
    if (!email || !companyCode) {
      toast.error("Please enter your email and company code!");
      return;
    }

    try {
      setLoading(true);
      const data = await authService.forgotPassword(email, companyCode);
      toast.success(data.message);
      navigate("/login");
    } catch (error) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // RESET PASSWORD
  // -----------------------
  const resetPassword = async (token, newPassword, companyCode) => {
    if (!newPassword || !companyCode) {
      toast.error("Please enter a new password and company code!");
      return;
    }

    try {
      setLoading(true);
      const data = await authService.resetPassword(token, newPassword, companyCode);
      toast.success(data.message);
      navigate("/login");
    } catch (error) {
      toast.error(error.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // CONTEXT RETURN
  // -----------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        forgotPassword,
        resetPassword,
        handleLogoutManager,
        handleLogoutHr,
        isAuthenticated: !!user,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. Custom Hook for Context Access
export const useAuth = () => useContext(AuthContext);
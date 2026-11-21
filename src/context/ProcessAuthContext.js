import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginUser,
  signupUser,
  logoutUser,
} from "../services/processAuth";
import { useProcessService } from "./ProcessServiceContext";
import { toast } from "react-toastify";
import { clearClientAccessGrant } from "../services/clientAccess";
//Create Context
const ProcessContext = createContext();

//Provider Component
export const ProcessProvider = ({ children }) => {
  const [user, setUser] = useState(null);        
  const [loading, setLoading] = useState(false);  
   const{stopWork}=useProcessService();
   const navigate=useNavigate();
// ---------------------------------------
// Load session from localStorage on refresh
// ---------------------------------------
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

// ---------------------------------------
// Login Handler
// ---------------------------------------
  const login = async (email, password, companyCode) => {
    setLoading(true);
    try {
      const data = await loginUser(email, password, companyCode);

      const userPayload = {
        ...(data.customer || data.person),
        type: data.type, // ✅ Important for type-based UI control
      };

      setUser(userPayload);

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      localStorage.setItem("user", JSON.stringify(userPayload));
      toast.success(
        <div className="toast-content">
          <div className="textToast">Login Successful</div>
        </div>,
        {
          className: "custom-toast",
          bodyClassName: "custom-toast-body",
        }
      );

      return data;
    } catch (error) {
      toast.error(
        <div className="textToast">{error.message || "Login Failed"}</div>,
        {
          className: "custom-toast-error",
        }
      );
      throw error;
    } finally {
      setLoading(false);
    }
  };

// ---------------------------------------
// Signup Handler
// ---------------------------------------
const signup = async (fullName, email, password, userType, companyCode) => {
  setLoading(true);
  try {
    const data = await signupUser(fullName, email, password, userType, companyCode);
    toast.success(
      <div className="toast-content">
        <div className="textToast">Signup Successful</div>
      </div>,
      {
        className: "custom-toast",
        bodyClassName: "custom-toast-body",
      }
    );

    return data;
  } catch (error) {
    toast.error(
      <div className="textToast">{error.message || "Signup Failed"}</div>,
      {
        className: "custom-toast-error",
      }
    );
    throw error;
  } finally {
    setLoading(false);
  }
};

// ---------------------------------------
// Logout Handler
// ---------------------------------------
  // Order matters: the work session must be closed while the access token is still
  // valid (logout revokes it), then the server-side session is revoked, and only then
  // is local state cleared. Every step is bounded: a failed call never leaves the
  // user stuck on a protected page - the local session always ends and we always
  // land on /login.
  const logout = async () => {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem("user") || "{}") || {};
    } catch (_) {
      stored = {};
    }
    const userType = user?.type || stored.type || localStorage.getItem("userType") || "customer";
    const userId = user?.id || stored.id;
    try {
      if (userType === "processperson" && userId) {
        try {
          await stopWork(userId);
        } catch (error) {
          console.error("Could not close the work session:", error.message);
        }
      }
      await logoutUser(userType);
    } catch (error) {
      console.error("Logout failed:", error.message);
    } finally {
      clearClientAccessGrant(); // Manage Clients must ask for its password again after a new sign-in
      setUser(null);
      ["user", "token", "userType", "workStartTime", "breakStartTime", "pausedBreakSeconds"].forEach((k) =>
        localStorage.removeItem(k)
      );
      try {
        sessionStorage.removeItem("navStack");
      } catch (_) {
        /* ignore */
      }
      navigate("/login", { replace: true });
    }
  };

// ---------------------------------------
// Provider Return
// ---------------------------------------
  return (
    <ProcessContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </ProcessContext.Provider>
  );
};

//Custom Hook
export const useProcess = () => useContext(ProcessContext);
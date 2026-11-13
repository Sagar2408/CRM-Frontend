import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginUser,
  signupUser,
  logoutUser,
} from "../services/processAuth";
import { useProcessService } from "./ProcessServiceContext";
import { toast } from "react-toastify";
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
  const logout = async () => {
    try {
      const userType = user?.type || "customer";
      await logoutUser(userType);
      await stopWork(user?.id)
       navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error.message);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
       localStorage.removeItem("workStartTime");
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
// --- App.js ---
import { Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "./services/auth";
import Login from "./features/authentication/Login";
import CompanyAdminSignup from "./features/authentication/CompanyAdminSignup";
import LoginMaster from "./features/masteruser/LoginMaster";
import SignupMaster from "./features/masteruser/SignupMaster";
import { PrivateMasterRoute } from './context/MasterContext';
import ForgotPassword from "./features/authentication/ForgotPassword";
import ResetPassword from "./features/authentication/ResetPassword";
import AdminRoutes from "./routes/AdminRoutes";
import ExecutiveRoutes from "./routes/ExecutiveRoutes";
import ChatBotRoutes from "./routes/ChatBotRoutes";
import LeadAssignRoutes from "./routes/LeadAssignRoute";
import { useState, useEffect } from "react";
import { ThemeProvider } from "./features/admin/ThemeContext";
import { useLocation } from "react-router-dom"; // ✅ at the top of App.js
import AdminPanelRoutes from "./routes/MonitoringRoutes";
import MasterRoutes from "./routes/MasterRoutes";
import ProcessRoutes from "./routes/ProcessRoutes";
import ClientSignup from "./features/process-client/ClientSignup";
import ExecutiveFormRoutes from "./routes/ExecutiveFormRoutes";
import { CustomerPrivateRoute } from "./services/processAuth";
import { ProcessPrivateRoute } from "./services/processAuth";
import ManagerRoutes from "./routes/ManagerRoutes";
import HrRoutes from "./routes/HrRoutes";
import SettingsRouteWrapper from "./routes/SettingsRouteWrapper";
import ProcessDashboardRoutes from "./routes/ProcessDashboardRoutes";
import ClientCustomerRoutes from "./routes/ClientCustomer";
import SessionTimeout from "./features/authentication/SessionTimeout";
import InsufficientBalanceModal from "./features/authentication/InsufficientBalanceModal";
import PresenceConnector from "./features/PresenceConnector";
const App = () => {
  const [followUpText, setFollowUpText] = useState(() => {
    const saved = localStorage.getItem('followUpText');
    return saved || "";
  });
  const location = useLocation(); // ✅ Add this

useEffect(() => {
  console.log("Path changed:", location.pathname);
}, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('followUpText', followUpText);
  }, [followUpText]);
  useEffect(() => {
    const handlePopState = (event) => {
      const token = localStorage.getItem("token");
      if (token) {
        // Prevent going back to public routes
        const restrictedPaths = ["/login", "/signup", "/forgot-password",
           "/reset-password","/process/client/login","/process/customer/login"];     
         if (restrictedPaths.includes(window.location.pathname)) {
          window.history.go(1); // Push forward
        }
      }
    };
  
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  return (
    <ThemeProvider>
      <SessionTimeout timeout={45 * 60 * 1000} />
      <InsufficientBalanceModal />
      <PresenceConnector />

      <Routes>
      {/* One login for every tenant role. The old role-specific URLs just forward to it. */}
      <Route path="/login" element={<Login />} />
      {["/admin/login", "/manager/login", "/hr/login", "/process/client/login", "/customer/client/login"].map((p) => (
        <Route key={p} path={p} element={<Navigate to="/login" replace />} />
      ))}
      <Route path="/admin/signup" element={<CompanyAdminSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Public master routes - login & signup */}
        <Route path="/master/loginmaster" element={<LoginMaster />} />
        <Route path="/master/signupmaster" element={<SignupMaster />} />
        <Route path="/process/client/signup" element={<ClientSignup />} />
        
        <Route
  path="/executive/settings/*"
  element={
    <PrivateRoute allowedRoles={["executive"]}>
      <SettingsRouteWrapper />
    </PrivateRoute>
  }
/>
 <Route path="/executiveform/*" element={<PrivateRoute><ExecutiveFormRoutes/></PrivateRoute>} />

        <Route path="/master/*" element={
          <PrivateMasterRoute>
            <MasterRoutes />
          </PrivateMasterRoute>
        } />   
         
        <Route path="/monitoring/*" element={<PrivateRoute><AdminPanelRoutes /></PrivateRoute>} />

        <Route 
  path="/admin/*" 
  element={
    <PrivateRoute allowedRoles={["admin"]}>
      <AdminRoutes />
    </PrivateRoute>
  } 
/>
<Route 
  path="/executive/*" 
  element={
    <PrivateRoute allowedRoles={["executive"]}>
      <ExecutiveRoutes onTextUpdate={setFollowUpText} />
    </PrivateRoute>
  }
/>
<Route path="/process/*" element={<ProcessPrivateRoute><ProcessRoutes /></ProcessPrivateRoute>} /> 
<Route path="/processperson/*" element={<ProcessDashboardRoutes />} />      
<Route path="/customer/*" element={ <CustomerPrivateRoute>
            <ClientCustomerRoutes />
          </CustomerPrivateRoute>} />
<Route 
  path="/manager/*" 
  element={
    <PrivateRoute allowedRoles={["manager"]}>
      <ManagerRoutes />
    </PrivateRoute>
  } 
/>
{/* Team Lead no longer exists as a role (former Team Leads are Managers): the old URL just forwards to the login. */}
<Route path="/team-lead/*" element={<Navigate to="/login" replace />} />
<Route 
  path="/hr/*" 
  element={
    <PrivateRoute allowedRoles={["hr"]}>
      <HrRoutes />
    </PrivateRoute>
  } 
/>
    
        <Route
  path="/executive/chatbot/*"
  element={
    <PrivateRoute allowedRoles={["executive"]}>
      <ChatBotRoutes />
    </PrivateRoute>
  }
/>
        <Route path="/leadassign/*" element={<PrivateRoute><LeadAssignRoutes /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </ThemeProvider>
  );
};

export default App;
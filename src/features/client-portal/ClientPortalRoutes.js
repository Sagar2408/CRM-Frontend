import React from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import ClientPortalDashboard from "./ClientPortalDashboard";

// Only a Client Portal session (userType "client" + a token) may open /client-portal. Staff, Process
// Person and legacy customer sessions are sent to the login page; the server re-checks the token anyway.
export const ClientPortalPrivateRoute = ({ children }) => {
  const ok = !!localStorage.getItem("token") && localStorage.getItem("userType") === "client";
  return ok ? children : <Navigate to="/login" replace />;
};

const ClientPortalRoutes = () => (
  <Routes>
    <Route index element={<ClientPortalDashboard />} />
    <Route path="*" element={<Navigate to="/client-portal" replace />} />
  </Routes>
);

export default ClientPortalRoutes;

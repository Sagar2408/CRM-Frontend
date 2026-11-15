import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProcessLayout from "../layouts/ProcessLayout";
import ClientDash from "../features/process-client/ClientDash";
import ClientSetting from "../features/process-client/ClientSetting";
import ClientUpload from "../features/process-client/ClientUpload";
import CreateClient from "../features/process-client/CreateClient";
import AllClient from "../features/process-client/AllClient";
import "../styles/process.css";

// Manage Client portal (/processperson/client/*): same shell as the Process panel,
// with the portal menu. Pages and paths are unchanged.
const ProcessDashboardRoutes = () => (
  <Routes>
    <Route element={<ProcessLayout portal />}>
      <Route path="client/settings" element={<ClientSetting />} />
      <Route path="client/upload/:id" element={<ClientUpload />} />
      <Route path="client/dashboard/:id" element={<ClientDash />} />
      <Route path="client/create-client" element={<CreateClient />} />
      <Route path="client/all-clients" element={<AllClient />} />
      <Route path="*" element={<Navigate to="client/all-clients" replace />} />
    </Route>
  </Routes>
);

export default ProcessDashboardRoutes;

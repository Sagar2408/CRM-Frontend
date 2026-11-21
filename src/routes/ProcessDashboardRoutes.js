import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProcessLayout from "../layouts/ProcessLayout";
import ClientDash from "../features/process-client/ClientDash";
import ClientSetting from "../features/process-client/ClientSetting";
import ClientUpload from "../features/process-client/ClientUpload";
import CreateClient from "../features/process-client/CreateClient";
import AllClient from "../features/process-client/AllClient";
import ManageClientsGate from "../features/manage-clients/ManageClientsGate";
import "../styles/process.css";

// Manage Client portal (/processperson/client/*): same shell as the Process panel,
// with the portal menu. Pages and paths are unchanged.
const ProcessDashboardRoutes = () => (
  <Routes>
    {/* Nothing under Manage Clients renders until the Client Portal Access Password is verified. */}
    <Route element={<ProcessLayout portal />}>
      <Route path="client/settings" element={<ManageClientsGate><ClientSetting /></ManageClientsGate>} />
      <Route path="client/upload/:id" element={<ManageClientsGate><ClientUpload /></ManageClientsGate>} />
      <Route path="client/dashboard/:id" element={<ManageClientsGate><ClientDash /></ManageClientsGate>} />
      <Route path="client/create-client" element={<ManageClientsGate><CreateClient /></ManageClientsGate>} />
      <Route path="client/all-clients" element={<ManageClientsGate><AllClient /></ManageClientsGate>} />
      <Route path="*" element={<Navigate to="/processperson/client/all-clients" replace />} />
    </Route>
  </Routes>
);

export default ProcessDashboardRoutes;

import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route, Navigate } from "react-router-dom";
import ProcessReportCard from "../features/process-client/ProcessReportCard";
import NewsComponent from "../features/executive/NewsComponent";
import ClientRoutes from "./ClientRoutes";
import CustomerRoutes from "./CustomerRoutes";
import NotificationRoutes from "./NotificationRoutes";
import ChatBotRoutes from "./ChatBotRoutes";
import ElsaAI from "../features/chatbot/ElsaAI";
import ClientDash from "../features/process-client/ClientDash";
import ClientSetting from "../features/process-client/ClientSetting";
import ClientUpload from "../features/process-client/ClientUpload";
import CreateClient from "../features/process-client/CreateClient";
import AllClient from "../features/process-client/AllClient";
import { useProcess } from "../context/ProcessAuthContext";
import "../styles/process.css";
import ProcessLayout from "../layouts/ProcessLayout";
import ProcessFreshlead from "../features/freshLeads/ProcessFreshlead";
import ProcessFollowUpRoutes from "./ProcessFollowupRoutes";
import ProcessStagePage from "../features/process-client/ProcessStagePage";
import ProcessRejectedClients from "../features/process-client/ProcessRejectedClients";
import ProcessMeetingRoutes from "./ProcessMeetingRoutes";
import ProcessNotification from "../features/process-client/ProcessNotification";
import ProcessSettingsRoutes from "./ProcessSettingsRoutes";

const ProcessRoutes = () => {
  const { user } = useProcess();

  return (
    <Routes>
      <Route path="/" element={<ProcessLayout />}>
        {/* Dashboard: stats cards + the same Latest Immigration News as the Executive dashboard */}
        <Route
          index
          element={
            <>
              <ProcessReportCard />
              <NewsComponent />
            </>
          }
        />
        <Route path="freshlead" element={<ProcessFreshlead />} />
        <Route path="process-follow-up/*" element={<ProcessFollowUpRoutes />} />
        <Route path="clients/*" element={<ClientRoutes />} />
        <Route path="customer/*" element={<CustomerRoutes />} />
        <Route path="rejected-leads/*" element={<ProcessRejectedClients />} />
        <Route path="finalstage-leads/*" element={<ProcessStagePage mode="final" />} />
        <Route path="completed-clients/*" element={<ProcessStagePage mode="completed" />} />
        <Route path="schedule/*" element={<ProcessMeetingRoutes />} />
        {/* Invoice is not part of the Process Person panel; stale links land on the dashboard. */}
        <Route path="invoice/*" element={<Navigate to="/process" replace />} />
        {/* The Executive settings screens are not used here; Process Person has its own. */}
        <Route path="settings/*" element={<Navigate to="/process/process-settings" replace />} />
        <Route path="notification/*" element={<NotificationRoutes />} />
        <Route path="chat/*" element={<ChatBotRoutes />} />
        <Route path="elsa" element={<ElsaAI />} />
        <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />
        <Route path="process-settings/*" element={<ProcessSettingsRoutes />} />
        <Route path="client/dashboard" element={<ClientDash />} />
        <Route path="client/settings" element={<ClientSetting />} />
        <Route path="client/upload" element={<ClientUpload />} />
        <Route path="client/notifications" element={<ProcessNotification />} />
        {user?.type === "processperson" && (
          <>
            <Route path="client/upload/:id" element={<ClientUpload />} />
            <Route path="client/dashboard/:id" element={<ClientDash />} />
            <Route path="client/create-client" element={<CreateClient />} />
            <Route path="client/all-clients" element={<AllClient />} />
          </>
        )}
      </Route>
    </Routes>
  );
};

export default ProcessRoutes;

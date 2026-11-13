import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route, Navigate } from "react-router-dom";
import ExecutiveLayout from "../layouts/ExecutiveLayout";
import ReportCard from "../features/executive/ReportCard";
import NewsComponent from "../features/executive/NewsComponent";
import FreshLeadRoutes from "./FreshLeadRoutes";
import FollowUpRoutes from "./FollowUpRoutes";
import ClientRoutes from "./ClientRoutes";
import ExecutiveConvertedLeads from "../features/convert-customer/ExecutiveConvertedLeads";
import CloseLeadRoutes from "./CloseLeadRoutes";
import ScheduleRoutes from "./ScheduleRoutes";
import SettingRoutes from "./SettingRoutes";
import NotificationRoutes from "./NotificationRoutes";
import ChatBotRoutes from "./ChatBotRoutes";
import ElsaAI from "../features/chatbot/ElsaAI";
import RequirePermission from "../features/admin-settings/RequirePermission";

const ExecutiveRoutes = ({onTextUpdate}) => {
  return (
      <Routes>
        <Route path="/" element={<ExecutiveLayout />}>
          {/* ✅ All routes below are now wrapped with Sidebar + Navbar */}
  
          {/* Dashboard homepage */}
          <Route index element={<><ReportCard /><NewsComponent /></>} />
  
          {/* Fresh Leads */}
          <Route path="freshlead/*" element={<FreshLeadRoutes />} />
          <Route path="follow-up/*" element={<FollowUpRoutes onTextUpdate={onTextUpdate} />} />  
          <Route path="clients/*" element={<ClientRoutes />} />
          <Route path="customer/*" element={<ExecutiveConvertedLeads />} />
          <Route path="close-leads/*" element={<CloseLeadRoutes />} />
          <Route path="schedule/*" element={<ScheduleRoutes />} />
          {/* The old hard-coded Invoice page was removed from the Executive panel; stale bookmarks land on the dashboard. */}
          <Route path="invoice/*" element={<Navigate to="/executive" replace />} />
          <Route path="settings/*" element={<SettingRoutes />} />
          <Route path="notification/*" element={
            <RequirePermission requiredKey="push_notifications">
            <NotificationRoutes />
            </RequirePermission>} />
          <Route path="chat/*" element={<ChatBotRoutes />} />
          <Route path="elsa" element={<ElsaAI />} />
          <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />

        </Route>
      </Routes>
    );
  };
  

export default ExecutiveRoutes;

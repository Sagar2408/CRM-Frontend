import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route } from "react-router-dom";
import ExecutiveLayout from "../layouts/ExecutiveLayout";
import ReportCard from "../features/executive/ReportCard";
import NewsComponent from "../features/executive/NewsComponent";
import FreshLeadRoutes from "./FreshLeadRoutes";
import FollowUpRoutes from "./FollowUpRoutes";
import ClientRoutes from "./ClientRoutes";
import CustomerRoutes from "./CustomerRoutes";
import CloseLeadRoutes from "./CloseLeadRoutes";
import ScheduleRoutes from "./ScheduleRoutes";
import InvoicePage from "../features/Invoice/InvoicePage";
import "../styles/invoice.css"; 
import SettingRoutes from "./SettingRoutes";
import NotificationRoutes from "./NotificationRoutes";
import ChatBotRoutes from "./ChatBotRoutes";
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
          <Route path="customer/*" element={<CustomerRoutes />} />
          <Route path="close-leads/*" element={<CloseLeadRoutes />} />
          <Route path="schedule/*" element={<ScheduleRoutes />} />
          <Route path="invoice" element={
            <RequirePermission requiredKey="invoice">
            <InvoicePage />
            </RequirePermission>} />
          <Route path="settings/*" element={<SettingRoutes />} />
          <Route path="notification/*" element={
            <RequirePermission requiredKey="push_notifications">
            <NotificationRoutes />
            </RequirePermission>} />
          <Route path="chat/*" element={<ChatBotRoutes />} />
          <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />

          {/* Invoice, Schedule, etc. */}
          {/* <Route path="invoice/*" element={<InvoiceRoutes />} /> */}
          {/* Add others as needed */}
        </Route>
      </Routes>
    );
  };
  

export default ExecutiveRoutes;

import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route } from "react-router-dom";
import AssignTask from "../features/admin/AssignTask";
import ExecutiveDetails from "../features/admin/ExecutiveDetails";
import ManagerSettings from "../features/manager/ManagerSettings";
import SupportTickets from "../features/admin/SupportTickets";
import AdminNotification from "../features/admin/AdminNotification"
// [EOD DISABLED] import Eod from "../features/admin/Eod";
import AttendanceTable from "../features/admin/AttendanceTable";
import RequirePermission from "../features/admin-settings/RequirePermission";
import ManagerLayout from "../layouts/ManagerLayout";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import ExecutiveCredentialsForm from "../features/admin/ExecutiveCredentialsForm";
import CRMTeamsInterface from "../features/manager/Team";
import MyLeave from "../features/hr/MyLeave";
const ManagerRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<ManagerLayout />}>
        <Route path="assign-task" element={
            <RequirePermission requiredKey="assign_task">
                <AssignTask />
            </RequirePermission>} />
        <Route path="executive-details" element={
            <RequirePermission requiredKey="executive_details">
            <ExecutiveDetails />
            </RequirePermission>} />
        <Route path="settings" element={
            <RequirePermission requiredKey="settings">
            <ManagerSettings />
            </RequirePermission>} />
        <Route path="notification" element={
          <RequirePermission requiredKey="push_notifications">
          <AdminNotification />
          </RequirePermission>} />
        <Route path="monitoring" element={
          <RequirePermission requiredKey="monitoring">
          <Monitoring />
          </RequirePermission>} />
        <Route path="leadassign" element={
          <RequirePermission requiredKey="task_management">
          <TaskManagement />
          </RequirePermission>} />
        <Route path="executiveform" element={
          <RequirePermission requiredKey="user_management">
          <ExecutiveCredentialsForm />
          </RequirePermission>} />
        <Route path="help-support" element={<RequirePermission requiredKey="weekly_summary"><SupportTickets /></RequirePermission>}/>
        <Route path="my-leave" element={<RequirePermission requiredKey="account_updates"><MyLeave /></RequirePermission>} />
        {/* [EOD DISABLED] see DISABLED_FEATURES.md
        <Route path="eod-report" element={
            <RequirePermission requiredKey="reporting">
            <Eod />
            </RequirePermission>} /> 
        */}
        <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />
        <Route path="executive-attendance" element={<RequirePermission requiredKey="executive_details"><AttendanceTable /></RequirePermission>} />
        <Route path="teams" element={<RequirePermission requiredKey="executive_details"><CRMTeamsInterface /></RequirePermission>} />

      </Route>
    </Routes>
  );
};

export default ManagerRoutes;

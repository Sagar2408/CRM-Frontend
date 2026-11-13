import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route, Navigate } from "react-router-dom";
import AssignTask from "../features/admin/AssignTask";
import AttendanceTable from "../features/admin/AttendanceTable";
import RequirePermission from "../features/admin-settings/RequirePermission";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import HrLayout from "../layouts/HrLayout";
import LeaveManagement from "../features/hr/LeaveManagement";
import HrNotification from "../features/hr/HrNotification";
import HrSettings from "../features/hr/HrSettings";
import PayrollSystem from "../features/hr/PayrollSystem";
import { EmployeeManagement, HrTeamManagement } from "../features/hr/HrWrappers";
import SupportTickets from "../features/admin/SupportTickets";

// Every route is wrapped in the Page Access Control key that the sidebar entry
// uses (layouts/navConfig.js) - hiding a link is never the only protection - and
// the API behind each page enforces the same key on the server.
const HrRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HrLayout />}>
        {/* HR workspace */}
        <Route path="employees" element={<RequirePermission requiredKey="user_management"><EmployeeManagement /></RequirePermission>} />
        <Route path="team-management" element={<RequirePermission requiredKey="executive_details"><HrTeamManagement /></RequirePermission>} />
        <Route path="executive-attendance" element={<RequirePermission requiredKey="executive_details"><AttendanceTable /></RequirePermission>} />
        <Route path="leave-management" element={<RequirePermission requiredKey="account_updates"><LeaveManagement /></RequirePermission>} />
        <Route path="payroll" element={<RequirePermission requiredKey="billing"><PayrollSystem /></RequirePermission>} />
        <Route path="help-support" element={<RequirePermission requiredKey="weekly_summary"><SupportTickets /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission requiredKey="settings"><HrSettings /></RequirePermission>} />

        {/* Pages the Admin may additionally enable (unchanged) */}
        <Route path="assign-task" element={<RequirePermission requiredKey="assign_task"><AssignTask /></RequirePermission>} />
        <Route path="leadassign" element={<RequirePermission requiredKey="task_management"><TaskManagement /></RequirePermission>} />
        <Route path="monitoring" element={<RequirePermission requiredKey="monitoring"><Monitoring /></RequirePermission>} />
        <Route path="notification" element={<RequirePermission requiredKey="push_notifications"><HrNotification /></RequirePermission>} />
        <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />

        {/* Old URLs: Create Executive -> Employee Management, Executive Details -> Team Management */}
        <Route path="executiveform" element={<Navigate to="/hr/employees" replace />} />
        <Route path="executive-details" element={<Navigate to="/hr/team-management" replace />} />
        <Route path="Payroll" element={<Navigate to="/hr/payroll" replace />} />
        {/* [EOD DISABLED] see DISABLED_FEATURES.md */}
      </Route>
    </Routes>
  );
};

export default HrRoutes;

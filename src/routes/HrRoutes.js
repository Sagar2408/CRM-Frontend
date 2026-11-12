

import React from "react";
import { Routes, Route } from "react-router-dom";
import AssignTask from "../features/admin/AssignTask";
import ExecutiveDetails from "../features/admin/ExecutiveDetails";
import ContactUs from "../features/admin/ContactUs";
// [EOD DISABLED] import Eod from "../features/admin/Eod";
import AttendanceTable from "../features/admin/AttendanceTable";
import RequirePermission from "../features/admin-settings/RequirePermission";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import ExecutiveCredentialsForm from "../features/admin/ExecutiveCredentialsForm";
import HrLayout from "../layouts/HrLayout";
import LeaveManagement from "../features/hr/LeaveManagement";
import HrNotification from "../features/hr/HrNotification";
import HrSettings from "../features/hr/HrSettings";
import PayrollSystem from "../features/hr/PayrollSystem";
const HrRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HrLayout />}>
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
            <HrSettings />
            </RequirePermission>} />
       <Route path="notification" element={
          <RequirePermission requiredKey="push_notifications">
          <HrNotification />
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
        <Route path="help-support" element ={<ContactUs/>}/>
        <Route path="leave-management" element ={<LeaveManagement/>}/>
        {/* [EOD DISABLED] see DISABLED_FEATURES.md
        <Route path="eod-report" element={
            <RequirePermission requiredKey="reporting">
            <Eod />
            </RequirePermission>} /> 
        */}
        <Route path="executive-attendance" element={<AttendanceTable />} />
       <Route path="Payroll" element={<PayrollSystem />} />

      </Route>
    </Routes>
  );
};

export default HrRoutes;


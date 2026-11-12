import React from "react";
import { Routes, Route } from "react-router-dom";
import AssignTask from "../features/admin/AssignTask";
import ExecutiveDetails from "../features/admin/ExecutiveDetails";
import ManagerSettings from "../features/manager/ManagerSettings";
import ContactUs from "../features/admin/ContactUs";
import AdminNotification from "../features/admin/AdminNotification"
// [EOD DISABLED] import Eod from "../features/admin/Eod";
import AttendanceTable from "../features/admin/AttendanceTable";
import RequirePermission from "../features/admin-settings/RequirePermission";
import ManagerLayout from "../layouts/ManagerLayout";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import ExecutiveCredentialsForm from "../features/admin/ExecutiveCredentialsForm";
import CRMTeamsInterface from "../features/manager/Team";
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
          <RequirePermission requiredKey="task_managment">
          <TaskManagement />
          </RequirePermission>} />
        <Route path="executiveform" element={
          <RequirePermission requiredKey="user_managment">
          <ExecutiveCredentialsForm />
          </RequirePermission>} />
        <Route path="help-support" element ={<ContactUs/>}/>
        {/* [EOD DISABLED] see DISABLED_FEATURES.md
        <Route path="eod-report" element={
            <RequirePermission requiredKey="reporting">
            <Eod />
            </RequirePermission>} /> 
        */}
        <Route path="executive-attendance" element={<AttendanceTable />} />
        <Route path="teams" element={<CRMTeamsInterface />} />

      </Route>
    </Routes>
  );
};

export default ManagerRoutes;

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import AssignTask from "../features/admin/AssignTask";
import TeamManagement from "../features/teams/TeamManagement";
import AdminSettings from "../features/admin-settings/AdminSettings";
import SupportTickets from "../features/admin/SupportTickets";
import AdminNotification from "../features/admin/AdminNotification"
// [EOD DISABLED] import Eod from "../features/admin/Eod";
import AttendanceTable from "../features/admin/AttendanceTable";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import UserManagement from "../features/admin/user-management/UserManagement";
import ExecutiveAssignments from "../features/admin/ExecutiveAssignments";
import Messages from "../features/Messaging/Messages";
import ElsaAI from "../features/chatbot/ElsaAI";
import FullReport from "../features/admin/FullReport";
import Hierarchy from "../features/admin/Hierarchy";
import Verify from "../features/verification/Verify";
const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route path="assign-task" element={<AssignTask />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="leadassign" element={<TaskManagement />} />
        <Route path="executiveform" element={<UserManagement />} />
        <Route path="team-management" element={<TeamManagement />} />
        {/* Executive Details was replaced by Team Management for Admin; keep old links/bookmarks working. */}
        <Route path="executive-details" element={<Navigate to="/admin/team-management" replace />} />
        <Route path="executive-assignments" element={<ExecutiveAssignments/>} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="notification" element={<AdminNotification />} />
        <Route path="help-support" element ={<SupportTickets/>}/>
        {/* [EOD DISABLED] see DISABLED_FEATURES.md
        <Route path="eod-report" element={<Eod />} /> */}
        <Route path="messaging" element={<Messages/>}/>
        {/* ELSA AI: the same workspace as the Executive / Manager / Process panels (Admin chats are stored under their own agent type). */}
        <Route path="elsa" element={<ElsaAI />} />
        <Route path="chat" element={<Navigate to="/admin/elsa" replace />} />
        <Route path="executive-attendance" element={<AttendanceTable />} />
        <Route path="full-report" element={<FullReport />} />
        <Route path="heirarchy" element={<Hierarchy/>}/>
        <Route path="hierarchy" element={<Hierarchy/>}/>
        <Route path="verify" element={<Verify/>}/>

      </Route>
    </Routes>
  );
};

export default AdminRoutes;

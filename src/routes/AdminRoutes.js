import React from "react";
import { Routes, Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import AssignTask from "../features/admin/AssignTask";
import ExecutiveDetails from "../features/admin/ExecutiveDetails";
import AdminSettings from "../features/admin-settings/AdminSettings";
import ContactUs from "../features/admin/ContactUs";
import AdminNotification from "../features/admin/AdminNotification"
import Eod from "../features/admin/Eod";
import AttendanceTable from "../features/admin/AttendanceTable";
import Monitoring from "../features/admin/Monitoring";
import TaskManagement from "../features/LeadAssign/TaskManagement";
import ExecutiveCredentialsForm from "../features/admin/ExecutiveCredentialsForm";
import ExecutiveAssignments from "../features/admin/ExecutiveAssignments";
import Messages from "../features/Messaging/Messages";
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
        <Route path="executiveform" element={<ExecutiveCredentialsForm />} />
        <Route path="executive-details" element={<ExecutiveDetails />} />
        <Route path="executive-assignments" element={<ExecutiveAssignments/>} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="notification" element={<AdminNotification />} />
        <Route path="help-support" element ={<ContactUs/>}/>
        <Route path="eod-report" element={<Eod />} /> {/* ✅ EOD route added here */}
        <Route path="messaging" element={<Messages/>}/>
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

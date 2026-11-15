import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SettingsLayout from "../features/settings/SettingLayout";
import ProcessMyProfile from "../features/process-client/ProcessMyProfile";
import Theme from "../features/settings/Theme";
import BeepSound from "../features/settings/BeepSound";
import EmployeeLeave from "../features/settings/EmployeeLeave";

// /process/process-settings/*: the same four sections as the Executive Settings page
// (profile, theme, beep, leave), inside the Process Person shell. There is no page-access
// permission for Process Person, so the layout's Executive permission guard is off.
const ProcessSettingsRoutes = () => (
  <Routes>
    <Route element={<SettingsLayout permissionKey={null} />}>
      <Route index element={<Navigate to="profile" replace />} />
      <Route path="profile" element={<ProcessMyProfile />} />
      <Route path="theme" element={<Theme />} />
      <Route path="change-beep" element={<BeepSound />} />
      <Route path="leave" element={<EmployeeLeave allowAttachment={false} />} />
      <Route path="*" element={<Navigate to="profile" replace />} />
    </Route>
  </Routes>
);

export default ProcessSettingsRoutes;

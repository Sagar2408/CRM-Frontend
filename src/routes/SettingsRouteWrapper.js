// SettingsRouteWrapper.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ExecutiveLayout from "../layouts/ExecutiveLayout";
import SettingsLayout from "../features/settings/SettingLayout";
import MyProfile from "../features/settings/MyProfile";
import Theme from "../features/settings/Theme";
import BeepSound from "../features/settings/BeepSound";
import EmployeeLeave from "../features/settings/EmployeeLeave";

const SettingsRouteWrapper = () => {
  return (
    <Routes>
      {/* Same shell as every other Executive page (sidebar, header, .exec-shell-root styles). */}
      <Route path="/" element={<ExecutiveLayout />}>
       <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<MyProfile />} />
        <Route path="theme" element={<Theme />} />
        <Route path="change-beep" element={<BeepSound />} />
        <Route path="leave" element={<EmployeeLeave />} />
        {/* Password management is Admin-controlled and email templates are not part of
            Executive Settings, so the old /change-password and /create-template URLs
            fall back to the profile page. */}
        <Route path="*" element={<Navigate to="profile" replace />} />
       </Route>
      </Route>
    </Routes>
  );
};

export default SettingsRouteWrapper;

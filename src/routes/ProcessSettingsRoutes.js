import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SettingsLayout, { settingsMenuItems } from "../features/settings/SettingLayout";
import ProcessDocumentSettings from "../features/process-client/ProcessDocumentSettings";
import ProcessClientAccessSettings from "../features/process-client/ProcessClientAccessSettings";
import ProcessMyProfile from "../features/process-client/ProcessMyProfile";
import Theme from "../features/settings/Theme";
import BeepSound from "../features/settings/BeepSound";
import EmployeeLeave from "../features/settings/EmployeeLeave";

// /process/process-settings/*: the same four sections as the Executive Settings page
// (profile, theme, beep, leave), inside the Process Person shell. There is no page-access
// permission for Process Person, so the layout's Executive permission guard is off.
// Process Person adds a Documents section (the list offered by Document Collection follow-ups).
const processMenuItems = [
  ...settingsMenuItems,
  { path: "documents", label: "Documents", hint: "Document types for follow-ups", icon: "📄" },
  { path: "client-access", label: "Client Portal Access Password", hint: "Protects Manage Clients", icon: "🔐" },
];

// Absolute on purpose: this component is mounted under the splat route "process-settings/*", where
// relative links / redirects ("profile") resolve against the CURRENT url and append forever
// (/process-settings/profile/profile/...).
export const PROCESS_SETTINGS_BASE = "/process/process-settings";

const ProcessSettingsRoutes = () => (
  <Routes>
    <Route element={<SettingsLayout permissionKey={null} menuItems={processMenuItems} basePath={PROCESS_SETTINGS_BASE} />}>
      <Route index element={<Navigate to={`${PROCESS_SETTINGS_BASE}/profile`} replace />} />
      <Route path="profile" element={<ProcessMyProfile />} />
      <Route path="theme" element={<Theme />} />
      <Route path="change-beep" element={<BeepSound />} />
      <Route path="leave" element={<EmployeeLeave allowAttachment={false} />} />
      <Route path="documents" element={<ProcessDocumentSettings />} />
      <Route path="client-access" element={<ProcessClientAccessSettings />} />
      <Route path="*" element={<Navigate to={`${PROCESS_SETTINGS_BASE}/profile`} replace />} />
    </Route>
  </Routes>
);

export default ProcessSettingsRoutes;

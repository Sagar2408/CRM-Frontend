import React, { useContext } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ThemeContext } from "../admin/ThemeContext";
import RequirePermission from "../admin-settings/RequirePermission";
import { useLoading } from "../../context/LoadingContext";
import LoadingSpinner from "../../features/spinner/LoadingSpinner";
import "../../styles/settingsWorkspace.css";

// Executive Settings sections. Password management is Admin-controlled and the
// email-template builder lives outside Settings, so neither is listed here.
export const settingsMenuItems = [
  { path: "profile", label: "My Profile", hint: "Your account & personal details", icon: "👤" },
  { path: "theme", label: "Theme", hint: "Look and feel", icon: "🎨" },
  { path: "change-beep", label: "Change in Beep", hint: "Sounds, volume & reminders", icon: "🔔" },
  { path: "leave", label: "Ask for Leave", hint: "Apply, balances & history", icon: "📝" },
];

// `permissionKey` is the page-access key checked for Executives. Process Person has no
// page-access rows (their identity is a different table), so their routes pass null and
// rely on ProcessPrivateRoute + the server instead.
const SettingsLayout = ({ permissionKey = "settings", menuItems = settingsMenuItems, basePath }) => {
  const { theme } = useContext(ThemeContext);
  const { isLoading, loadingText } = useLoading();

  const workspace = (
      <div className="xs-workspace" data-theme={theme}>
        <header className="xs-header">
          <h1 className="xs-title">Settings</h1>
          <p className="xs-subtitle">Manage your profile, preferences and leave requests.</p>
        </header>

        <nav className="xs-nav" aria-label="Settings sections">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              // `basePath` (absolute) is used where the layout sits under a splat route (Process Person);
              // a relative target there resolves against the current URL and keeps appending segments.
              to={basePath ? `${basePath.replace(/\/+$/, "")}/${item.path}` : item.path}
              className={({ isActive }) => `xs-nav-card${isActive ? " active" : ""}`}
            >
              <span className="xs-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="xs-nav-text">
                <span className="xs-nav-label">{item.label}</span>
                <span className="xs-nav-hint">{item.hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <main className="xs-content">
          {isLoading && <LoadingSpinner text={loadingText || "Loading Settings..."} />}
          <Outlet />
        </main>
      </div>
  );

  return permissionKey ? <RequirePermission requiredKey={permissionKey}>{workspace}</RequirePermission> : workspace;
};

export default SettingsLayout;

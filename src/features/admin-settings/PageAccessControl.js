import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissionContext } from "../../context/PermissionContext";
import RequirePermission from "./RequirePermission";
import "../../styles/pageAccessControl.css";

// Only permission keys that an actual RequirePermission (frontend) or
// requirePermission() (backend) check somewhere in this app reads —
// confirmed by grepping every requiredKey="..." and requirePermission("...")
// call site. The RolePermission model/table also has overview, create_user,
// marketing_emails, sms_notifications and email_notifications columns that
// nothing checks, so they are not offered. HR workspace phase: three previously
// unused EXISTING columns now gate real pages - billing (Payroll & Salary),
// account_updates (Leave Management) and weekly_summary (Help & Support). No
// column was added and nothing is granted automatically: they default to false.
const PERMISSION_DEFINITIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    category: "Page Access",
    description: "View the main role dashboard (overview, stats and widgets) after login.",
  },
  {
    key: "settings",
    label: "Settings",
    category: "Page Access",
    description: "Open the Settings page for this role.",
  },
  {
    key: "monitoring",
    label: "Monitoring",
    category: "Page Access",
    description: "View live executive screen/activity monitoring.",
  },
  {
    key: "reporting",
    label: "EOD Reporting",
    category: "Page Access",
    description: "View end-of-day reports.",
  },
  {
    key: "page_access",
    label: "Page Access Control",
    category: "Page Access",
    description:
      "Open this Page Access Control screen. The underlying create/update actions remain Admin-only on the backend regardless of this flag.",
  },
  {
    key: "user_management",
    label: "User Management",
    category: "User Management",
    description: "Create and manage employee accounts (HR: Employee Management; Manager: Create Executive).",
  },
  {
    key: "assign_task",
    label: "Assign Task",
    category: "User Management",
    description: "Assign tasks and leads to executives.",
  },
  {
    key: "executive_details",
    label: "Executive Details, Teams & Attendance",
    category: "User Management",
    description:
      "View executive details, Team Management and the attendance report. For HR this also allows viewing teams; creating or editing teams additionally needs User Management.",
  },
  {
    key: "account_updates",
    label: "Leave Management",
    category: "HR",
    description:
      "HR: manage leave types, balances and approve or reject leave. Manager: apply for and track their own leave (My Leave).",
  },
  {
    key: "billing",
    label: "Payroll & Salary",
    category: "HR",
    description: "View and manage employee salaries, payroll processing and payroll exports. Salary data is only returned to users with this access.",
  },
  {
    key: "weekly_summary",
    label: "Help & Support",
    category: "Page Access",
    description: "Open the Help & Support page to submit queries and read replies.",
  },
  {
    key: "task_management",
    label: "Task Management",
    category: "CRM Operations",
    description: "Access the task/lead assignment management screen.",
  },
  {
    key: "invoice",
    label: "Invoice",
    category: "CRM Operations",
    description: "View and manage invoices.",
  },
  {
    key: "messaging",
    label: "Messaging",
    category: "Page Access",
    description: "Use internal messaging: chat with employees, groups and share documents.",
  },
  {
    key: "push_notifications",
    label: "Push Notifications",
    category: "Notification Settings",
    description: "View the in-app notification panel and its alerts.",
  },
];

const CATEGORY_ORDER = ["Page Access", "User Management", "HR", "CRM Operations", "Notification Settings"];

// RolePermission.controller.js's getAllUsersHrsAndManagers (no record
// yet) and getAllRolePermissions (has a record) both now return
// structured `role`/`entityId`/`name`/`username` fields directly (added
// specifically for this UI) — read those rather than parsing the
// `label` string, which stays around only for backend back-compat.
// `name` is the employee's real name (Users.firstname+lastname, or
// Manager/Hr.name); `username` is their separate login handle — not
// hardcoded, both come straight from the API response.
function normalizeUser(u, hasRecord) {
  if (!u || u.entityId == null || !u.role) return null;
  return {
    entityId: String(u.entityId),
    role: u.role,
    name: u.name || u.username || "Unnamed",
    username: u.username || null,
    hasRecord,
  };
}

// Each role is keyed by a different table/column: Manager -> managers.id
// (manager_id), HR -> hrs.id (hr_id), TL/Executive -> users.id (user_id).
// Send ONLY the id that belongs to the role, as a real number — never the
// other keys as null (the backend rejects "manager_id must be a number").
function buildCreatePayload(role, entityId) {
  const numericId = Number(entityId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Invalid employee id for permission creation.");
  }
  if (role === "Manager") return { role, manager_id: numericId };
  if (role === "HR") return { role, hr_id: numericId };
  if (role === "Executive") return { role, user_id: numericId };
  throw new Error("Unsupported role for permission creation: " + role);
}

const emptyPermissionState = () =>
  Object.fromEntries(PERMISSION_DEFINITIONS.map((p) => [p.key, false]));

const ToggleSwitch = ({ checked, onChange, label }) => (
  <label className="pac-toggle">
    <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
    <span className="pac-toggle-track">
      <span className="pac-toggle-thumb" />
    </span>
    <span className="pac-toggle-state">{checked ? "On" : "Off"}</span>
  </label>
);

const PageAccessControlInner = () => {
  const { fetchUsers, fetchAllRolePermissions, fetchPermissionsForUser, createPermission, togglePermission } =
    usePermissionContext();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionRecordId, setPermissionRecordId] = useState(null);
  const [loadedPermissions, setLoadedPermissions] = useState(emptyPermissionState());
  const [editedPermissions, setEditedPermissions] = useState(emptyPermissionState());
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  const [permissionSearch, setPermissionSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { type: "success" | "error", message }

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const [withoutRecord, withRecord] = await Promise.all([
        fetchUsers(),
        fetchAllRolePermissions(),
      ]);

      const parsed = [];
      const seen = new Set();
      const addAll = (list, hasRecord) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
          const normalized = normalizeUser(item, hasRecord);
          if (!normalized) return;
          const dedupeKey = `${normalized.role}-${normalized.entityId}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          parsed.push(normalized);
        });
      };
      addAll(withoutRecord, false);
      addAll(withRecord, true);

      parsed.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
      setUsers(parsed);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsersError("Failed to load users. Please refresh and try again.");
    } finally {
      setUsersLoading(false);
    }
  }, [fetchUsers, fetchAllRolePermissions]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const hasUnsavedChanges = useMemo(
    () =>
      !!selectedUser &&
      PERMISSION_DEFINITIONS.some((p) => !!editedPermissions[p.key] !== !!loadedPermissions[p.key]),
    [selectedUser, editedPermissions, loadedPermissions]
  );

  const selectUser = useCallback(
    async (user) => {
      setSaveStatus(null);
      setSelectedUser(user);
      setPermissionRecordId(null);
      setPermissionsLoading(true);
      setPermissionsError("");
      try {
        const data = await fetchPermissionsForUser(user.entityId, user.role);
        const { id, ...flags } = data || {};
        const next = { ...emptyPermissionState(), ...flags };
        setPermissionRecordId(id || null);
        setLoadedPermissions(next);
        setEditedPermissions(next);
      } catch (err) {
        if (err.response?.status === 404) {
          // No RolePermission row configured yet — a normal, expected
          // state (see PermissionContext.js's identical handling),
          // not a failed request.
          const next = emptyPermissionState();
          setPermissionRecordId(null);
          setLoadedPermissions(next);
          setEditedPermissions(next);
        } else {
          console.error("Error loading permission details:", err);
          setPermissionsError("Failed to load this user's permissions. Please try again.");
        }
      } finally {
        setPermissionsLoading(false);
      }
    },
    [fetchPermissionsForUser]
  );

  const handleSelectUser = (user) => {
    if (!user) return;
    if (
      hasUnsavedChanges &&
      !window.confirm(
        `You have unsaved permission changes for ${selectedUser?.name}. Discard them and switch users?`
      )
    ) {
      return;
    }
    selectUser(user);
  };

  const handleToggleKey = (key) => {
    setEditedPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaveStatus(null);
  };

  const visibleDefinitions = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase();
    if (!term) return PERMISSION_DEFINITIONS;
    return PERMISSION_DEFINITIONS.filter(
      (p) =>
        p.label.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  }, [permissionSearch]);

  const setAllVisible = (value) => {
    setEditedPermissions((prev) => {
      const next = { ...prev };
      visibleDefinitions.forEach((p) => {
        next[p.key] = value;
      });
      return next;
    });
    setSaveStatus(null);
  };

  const handleSave = async () => {
    if (!selectedUser || !hasUnsavedChanges) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      let recordId = permissionRecordId;
      if (!recordId) {
        try {
          const createRes = await createPermission(buildCreatePayload(selectedUser.role, selectedUser.entityId));
          recordId = createRes?.record?.id;
        } catch (createErr) {
          // 409 = a record already exists (stale list / double save): reuse it
          // instead of failing or creating a duplicate.
          if (createErr.response?.status === 409 && createErr.response?.data?.record?.id) {
            recordId = createErr.response.data.record.id;
          } else {
            throw createErr;
          }
        }
        if (!recordId) throw new Error("Create succeeded but no record id was returned.");
      }

      const changedKeys = PERMISSION_DEFINITIONS.map((p) => p.key).filter(
        (key) => !!editedPermissions[key] !== !!loadedPermissions[key]
      );
      for (const key of changedKeys) {
        await togglePermission(recordId, key);
      }

      setPermissionRecordId(recordId);
      setLoadedPermissions(editedPermissions);
      setSaveStatus({ type: "success", message: "Permissions saved successfully." });
      loadUsers();
    } catch (err) {
      console.error("Failed to save permissions:", err);
      setSaveStatus({ type: "error", message: "Failed to save permissions. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const filteredUserOptions = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        u.role.toLowerCase().includes(term) ||
        String(u.entityId).includes(term)
    );
  }, [users, userSearch]);

  const groupedUserOptions = useMemo(() => {
    const groups = {};
    filteredUserOptions.forEach((u) => {
      if (!groups[u.role]) groups[u.role] = [];
      groups[u.role].push(u);
    });
    return groups;
  }, [filteredUserOptions]);

  return (
    <div className="pac-container">
      <div className="pac-header">
        <h2>User Access Management</h2>
        <p className="pac-subtitle">Select a user to view and configure their page/feature permissions.</p>
      </div>

      <div className="pac-user-picker">
        <label htmlFor="pac-user-search" className="pac-label">
          Select User
        </label>
        <input
          id="pac-user-search"
          type="text"
          className="pac-search-input"
          placeholder="Search by name, username, role or ID..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          disabled={usersLoading}
        />

        {usersError && <p className="pac-error-text">{usersError}</p>}

        {usersLoading ? (
          <p className="pac-loading-text">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="pac-empty-state">No users available</p>
        ) : (
          <div className="pac-user-results" role="listbox" aria-label="Users">
            {filteredUserOptions.length === 0 && (
              <p className="pac-empty-state">No users match "{userSearch}".</p>
            )}
            {Object.entries(groupedUserOptions).map(([role, roleUsers]) => (
              <div key={role} className="pac-user-group">
                <div className="pac-user-group-title">{role}</div>
                {roleUsers.map((u) => {
                  const isSelected =
                    !!selectedUser && selectedUser.role === u.role && selectedUser.entityId === u.entityId;
                  return (
                    <button
                      key={`${u.role}-${u.entityId}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`pac-user-option ${isSelected ? "pac-user-option-selected" : ""}`}
                      onClick={() => handleSelectUser(u)}
                    >
                      <span className="pac-user-option-name">
                        {u.name}
                        {u.username ? ` — ${u.username}` : ""}
                      </span>
                      <span className="pac-user-option-meta">
                        {u.role}, ID: {u.entityId}
                        {!u.hasRecord ? " — not configured" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="pac-panel">
          <div className="pac-selected-user">
            <div className="pac-selected-user-name">{selectedUser.name}</div>
            <div className="pac-selected-user-meta">
              <span className="pac-role-badge">{selectedUser.role}</span>
              <span>ID: {selectedUser.entityId}</span>
            </div>
          </div>

          {permissionsLoading && <p className="pac-loading-text">Loading permissions...</p>}
          {permissionsError && <p className="pac-error-text">{permissionsError}</p>}

          {!permissionsLoading && !permissionsError && (
            <>
              {permissionRecordId === null && (
                <div className="pac-empty-state">
                  No permissions configured yet for {selectedUser.name}. Toggle what they should have access to
                  below, then click Save Changes to create their permission record.
                </div>
              )}

              <div className="pac-toolbar">
                <input
                  type="text"
                  className="pac-search-input"
                  placeholder="Search permissions..."
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                />
                <div className="pac-bulk-actions">
                  <button type="button" className="pac-secondary-btn" onClick={() => setAllVisible(true)}>
                    Enable All{permissionSearch.trim() ? " (filtered)" : ""}
                  </button>
                  <button type="button" className="pac-secondary-btn" onClick={() => setAllVisible(false)}>
                    Disable All{permissionSearch.trim() ? " (filtered)" : ""}
                  </button>
                </div>
              </div>

              {visibleDefinitions.length === 0 && (
                <p className="pac-empty-state">No permissions match "{permissionSearch}".</p>
              )}

              {CATEGORY_ORDER.map((category) => {
                const items = visibleDefinitions.filter((p) => p.category === category);
                if (items.length === 0) return null;
                return (
                  <div className="pac-category" key={category}>
                    <div className="pac-category-title">{category}</div>
                    {items.map((p) => {
                      const enabled = !!editedPermissions[p.key];
                      return (
                        <div
                          key={p.key}
                          className={`pac-permission-row ${enabled ? "pac-enabled" : "pac-disabled"}`}
                        >
                          <div className="pac-permission-info">
                            <div className="pac-permission-label">{p.label}</div>
                            <div className="pac-permission-description">{p.description}</div>
                          </div>
                          <ToggleSwitch checked={enabled} onChange={() => handleToggleKey(p.key)} label={p.label} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {selectedUser && (
        <div className="pac-save-bar">
          <div className="pac-save-bar-status">
            {hasUnsavedChanges && <span className="pac-unsaved-badge">Unsaved changes</span>}
            {saveStatus && (
              <span className={saveStatus.type === "success" ? "pac-success-text" : "pac-error-text"}>
                {saveStatus.message}
              </span>
            )}
          </div>
          <button
            type="button"
            className="pac-primary-btn"
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
};

const PageAccessControl = () => (
  <RequirePermission requiredKey="page_access">
    <PageAccessControlInner />
  </RequirePermission>
);

export default PageAccessControl;

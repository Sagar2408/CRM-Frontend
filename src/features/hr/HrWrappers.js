import React from "react";
import UserManagement from "../admin/user-management/UserManagement";
import TeamManagement from "../teams/TeamManagement";
import { ROLE_OPTIONS } from "../../services/userManagementService";
import { usePermissions } from "../../hooks/usePermissions";

// HR cannot see or manage Admin accounts (the server hides them too), and HR
// peers are read-only. HR may create these account types only.
const HR_ROLE_FILTER = ROLE_OPTIONS.filter((r) => r.value !== "Admin");
const HR_CREATABLE = ["Executive", "Manager", "ProcessPerson"];

/** HR Employee Management = the Admin User Management page on the HR endpoints. */
export const EmployeeManagement = () => (
  <UserManagement
    base="/hr-management/employees"
    title="Employee Management"
    subtitle="Create, search and manage employee accounts, roles and profile photos."
    roleOptions={HR_ROLE_FILTER}
    createRoles={HR_CREATABLE}
    readOnlyRoles={["HR"]}
  />
);

/**
 * HR Team Management = the Admin Team Management page. Viewing needs
 * executive_details; creating/editing teams additionally needs user_management
 * (the server enforces both; the controls are simply hidden here).
 */
export const HrTeamManagement = () => {
  const { permissions } = usePermissions();
  return <TeamManagement canManage={permissions?.user_management === true} />;
};

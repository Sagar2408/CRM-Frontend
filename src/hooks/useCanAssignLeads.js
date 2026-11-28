import { usePermissionContext } from "../context/PermissionContext";

/**
 * Frontend mirror of the server rule (middleware/leadAssignment.js; the server is the
 * real gate): Admin always, HR and Manager only with the Task Management permission.
 * False while permissions are still loading.
 */
export default function useCanAssignLeads() {
  const { permissions } = usePermissionContext() || {};
  let role = "";
  try {
    role = String(JSON.parse(localStorage.getItem("user"))?.role || "").toLowerCase();
  } catch {
    role = "";
  }
  if (role === "admin") return true;
  return (role === "hr" || role === "manager") && permissions?.task_management === true;
}

// Sidebar definitions for the HR and Manager panels (Team Lead no longer exists).
//
// Every entry is tied to an EXISTING Page Access Control key (RolePermission
// column) - there is no second permission system and nothing is granted by
// default. The frontend hides what the Admin has not enabled; the backend APIs
// behind each page enforce the same keys independently.
//
//   dashboard         Overview
//   executive_details Executive Details / Team Management / Attendance
//   user_management   Employee Management / Create Executive
//   account_updates   Leave Management (HR) / My Leave (Manager, TL)
//   billing           Payroll & Salary
//   weekly_summary    Help & Support
//   settings          Settings
//   assign_task       Upload Leads          task_management  Lead Assign
//   monitoring        Monitoring            messaging        Messaging
//
// GENERAL  = the pages that make up the role's own job.
// EXTERNAL = additional pages the Admin may switch on for the role.
export const NAV = {
  hr: {
    base: "/hr",
    title: "HR",
    general: [
      { id: "overview", label: "Overview", to: "", icon: "PieChart", perm: "dashboard" },
      { id: "employees", label: "Employee Management", to: "employees", icon: "UserCog", perm: "user_management" },
      { id: "teams", label: "Team Management", to: "team-management", icon: "Users", perm: "executive_details" },
      { id: "attendance", label: "Attendance", to: "executive-attendance", icon: "CalendarCheck", perm: "executive_details" },
      { id: "leave", label: "Leave Management", to: "leave-management", icon: "CalendarOff", perm: "account_updates" },
      { id: "payroll", label: "Payroll", to: "payroll", icon: "Wallet", perm: "billing" },
      { id: "support", label: "Help & Support", to: "help-support", icon: "HelpCircle", perm: "weekly_summary" },
      { id: "settings", label: "Settings", to: "settings", icon: "Settings", perm: "settings" },
    ],
    external: [
      { id: "upload", label: "Upload Leads", to: "assign-task", icon: "FolderOpen", perm: "assign_task" },
      { id: "assign", label: "Lead Assign", to: "leadassign", icon: "ClipboardList", perm: "task_management" },
      { id: "monitoring", label: "Monitoring", to: "monitoring", icon: "ActivitySquare", perm: "monitoring" },
      { id: "messaging", label: "Messaging", to: "messaging", icon: "MessageSquare", perm: "messaging", messaging: true },
    ],
  },
  manager: {
    base: "/manager",
    title: "Manager",
    general: [
      { id: "overview", label: "Overview", to: "", icon: "Gauge", perm: "dashboard" },
      { id: "monitoring", label: "Monitoring", to: "monitoring", icon: "ActivitySquare", perm: "monitoring" },
      { id: "teams", label: "Task Management", to: "teams", icon: "ListChecks", perm: "executive_details" },
      { id: "attendance", label: "Attendance", to: "executive-attendance", icon: "CalendarDays", perm: "executive_details" },
      { id: "leave", label: "My Leave", to: "my-leave", icon: "CalendarOff", perm: "account_updates" },
      { id: "support", label: "Help & Support", to: "help-support", icon: "LifeBuoy", perm: "weekly_summary" },
      { id: "settings", label: "Settings", to: "settings", icon: "Settings", perm: "settings" },
    ],
    external: [
      { id: "upload", label: "Upload Leads", to: "assign-task", icon: "ClipboardList", perm: "assign_task" },
      { id: "assign", label: "Lead Assign", to: "leadassign", icon: "UserCheck", perm: "task_management" },
      { id: "create", label: "Create Executive", to: "executiveform", icon: "UserPlus", perm: "user_management" },
      { id: "messaging", label: "Messaging", to: "messaging", icon: "MessageSquare", perm: "messaging", messaging: true },
      // ELSA AI has no Page Access key (the Executive panel does not gate it either), so it
      // is always listed: `always` entries never count as "an enabled page".
      { id: "elsa", label: "ELSA AI", to: "elsa", icon: "Sparkles", always: true },
    ],
  },
};

export const itemPath = (cfg, item) => (item.to ? `${cfg.base}/${item.to}` : cfg.base);

/**
 * Pure: which entries a user may see. `permissions` is the user's RolePermission
 * record (or null when none exists yet): an entry shows only when its key is
 * exactly `true`. Nothing is shown to a user without a record.
 */
export function resolveNav(cfg, permissions) {
  const allowed = (item) => item.always === true || (!!permissions && permissions[item.perm] === true);
  const general = cfg.general.filter(allowed);
  const external = cfg.external.filter(allowed);
  // `always` entries are shown but do not count as a page the Admin enabled.
  const keyed = (list) => list.filter((i) => !i.always).length;
  return { general, external, total: keyed(general) + keyed(external) };
}

/** The first page the user may open (used to leave a forbidden landing page). */
export function firstAllowedPath(cfg, permissions) {
  const { general, external } = resolveNav(cfg, permissions);
  const first = general.find((i) => !i.always) || external.find((i) => !i.always);
  return first ? itemPath(cfg, first) : null;
}

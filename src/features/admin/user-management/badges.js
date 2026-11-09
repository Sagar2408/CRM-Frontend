import React from "react";

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

export const RoleBadge = ({ role, label }) => (
  <span className={`um-badge um-role-${String(role).toLowerCase()}`}>{label}</span>
);

export const StatusBadge = ({ active }) => (
  <span className={`um-status ${active ? "um-status-active" : "um-status-inactive"}`}>
    <span className="um-status-dot" aria-hidden="true" />
    {active ? "Active" : "Inactive"}
  </span>
);

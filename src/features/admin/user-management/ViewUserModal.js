import React, { useEffect, useState } from "react";
import { Modal } from "./ConfirmDialog";
import Avatar from "./Avatar";
import { RoleBadge, StatusBadge, fmtDate } from "./badges";
import { apiError, getUser } from "../../../services/userManagementService";

const FIELDS = {
  user: [["firstname", "First name"], ["lastname", "Last name"], ["country", "Country"], ["state", "State"], ["city", "City"], ["postal_code", "Postal code"]],
  manager: [["jobTitle", "Job title"]],
  hr: [["jobTitle", "Job title"]],
  processperson: [["phone", "Phone"], ["nationality", "Nationality"], ["dob", "Date of birth"], ["passportNumber", "Passport number"], ["profession", "Profession"], ["location", "Location"]],
};

const ViewUserModal = ({ user, version, onClose, onEdit }) => {
  const [full, setFull] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getUser(user.kind, user.id)
      .then((u) => alive && setFull(u))
      .catch((e) => alive && setError(apiError(e, "Failed to load user")));
    return () => {
      alive = false;
    };
  }, [user.kind, user.id]);

  const u = full || user;
  const rows = [
    ["Employee ID", u.employeeId],
    ["Username", u.username || "—"],
    ["Email", u.email],
    ["Created", fmtDate(u.createdAt)],
    ...(FIELDS[user.kind] || []).map(([k, label]) => [label, full ? (k === "dob" && full[k] ? String(full[k]).slice(0, 10) : full[k]) || "—" : "…"]),
  ];

  return (
    <Modal title="User details" onClose={onClose}>
      <div className="um-view-head">
        <Avatar user={u} size={72} version={version} />
        <div>
          <div className="um-view-name">{u.name}</div>
          <div className="um-view-badges">
            <RoleBadge role={u.role} label={u.roleLabel} />
            <StatusBadge active={u.active} />
          </div>
        </div>
      </div>
      {error && <p className="um-error" role="alert">{error}</p>}
      <dl className="um-details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="um-actions">
        <button type="button" className="um-btn um-btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="um-btn um-btn-primary" onClick={() => onEdit(user)}>Edit</button>
      </div>
    </Modal>
  );
};

export default ViewUserModal;

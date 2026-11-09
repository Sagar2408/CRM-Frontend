import React, { useState } from "react";
import { Modal } from "./ConfirmDialog";
import { useApi } from "../../../context/ApiContext";
import { apiError, ROLE_OPTIONS } from "../../../services/userManagementService";

const STAFF = ["Executive", "TL", "Admin"]; // rows in the Users table: have username + location fields
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { role: "", username: "", firstname: "", lastname: "", email: "", password: "", country: "", state: "", city: "", postal_code: "" };

/**
 * Builds the JSON body for the role's EXISTING create endpoint. Sent as
 * a plain object (the old form sent FormData to JSON-only routes and
 * only worked because axios silently converted it back to JSON).
 */
export const buildCreatePayload = (f) => {
  const fullName = `${f.firstname} ${f.lastname}`.trim();
  if (f.role === "ProcessPerson") return { fullName, email: f.email, password: f.password };
  if (f.role === "Manager") return { name: fullName || f.username, username: f.username, email: f.email, password: f.password };
  if (f.role === "HR") return { name: fullName || f.username, email: f.email, password: f.password };
  const out = { username: f.username, email: f.email, password: f.password };
  ["firstname", "lastname", "country", "state", "city", "postal_code"].forEach((k) => {
    if (f[k]) out[k] = f[k];
  });
  return out;
};

export const validateCreate = (f) => {
  const e = {};
  if (!f.role) e.role = "Select a role.";
  if (f.role !== "ProcessPerson" && !f.username.trim()) e.username = "Username is required.";
  if (!f.firstname.trim()) e.firstname = "First name is required.";
  if (!EMAIL_RE.test(f.email)) e.email = "Enter a valid email address.";
  if (f.password.length < 6) e.password = "Password must be at least 6 characters.";
  if (STAFF.includes(f.role)) {
    if (!f.country.trim()) e.country = "Country is required.";
    if (!f.state.trim()) e.state = "State is required.";
    if (!f.city.trim()) e.city = "City is required.";
  }
  return e;
};

const Field = ({ id, label, error, children }) => (
  <div className="um-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {error && <p className="um-field-error" role="alert">{error}</p>}
  </div>
);

const CreateUserModal = ({ onClose, onCreated }) => {
  const { createExecutive, createTeamLead, createAdmin, createManager, createHr, createProcessPerson } = useApi();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (e) => {
    setF((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: undefined }));
  };

  const call = {
    Executive: createExecutive,
    TL: createTeamLead,
    Admin: createAdmin,
    Manager: createManager,
    HR: createHr,
    ProcessPerson: createProcessPerson,
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateCreate(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError("");
    try {
      await call[f.role](buildCreatePayload(f));
      onCreated(`${ROLE_OPTIONS.find((r) => r.value === f.role)?.label} created successfully.`);
    } catch (err) {
      setServerError(apiError(err, "Failed to create user"));
    } finally {
      setSaving(false);
    }
  };

  const staff = STAFF.includes(f.role);

  return (
    <Modal title="Create User" onClose={onClose} wide>
      <form onSubmit={submit} noValidate className="um-form">
        <div className="um-grid">
          <Field id="cu-role" label="Role" error={errors.role}>
            <select id="cu-role" name="role" value={f.role} onChange={set}>
              <option value="" disabled>Select role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          {f.role !== "ProcessPerson" && (
            <Field id="cu-username" label="Username" error={errors.username}>
              <input id="cu-username" name="username" value={f.username} onChange={set} placeholder="Enter username" maxLength={50} />
            </Field>
          )}
          <Field id="cu-firstname" label="First name" error={errors.firstname}>
            <input id="cu-firstname" name="firstname" value={f.firstname} onChange={set} placeholder="Enter first name" maxLength={100} />
          </Field>
          <Field id="cu-lastname" label="Last name">
            <input id="cu-lastname" name="lastname" value={f.lastname} onChange={set} placeholder="Enter last name" maxLength={100} />
          </Field>
          <Field id="cu-email" label="Email" error={errors.email}>
            <input id="cu-email" type="email" name="email" value={f.email} onChange={set} placeholder="Enter email" />
          </Field>
          <Field id="cu-password" label="Password" error={errors.password}>
            <div className="um-pw">
              <input id="cu-password" type={showPw ? "text" : "password"} name="password" value={f.password} onChange={set} placeholder="At least 6 characters" autoComplete="new-password" />
              <button type="button" className="um-link" onClick={() => setShowPw((s) => !s)}>{showPw ? "Hide" : "Show"}</button>
            </div>
          </Field>
          {staff && (
            <>
              <Field id="cu-country" label="Country" error={errors.country}>
                <input id="cu-country" name="country" value={f.country} onChange={set} maxLength={100} />
              </Field>
              <Field id="cu-state" label="State" error={errors.state}>
                <input id="cu-state" name="state" value={f.state} onChange={set} maxLength={100} />
              </Field>
              <Field id="cu-city" label="City" error={errors.city}>
                <input id="cu-city" name="city" value={f.city} onChange={set} maxLength={100} />
              </Field>
              <Field id="cu-postal" label="Postal code">
                <input id="cu-postal" name="postal_code" value={f.postal_code} onChange={set} maxLength={20} />
              </Field>
            </>
          )}
        </div>
        {serverError && <p className="um-error" role="alert">{serverError}</p>}
        <div className="um-actions">
          <button type="button" className="um-btn um-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="um-btn um-btn-primary" disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateUserModal;

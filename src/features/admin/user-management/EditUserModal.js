import React, { useEffect, useRef, useState } from "react";
import { Modal } from "./ConfirmDialog";
import ConfirmDialog from "./ConfirmDialog";
import Avatar from "./Avatar";
import ResetPasswordSection from "./ResetPasswordSection";
import { RoleBadge } from "./badges";
import {
  apiError,
  deleteUserPhoto,
  getUser,
  updateUser,
  uploadUserPhoto,
  validatePhoto,
} from "../../../services/userManagementService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Which fields each identity table lets an Admin edit (mirrors the
// backend's validators/userManagement.validators.js). Role is read-only.
const FIELDS = {
  user: [
    ["firstname", "First name"], ["lastname", "Last name"], ["username", "Username", true], ["email", "Email", true],
    ["country", "Country"], ["state", "State"], ["city", "City"], ["postal_code", "Postal code"],
  ],
  manager: [["name", "Full name", true], ["username", "Username", true], ["email", "Email", true], ["jobTitle", "Job title"]],
  hr: [["name", "Full name", true], ["username", "Username", true], ["email", "Email", true], ["jobTitle", "Job title"]],
  processperson: [
    ["fullName", "Full name", true], ["email", "Email", true], ["phone", "Phone"], ["nationality", "Nationality"],
    ["dob", "Date of birth", false, "date"], ["passportNumber", "Passport number"], ["profession", "Profession"], ["location", "Location"],
  ],
};
const NAME_KEY = { manager: "name", hr: "name", processperson: "fullName" };

export const validateEdit = (kind, v) => {
  const e = {};
  for (const [key, label, required] of FIELDS[kind]) {
    if (required && !String(v[key] || "").trim()) e[key] = `${label} is required.`;
  }
  if (v.email && !EMAIL_RE.test(v.email)) e.email = "Enter a valid email address.";
  return e;
};

const EditUserModal = ({ user, onClose, onSaved }) => {
  const { kind } = user;
  const [values, setValues] = useState(null);
  const [active, setActive] = useState(user.active);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // "deactivate" | "removePhoto"
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(user.hasPhoto);
  const [changed, setChanged] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getUser(kind, user.id)
      .then((u) => {
        if (!alive) return;
        const v = {};
        FIELDS[kind].forEach(([k]) => {
          v[k] = k === "dob" && u[k] ? String(u[k]).slice(0, 10) : u[k] ?? "";
        });
        setValues(v);
        setActive(u.active);
        setHasPhoto(u.hasPhoto);
      })
      .catch((e) => alive && setServerError(apiError(e, "Failed to load user")));
    return () => {
      alive = false;
    };
  }, [kind, user.id]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (e) => {
    setValues((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: undefined }));
  };

  const save = async (skipConfirm = false) => {
    const found = validateEdit(kind, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!skipConfirm && user.active && !active) return setConfirm("deactivate");
    setSaving(true);
    setServerError("");
    setConfirm(null);
    try {
      const body = { ...values, active };
      if (kind === "processperson" && !body.dob) body.dob = null;
      await updateUser(kind, user.id, body);
      onSaved("User updated successfully.");
    } catch (err) {
      setServerError(apiError(err, "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  const pick = (e) => {
    const f = e.target.files?.[0] || null;
    const problem = validatePhoto(f);
    setPhotoError(problem);
    if (problem) {
      e.target.value = "";
      setPhotoFile(null);
      setPreview(null);
      return;
    }
    setPhotoFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await uploadUserPhoto(kind, user.id, photoFile);
      setHasPhoto(true);
      setPhotoFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setPhotoVersion((v) => v + 1);
      setChanged(true);
    } catch (err) {
      setPhotoError(apiError(err, "Failed to upload photo"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setConfirm(null);
    try {
      await deleteUserPhoto(kind, user.id);
      setHasPhoto(false);
      setPhotoVersion((v) => v + 1);
      setChanged(true);
    } catch (err) {
      setPhotoError(apiError(err, "Failed to remove photo"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const display = { ...user, name: values?.[NAME_KEY[kind]] || user.name, hasPhoto };
  const close = () => (changed ? onSaved(null) : onClose());

  return (
    <>
      <Modal title="Edit user" onClose={close} wide>
        <div className="um-photo-box">
          <Avatar user={display} size={80} version={photoVersion} preview={preview} />
          <div className="um-photo-controls">
            <div className="um-photo-meta">
              <strong>{user.employeeId}</strong>
              <RoleBadge role={user.role} label={user.roleLabel} />
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} aria-label="Profile photo" />
            <div className="um-photo-btns">
              <button type="button" className="um-btn um-btn-primary um-btn-sm" onClick={uploadPhoto} disabled={!photoFile || photoBusy}>
                {photoBusy ? "Working…" : hasPhoto ? "Update photo" : "Upload photo"}
              </button>
              {hasPhoto && (
                <button type="button" className="um-btn um-btn-ghost um-btn-sm" onClick={() => setConfirm("removePhoto")} disabled={photoBusy}>
                  Remove photo
                </button>
              )}
            </div>
            <small className="um-hint">JPEG, PNG or WEBP, up to 2MB.</small>
            {photoError && <p className="um-field-error" role="alert">{photoError}</p>}
          </div>
        </div>

        {!values ? (
          serverError ? <p className="um-error" role="alert">{serverError}</p> : <div className="um-skel-block" aria-busy="true" />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="um-form">
            <div className="um-grid">
              {FIELDS[kind].map(([key, label, required, type]) => (
                <div className="um-field" key={key}>
                  <label htmlFor={`eu-${key}`}>{label}{required ? " *" : ""}</label>
                  <input id={`eu-${key}`} name={key} type={type || "text"} value={values[key]} onChange={set} />
                  {errors[key] && <p className="um-field-error" role="alert">{errors[key]}</p>}
                </div>
              ))}
              <div className="um-field">
                <label htmlFor="eu-role">Role</label>
                <input id="eu-role" value={user.roleLabel} readOnly disabled title="Role cannot be changed here" />
              </div>
              <label className="um-switch-row">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Account active (can log in)</span>
              </label>
            </div>
            {serverError && <p className="um-error" role="alert">{serverError}</p>}
            <ResetPasswordSection user={user} />
            <div className="um-actions">
              <button type="button" className="um-btn um-btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              <button type="submit" className="um-btn um-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        )}
      </Modal>
      {confirm === "deactivate" && (
        <ConfirmDialog
          title="Deactivate account?"
          message={`${display.name} will no longer be able to log in. You can reactivate the account at any time.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => save(true)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "removePhoto" && (
        <ConfirmDialog
          title="Remove profile photo?"
          message="The current photo will be permanently deleted."
          confirmLabel="Remove"
          danger
          busy={photoBusy}
          onConfirm={removePhoto}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

export default EditUserModal;

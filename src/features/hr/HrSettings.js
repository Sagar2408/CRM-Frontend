import React, { useCallback, useEffect, useState } from "react";
import SidebarToggle from "../admin/SidebarToggle";
import { hrError, hrProfileApi } from "../../services/hrService";
import { initialsOf } from "../admin/user-management/Avatar";
import { StateBlock } from "./hrUi";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 2 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateProfile = (f) => {
  const e = {};
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.username.trim()) e.username = "Username is required.";
  if (!EMAIL_RE.test(f.email)) e.email = "Enter a valid email address.";
  return e;
};
export const validatePassword = (f) => {
  const e = {};
  if (!f.currentPassword) e.currentPassword = "Enter your current password.";
  if (f.newPassword.length < 6) e.newPassword = "New password must be at least 6 characters.";
  else if (f.newPassword === f.currentPassword) e.newPassword = "New password must be different from the current one.";
  if (f.confirm !== f.newPassword) e.confirm = "Passwords do not match.";
  return e;
};

/**
 * HR Settings: own profile, photo and password only. The Admin-only tabs
 * (Page Access Control etc.) were removed - HR never had authority over them.
 * Changing the password re-verifies the current password on the server.
 */
const HrSettings = () => {
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [form, setForm] = useState({ name: "", username: "", email: "", jobTitle: "" });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});

  const loadPhoto = useCallback(async () => {
    try {
      const blob = await hrProfileApi.getPhoto();
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    hrProfileApi
      .get()
      .then((hr) => {
        if (!alive) return;
        setProfile(hr);
        setForm({ name: hr.name || "", username: hr.username || "", email: hr.email || "", jobTitle: hr.jobTitle || "" });
        setState({ loading: false, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, error: hrError(e, "Could not load your profile.") }));
    loadPhoto();
    return () => {
      alive = false;
    };
  }, [loadPhoto]);

  const say = (type, text) => setMsg({ type, text });

  const saveProfile = async (ev) => {
    ev.preventDefault();
    const found = validateProfile(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await hrProfileApi.update(profile.id, { name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), jobTitle: form.jobTitle });
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored) localStorage.setItem("user", JSON.stringify({ ...stored, name: form.name.trim(), email: form.email.trim() }));
      say("ok", "Profile updated.");
    } catch (e) {
      say("error", hrError(e, "Could not update your profile."));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (ev) => {
    ev.preventDefault();
    const found = validatePassword(pw);
    setPwErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await hrProfileApi.changePassword(pw.currentPassword, pw.newPassword);
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      say("ok", "Password changed.");
    } catch (e) {
      say("error", hrError(e, "Could not change your password."));
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return say("error", "Photo must be a JPEG, PNG or WEBP image.");
    if (file.size > PHOTO_MAX) return say("error", "Photo must be 2MB or smaller.");
    setPhotoBusy(true);
    try {
      await hrProfileApi.uploadPhoto(file);
      await loadPhoto();
      say("ok", "Profile photo updated.");
    } catch (e) {
      say("error", hrError(e, "Could not upload the photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await hrProfileApi.deletePhoto();
      await loadPhoto();
      say("ok", "Profile photo removed.");
    } catch (e) {
      say("error", hrError(e, "Could not remove the photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const set = (setter) => (e) => setter((p) => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>Settings</h1>
          <p>Manage your own profile, photo and password.</p>
        </div>
      </div>
      <div className="hr-tabs" role="tablist">
        {[["profile", "Profile"], ["password", "Password"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" className="hr-tab" aria-selected={tab === id} onClick={() => { setTab(id); setMsg({ type: "", text: "" }); }}>{label}</button>
        ))}
      </div>
      {msg.text && <div className={msg.type === "ok" ? "hr-ok" : "hr-error"} role={msg.type === "ok" ? "status" : "alert"}>{msg.text}</div>}

      <StateBlock loading={state.loading} error={state.error}>
        {tab === "profile" && profile && (
          <div className="hr-grid cols-2">
            <div className="hr-card">
              <h3>Profile photo</h3>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {photoUrl ? <img className="hr-avatar" src={photoUrl} alt="Your profile" /> : <span className="hr-avatar" aria-label="No profile photo">{initialsOf(profile.name)}</span>}
                <div className="hr-stack" style={{ gap: 8 }}>
                  <label className="hr-btn" style={{ display: "inline-block", textAlign: "center" }}>
                    {photoBusy ? "Working…" : photoUrl ? "Change photo" : "Upload photo"}
                    <input type="file" accept={PHOTO_TYPES.join(",")} onChange={onPhoto} disabled={photoBusy} style={{ display: "none" }} aria-label="Upload profile photo" />
                  </label>
                  {photoUrl && <button type="button" className="hr-btn ghost" onClick={removePhoto} disabled={photoBusy}>Remove photo</button>}
                  <span className="hr-help">JPEG, PNG or WEBP, up to 2MB.</span>
                </div>
              </div>
            </div>
            <form className="hr-card hr-form" onSubmit={saveProfile} noValidate>
              <h3>Profile details</h3>
              <label>Full name<input name="name" value={form.name} onChange={set(setForm)} maxLength={100} />{errors.name && <span className="hr-error">{errors.name}</span>}</label>
              <label>Username<input name="username" value={form.username} onChange={set(setForm)} maxLength={50} />{errors.username && <span className="hr-error">{errors.username}</span>}</label>
              <label>Email<input name="email" type="email" value={form.email} onChange={set(setForm)} />{errors.email && <span className="hr-error">{errors.email}</span>}</label>
              <label>Job title<input name="jobTitle" value={form.jobTitle} onChange={set(setForm)} maxLength={100} /></label>
              <label>Role<input value={profile.role || "HR"} disabled aria-label="Role" /></label>
              <div><button type="submit" className="hr-btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
            </form>
          </div>
        )}
        {tab === "password" && (
          <form className="hr-card hr-form" onSubmit={changePassword} noValidate style={{ maxWidth: 480 }}>
            <h3>Change password</h3>
            <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={set(setPw)} />{pwErrors.currentPassword && <span className="hr-error">{pwErrors.currentPassword}</span>}</label>
            <label>New password<input name="newPassword" type="password" autoComplete="new-password" value={pw.newPassword} onChange={set(setPw)} />{pwErrors.newPassword && <span className="hr-error">{pwErrors.newPassword}</span>}</label>
            <label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={set(setPw)} />{pwErrors.confirm && <span className="hr-error">{pwErrors.confirm}</span>}</label>
            <div><button type="submit" className="hr-btn" disabled={saving}>{saving ? "Saving…" : "Change password"}</button></div>
          </form>
        )}
      </StateBlock>
    </div>
  );
};

export default HrSettings;

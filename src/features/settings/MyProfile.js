import React, { useState, useEffect, useRef } from "react";
import { useApi } from "../../context/ApiContext";
import ProfileAvatar, { useOwnPhotoUrl } from "../executive/ProfileAvatar";
import "../../styles/settingsWorkspace.css";

// Fields the employee may edit themselves. Identity (username, email, role, id)
// is read-only: it is managed by Admin/HR and enforced by the server too.
const EDITABLE = [
  { name: "firstname", label: "First name", max: 100, required: true },
  { name: "lastname", label: "Last name", max: 100 },
  { name: "country", label: "Country", max: 100 },
  { name: "state", label: "State", max: 100 },
  { name: "city", label: "City", max: 100 },
  { name: "postal_code", label: "Postal code", max: 20 },
  { name: "tax_id", label: "Tax ID", max: 50 },
];

const pick = (user) => Object.fromEntries(EDITABLE.map(({ name }) => [name, user?.[name] || ""]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null);

const ReadOnly = ({ label, value }) => (
  <div className="xs-field">
    <span className="xs-label">{label}</span>
    <span className={`xs-value${value ? "" : " muted"}`}>{value || "Not provided"}</span>
  </div>
);

const MyProfile = () => {
  const { fetchSettings, userSettings, updateSettings } = useApi();
  const user = userSettings?.user;
  const hasFetched = useRef(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(pick(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type, text }
  const photoUrl = useOwnPhotoUrl(user?.id, user ? !!user.profile_picture : undefined);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchSettings();
    }
  }, [fetchSettings]);

  useEffect(() => {
    if (user && !editing) setForm(pick(user));
  }, [user, editing]);

  const fullName = [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim();
  const initial = (fullName || user?.username || "?").charAt(0).toUpperCase();

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    for (const f of EDITABLE) {
      const v = (form[f.name] || "").trim();
      if (f.required && !v) next[f.name] = `${f.label} is required`;
      if (v.length > f.max) next[f.name] = `${f.label} must be at most ${f.max} characters`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const startEdit = () => {
    setNotice(null);
    setForm(pick(user));
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setErrors({});
    setForm(pick(user));
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setNotice(null);
    try {
      await updateSettings(Object.fromEntries(EDITABLE.map(({ name }) => [name, (form[name] || "").trim()])));
      setEditing(false);
      setNotice({ type: "ok", text: "Profile updated." });
    } catch (e) {
      setNotice({ type: "error", text: e.response?.data?.message || "Could not save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="xs-card"><p className="xs-hint" role="status">Loading your profile…</p></div>;
  }

  const location = [user.city, user.state, user.country].filter(Boolean).join(", ");

  return (
    <div>
      <div className="xs-page-head">
        <div>
          <h2 className="xs-page-title">My Profile</h2>
          <p className="xs-page-sub">Your account details from the CRM. Username, email and role are managed by your administrator.</p>
        </div>
        {!editing && <button type="button" className="xs-btn primary" onClick={startEdit}>Edit personal information</button>}
      </div>

      {notice && <div className={`xs-alert ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} style={{ marginBottom: 16 }}>{notice.text}</div>}

      <div className="xs-grid two">
        <section className="xs-card" aria-label="Profile card">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <ProfileAvatar
              url={photoUrl}
              initial={initial}
              className="xs-avatar"
              alt={`${fullName || user.username} profile photo`}
            />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: "1.2rem", margin: 0 }}>{fullName || user.username}</h3>
              <p className="xs-hint" style={{ margin: "2px 0 6px" }}>@{user.username}</p>
              <span className="xs-badge">{user.role}</span>
            </div>
          </div>
          <div className="xs-fields" style={{ marginTop: 18 }}>
            <ReadOnly label="Employee ID" value={String(user.id)} />
            <ReadOnly label="Username" value={user.username} />
            <ReadOnly label="Email" value={user.email} />
            <ReadOnly label="Role" value={user.role} />
            <ReadOnly label="Location" value={location} />
            <ReadOnly label="Member since" value={fmtDate(user.createdAt)} />
          </div>
          <p className="xs-hint" style={{ marginTop: 14 }}>Your photo is managed by your administrator.</p>
        </section>

        <section className="xs-card" aria-label="Personal information">
          <div className="xs-card-head">
            <div>
              <h3>Personal information</h3>
              <p className="xs-card-sub">{editing ? "Update your details and save." : "Click edit to change your name and address details."}</p>
            </div>
          </div>
          <div className="xs-fields">
            {EDITABLE.map((f) => (
              <div className="xs-field" key={f.name}>
                {editing ? (
                  <>
                    <label htmlFor={`profile-${f.name}`}>{f.label}{f.required ? " *" : ""}</label>
                    <input
                      id={`profile-${f.name}`}
                      name={f.name}
                      className="xs-input"
                      value={form[f.name]}
                      onChange={onChange}
                      maxLength={f.max}
                      aria-invalid={!!errors[f.name]}
                    />
                    {errors[f.name] && <span className="xs-error">{errors[f.name]}</span>}
                  </>
                ) : (
                  <ReadOnly label={f.label} value={user[f.name]} />
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="xs-actions">
              <button type="button" className="xs-btn" onClick={cancel} disabled={saving}>Cancel</button>
              <button type="button" className="xs-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyProfile;

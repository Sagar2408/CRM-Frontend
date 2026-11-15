import React, { useEffect, useState } from "react";
import { getProcessSettings, updateProcessSettingsApi } from "../../services/processService";
import "../../styles/settingsWorkspace.css";

export const PROFILE_UPDATED_EVENT = "pp-profile-updated";

// Only what the server lets a Process Person change about themselves. Email, role and
// the account id are managed by the administrator and shown read-only.
export const EDITABLE_FIELDS = [
  { name: "fullName", label: "Full name", max: 150, required: true },
  { name: "phone", label: "Phone", max: 30, type: "tel" },
  { name: "dob", label: "Date of birth", type: "date" },
  { name: "nationality", label: "Nationality", max: 100 },
  { name: "passportNumber", label: "Passport number", max: 50 },
  { name: "profession", label: "Profession", max: 100 },
  { name: "location", label: "Location", max: 150 },
];

const pick = (src) =>
  Object.fromEntries(EDITABLE_FIELDS.map(({ name }) => [name, src?.[name] ? (name === "dob" ? String(src[name]).slice(0, 10) : String(src[name])) : ""]));

const fmtDate = (d) => {
  if (!d) return "";
  const x = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Number.isNaN(+x) ? String(d) : x.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const ReadOnly = ({ label, value }) => (
  <div className="xs-field">
    <span className="xs-label">{label}</span>
    <span className={`xs-value${value ? "" : " muted"}`}>{value || "Not provided"}</span>
  </div>
);

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
};

// Settings > My Profile for Process Person. Reads/writes the person's own record
// (identity comes from the JWT, never the form).
const ProcessMyProfile = () => {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(pick(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type, text }
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    getProcessSettings()
      .then((s) => {
        if (!alive) return;
        setProfile(s || {});
        setForm(pick(s));
      })
      .catch((e) => alive && setLoadError(e.message || "Could not load your profile."));
    return () => {
      alive = false;
    };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    for (const f of EDITABLE_FIELDS) {
      const v = String(form[f.name] || "").trim();
      if (f.required && !v) next[f.name] = `${f.label} is required`;
      if (f.max && v.length > f.max) next[f.name] = `${f.label} must be at most ${f.max} characters`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const payload = Object.fromEntries(EDITABLE_FIELDS.map(({ name }) => [name, String(form[name] || "").trim()]));
    setSaving(true);
    setNotice(null);
    try {
      await updateProcessSettingsApi(payload);
      setProfile((p) => ({ ...p, ...payload }));
      try {
        localStorage.setItem("user", JSON.stringify({ ...storedUser(), fullName: payload.fullName }));
      } catch (_) {
        /* the header refresh is best effort */
      }
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      setEditing(false);
      setNotice({ type: "ok", text: "Profile updated." });
    } catch (e) {
      setNotice({ type: "error", text: e.message || "Could not save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setEditing(false);
    setErrors({});
    setForm(pick(profile));
  };

  if (loadError) return <div className="xs-alert error" role="alert">{loadError}</div>;
  if (!profile) return <div className="xs-card"><p className="xs-hint" role="status">Loading your profile…</p></div>;

  const me = storedUser();
  const name = (profile.fullName || me.fullName || "").trim();
  const initial = (name.charAt(0) || "?").toUpperCase();

  return (
    <div>
      <div className="xs-page-head">
        <div>
          <h2 className="xs-page-title">My Profile</h2>
          <p className="xs-page-sub">Your account details. Email and role are managed by your administrator.</p>
        </div>
        {!editing && (
          <button type="button" className="xs-btn primary" onClick={() => { setNotice(null); setForm(pick(profile)); setEditing(true); }}>
            Edit personal information
          </button>
        )}
      </div>

      {notice && <div className={`xs-alert ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} style={{ marginBottom: 16 }}>{notice.text}</div>}

      <div className="xs-grid two">
        <section className="xs-card" aria-label="Profile card">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span className="xs-avatar" aria-hidden="true" style={{ display: "grid", placeItems: "center", fontWeight: 700, fontSize: "1.6rem" }}>{initial}</span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: "1.2rem", margin: 0 }}>{name || "Your name"}</h3>
              <span className="xs-badge">Process Person</span>
            </div>
          </div>
          <div className="xs-fields" style={{ marginTop: 18 }}>
            <ReadOnly label="Employee ID" value={me.id != null ? String(me.id) : ""} />
            <ReadOnly label="Email" value={profile.email} />
            <ReadOnly label="Role" value="Process Person" />
          </div>
        </section>

        <section className="xs-card" aria-label="Personal information">
          <div className="xs-card-head">
            <div>
              <h3>Personal information</h3>
              <p className="xs-card-sub">{editing ? "Update your details and save." : "Click edit to change your personal details."}</p>
            </div>
          </div>
          <div className="xs-fields">
            {EDITABLE_FIELDS.map((f) => (
              <div className="xs-field" key={f.name}>
                {editing ? (
                  <>
                    <label htmlFor={`pp-profile-${f.name}`}>{f.label}{f.required ? " *" : ""}</label>
                    <input
                      id={`pp-profile-${f.name}`}
                      name={f.name}
                      type={f.type || "text"}
                      className="xs-input"
                      value={form[f.name]}
                      onChange={onChange}
                      maxLength={f.max}
                      aria-invalid={!!errors[f.name]}
                    />
                    {errors[f.name] && <span className="xs-error">{errors[f.name]}</span>}
                  </>
                ) : (
                  <ReadOnly label={f.label} value={f.type === "date" ? fmtDate(profile[f.name]) : profile[f.name]} />
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

export default ProcessMyProfile;

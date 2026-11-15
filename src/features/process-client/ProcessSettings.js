import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProcessSettings, updateProcessSettingsApi } from "../../services/processService";
import "../../styles/processModern.css";

export const PROFILE_UPDATED_EVENT = "pp-profile-updated";

const EMPTY = { fullName: "", email: "", phone: "", dob: "", nationality: "", passportNumber: "", profession: "", location: "" };
const EDITABLE = ["fullName", "phone", "dob", "nationality", "passportNumber", "profession", "location"];

const FIELDS = [
  { name: "fullName", label: "Full name", required: true },
  { name: "email", label: "Email", readOnly: true },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "dob", label: "Date of birth", type: "date" },
  { name: "nationality", label: "Nationality" },
  { name: "passportNumber", label: "Passport number" },
  { name: "profession", label: "Profession" },
  { name: "location", label: "Location" },
];

// Process Person profile. Reads / writes the person's own record through
// /processperson/process/settings (identity comes from the JWT, never the form).
// There is no Email Template section here by design.
const ProcessSettings = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", text }

  useEffect(() => {
    let alive = true;
    getProcessSettings()
      .then((s) => {
        if (!alive) return;
        const next = { ...EMPTY };
        Object.keys(EMPTY).forEach((k) => {
          next[k] = s?.[k] ? (k === "dob" ? String(s[k]).slice(0, 10) : String(s[k])) : "";
        });
        setForm(next);
      })
      .catch((err) => alive && setNotice({ kind: "error", text: err.message || "Could not load your profile." }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setNotice({ kind: "error", text: "Full name is required." });
      return;
    }
    const payload = {};
    EDITABLE.forEach((k) => {
      payload[k] = typeof form[k] === "string" ? form[k].trim() : form[k];
    });
    setSaving(true);
    setNotice(null);
    try {
      await updateProcessSettingsApi(payload);
      // Keep the signed-in profile (read by the header) in step with what was saved.
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}") || {};
        localStorage.setItem("user", JSON.stringify({ ...stored, fullName: payload.fullName }));
      } catch (_) {
        /* header refresh is best effort */
      }
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      setNotice({ kind: "ok", text: "Profile saved." });
    } catch (err) {
      setNotice({ kind: "error", text: err.message || "Could not save your profile." });
    } finally {
      setSaving(false);
    }
  };

  const initial = (form.fullName.trim().charAt(0) || "?").toUpperCase();

  return (
    <div className="pp-page">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">Settings</h1>
          <p className="pp-page__sub">Manage your profile</p>
        </div>
        <button type="button" className="pp-btn" onClick={() => navigate("/process/client/create-client")}>
          Create Client
        </button>
      </header>

      {notice && (
        <div className={`pp-alert ${notice.kind === "ok" ? "pp-alert--ok" : "pp-alert--error"}`} role={notice.kind === "ok" ? "status" : "alert"}>
          {notice.text}
        </div>
      )}

      <div className="pp-settings">
        <aside className="pp-card pp-settings__profile">
          <span className="pp-avatar pp-avatar--lg" aria-hidden="true">{initial}</span>
          <h2 className="pp-card__name">{form.fullName || "Your name"}</h2>
          <p className="pp-page__sub">Process Person</p>
          <p className="pp-page__sub">{form.email}</p>
        </aside>

        <form className="pp-card pp-settings__form" onSubmit={submit} aria-busy={loading}>
          <h3 className="pp-settings__heading">Profile</h3>
          <div className="pp-formgrid">
            {FIELDS.map((f) => (
              <label key={f.name} className="pp-field">
                <span>{f.label}</span>
                <input
                  name={f.name}
                  type={f.type || "text"}
                  value={form[f.name]}
                  onChange={change}
                  readOnly={f.readOnly}
                  required={f.required}
                  disabled={loading}
                />
              </label>
            ))}
          </div>
          <div className="pp-settings__actions">
            <button type="submit" className="pp-btn pp-btn--primary" disabled={saving || loading}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProcessSettings;

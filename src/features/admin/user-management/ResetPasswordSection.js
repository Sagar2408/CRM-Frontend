import React, { useState } from "react";
import { apiError, canResetPasswords, resetUserPassword } from "../../../services/userManagementService";

export const validateNewPassword = (pw, confirm) => {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw !== confirm) return "Passwords do not match.";
  return "";
};

// Admin-only: company users cannot reset their own password any more (the public
// forgot-password flow is gone), so the Admin sets a new one here.
const ResetPasswordSection = ({ user }) => {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!canResetPasswords()) return null; // the HR employee view has no reset endpoint

  const submit = async () => {
    const err = validateNewPassword(pw, confirm);
    if (err) return setMsg({ type: "error", text: err });
    setBusy(true);
    setMsg(null);
    try {
      const res = await resetUserPassword(user.kind, user.id, pw);
      setMsg({ type: "ok", text: res.message });
      setPw("");
      setConfirm("");
    } catch (e) {
      setMsg({ type: "error", text: apiError(e, "Could not reset the password.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="um-photo-box" style={{ display: "block", marginTop: 12 }}>
      <legend>Reset password</legend>
      <div className="um-grid">
        <div className="um-field">
          <label htmlFor="um-newpw">New password</label>
          <input id="um-newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={128} />
        </div>
        <div className="um-field">
          <label htmlFor="um-newpw2">Confirm new password</label>
          <input id="um-newpw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={128} />
        </div>
      </div>
      {msg && <p className={msg.type === "error" ? "um-error" : "um-hint"} role={msg.type === "error" ? "alert" : "status"}>{msg.text}</p>}
      <button type="button" className="um-btn um-btn-primary um-btn-sm" onClick={submit} disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
    </fieldset>
  );
};

export default ResetPasswordSection;

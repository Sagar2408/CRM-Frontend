import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../styles/adminsettings.css";
import SidebarToggle from "../admin/SidebarToggle";
import PageAccessControl from "./PageAccessControl";
import InactivityLogoutSettings from "./InactivityLogoutSettings";
import { useApi } from "../../context/ApiContext";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import { Alert, soundManager } from "../modal/alert";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { uploadAdminPhoto, fetchAdminPhotoBlob, deleteAdminPhoto } from "../../services/apiService";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MIN_PASSWORD_LENGTH = 6; // existing backend policy (validators/common.js)
export const SPREADSHEET_MESSAGE =
  "AdAgency360 provides you the ability to integrate your workflow with your spreadsheets in the future. Thank you for your patience!";

export const validatePhotoFile = (file) => {
  if (!file) return "Choose an image first.";
  if (!PHOTO_TYPES.includes(file.type)) return "Only JPEG, PNG or WEBP images are allowed.";
  if (file.size > PHOTO_MAX_BYTES) return "Image must be 2MB or smaller.";
  return null;
};

export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  if (!currentPassword) return "Enter your current password.";
  if (!newPassword) return "Enter a new password.";
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (newPassword === currentPassword) return "New password must be different from the current password.";
  if (newPassword !== confirmPassword) return "New password and confirm password do not match.";
  return null;
};

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

const MicrosoftLogo = () => (
  <svg viewBox="0 0 23 23" width="28" height="28" role="img" aria-label="Microsoft logo">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

const ExcelBadge = () => (
  <svg viewBox="0 0 32 32" width="40" height="40" role="img" aria-label="Excel icon">
    <rect width="32" height="32" rx="6" fill="#107C41" />
    <path d="M10 9l12 14M22 9L10 23" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const { user, fetchAdminUserData, handleUpdateProfile, handleChangePassword, isPasswordUpdating } = useApi();
  const { showLoader, hideLoader, isLoading, variant } = useLoading();
  const hasLoaded = useRef(false);
  const [alerts, setAlerts] = useState([]);

  const pushAlert = useCallback((type, title, message) => {
    setAlerts((prev) => [...prev, { id: Date.now() + Math.random(), type, title, message, duration: 5000 }]);
    soundManager.playSound(type);
  }, []);

  // ---- profile fields ----
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // ---- photo ----
  const [photoUrl, setPhotoUrl] = useState(null); // saved photo (object URL)
  const [pending, setPending] = useState(null); // { file, url } chosen but not saved
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);
  const photoUrlRef = useRef(null); // current saved-photo object URL (revoked on replace/unmount)

  // ---- password ----
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwError, setPwError] = useState("");

  // ---- integrations ----
  const [showSpreadsheetPopup, setShowSpreadsheetPopup] = useState(false);
  const okButton = useRef(null);

  useEffect(() => {
    const handleSidebarToggle = () => {
      const expanded = localStorage.getItem("adminSidebarExpanded") !== "false";
      document.body.classList.toggle("sidebar-collapsed", !expanded);
      document.body.classList.toggle("sidebar-expanded", expanded);
    };
    handleSidebarToggle();
    window.addEventListener("sidebarToggle", handleSidebarToggle);

    const init = async () => {
      if (hasLoaded.current) return;
      hasLoaded.current = true;
      try {
        showLoader("Loading settings...", "admin");
        await fetchAdminUserData();
      } catch (err) {
        console.error("Failed to load user settings:", err);
        pushAlert("error", "Load Failed", "Failed to load user settings.");
      } finally {
        hideLoader();
      }
    };
    init();
    return () => window.removeEventListener("sidebarToggle", handleSidebarToggle);
  }, [fetchAdminUserData, showLoader, hideLoader, pushAlert]);

  // Names were previously written to a non-existent `fullName` field and the
  // loaded values were never put into the inputs, so they never saved.
  useEffect(() => {
    if (user) {
      setFirstname(user.firstname || "");
      setLastname(user.lastname || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const loadPhoto = useCallback(async () => {
    try {
      const blob = await fetchAdminPhotoBlob();
      // Side effects (create/revoke) must not live inside a state updater:
      // React StrictMode runs updaters twice and would leak/revoke URLs.
      const next = blob ? URL.createObjectURL(blob) : null;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = next;
      setPhotoUrl(next);
    } catch (e) {
      console.error("Failed to load profile photo:", e);
    }
  }, []);

  useEffect(() => {
    loadPhoto();
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    };
  }, [loadPhoto]);

  useEffect(
    () => () => {
      if (pending?.url) URL.revokeObjectURL(pending.url);
    },
    [pending]
  );

  useEffect(() => {
    if (showSpreadsheetPopup) {
      okButton.current?.focus();
      const onKey = (e) => e.key === "Escape" && setShowSpreadsheetPopup(false);
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [showSpreadsheetPopup]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const fn = firstname.trim();
    const ln = lastname.trim();
    if (fn.length > 100 || ln.length > 100) {
      pushAlert("warning", "Invalid Name", "First and last name must be 100 characters or fewer.");
      return;
    }
    setProfileSaving(true);
    try {
      await handleUpdateProfile({ email: email.trim(), firstname: fn, lastname: ln });
      await fetchAdminUserData();
      pushAlert("success", "Profile Updated", "Profile updated successfully!");
    } catch (err) {
      console.error("Update failed:", err);
      pushAlert("error", "Update Failed", errorMessage(err, "Failed to update profile"));
    } finally {
      setProfileSaving(false);
    }
  };

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validatePhotoFile(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhotoError("");
    setConfirmDelete(false);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const savePhoto = async () => {
    if (!pending) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await uploadAdminPhoto(pending.file);
      setPending(null);
      await loadPhoto();
      window.dispatchEvent(new Event("adminPhotoChanged"));
      pushAlert("success", "Photo Updated", "Profile photo saved.");
    } catch (err) {
      setPhotoError(errorMessage(err, "Failed to upload photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await deleteAdminPhoto();
      setConfirmDelete(false);
      await loadPhoto();
      window.dispatchEvent(new Event("adminPhotoChanged"));
      pushAlert("success", "Photo Removed", "Profile photo removed.");
    } catch (err) {
      setPhotoError(errorMessage(err, "Failed to remove photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    const problem = validatePasswordChange(pw);
    setPwError(problem || "");
    if (problem) return;
    try {
      await handleChangePassword(pw.currentPassword, pw.newPassword);
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      pushAlert("success", "Password Updated", "Password updated successfully!");
    } catch (err) {
      const message = errorMessage(err, "Something went wrong.");
      setPwError(message);
      pushAlert("error", "Password Update Failed", message);
    }
  };

  const handleAlertClose = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "password", label: "Password" },
    { key: "pageAccess", label: "Page Access Controller" },
    { key: "autoLogout", label: "Auto Logout" },
    { key: "integrations", label: "Integrations" },
  ];

  const shownPhoto = pending?.url || photoUrl;

  const renderTabContent = () => {
    switch (activeTab) {
      case "pageAccess":
        return <PageAccessControl />;
      case "autoLogout":
        return <InactivityLogoutSettings onNotify={pushAlert} />;
      case "integrations":
        return (
          <>
            <h3>Integrations</h3>
            <div className="integration-cards">
              <div className="integration-card">
                <div className="integration-brand" aria-hidden="true">
                  <ExcelBadge />
                  <MicrosoftLogo />
                </div>
                <div className="integration-body">
                  <h4>Microsoft Excel / Spreadsheets</h4>
                  <p>Bring your spreadsheets into your workflow.</p>
                  <span className="integration-status">Not connected</span>
                </div>
                <button type="button" className="primary-btn" onClick={() => setShowSpreadsheetPopup(true)}>
                  Connect
                </button>
              </div>
            </div>
          </>
        );
      case "password":
        return (
          <>
            <h3>Change Password</h3>
            <form className="profile-form" onSubmit={submitPassword} noValidate>
              <div className="form-group full">
                <label htmlFor="as-current">Current Password</label>
                <input
                  id="as-current"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={pw.currentPassword}
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="as-new">New Password</label>
                  <input
                    id="as-new"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={pw.newPassword}
                    onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                  />
                  <small>At least {MIN_PASSWORD_LENGTH} characters.</small>
                </div>
                <div className="form-group">
                  <label htmlFor="as-confirm">Confirm Password</label>
                  <input
                    id="as-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    value={pw.confirmPassword}
                    onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
              {pwError && (
                <div className="form-group full settings-inline-error" role="alert">
                  {pwError}
                </div>
              )}
              <div className="form-group full save-btn-wrapper">
                <button className="save-btn" type="submit" disabled={isPasswordUpdating}>
                  {isPasswordUpdating ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </>
        );
      case "profile":
      default:
        return (
          <>
            <h3>Profile</h3>
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <div className="form-group full profile-pic">
                <label>Your Photo</label>
                <div className="pic-wrapper">
                  {shownPhoto ? (
                    <img src={shownPhoto} alt="Profile preview" className="profile-photo-img" />
                  ) : (
                    <AccountCircleIcon style={{ width: "80px", height: "80px" }} />
                  )}
                  <div className="pic-actions">
                    <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(",")} onChange={onPickPhoto} hidden aria-label="Choose profile photo" />
                    {pending ? (
                      <>
                        <button type="button" onClick={savePhoto} disabled={photoBusy}>
                          {photoBusy ? "Saving..." : "Save photo"}
                        </button>
                        <button type="button" onClick={() => setPending(null)} disabled={photoBusy}>
                          Cancel
                        </button>
                      </>
                    ) : confirmDelete ? (
                      <>
                        <span className="pic-confirm">Remove photo?</span>
                        <button type="button" onClick={removePhoto} disabled={photoBusy}>
                          Yes, remove
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(false)} disabled={photoBusy}>
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setConfirmDelete(true)} disabled={!photoUrl || photoBusy}>
                          Delete
                        </button>
                        <button type="button" onClick={() => fileInput.current?.click()} disabled={photoBusy}>
                          {photoUrl ? "Update" : "Upload"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <small>JPEG, PNG or WEBP, up to 2MB.</small>
                {photoError && (
                  <div className="settings-inline-error" role="alert">
                    {photoError}
                  </div>
                )}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="as-first">First Name</label>
                  <input id="as-first" type="text" maxLength={100} value={firstname} onChange={(e) => setFirstname(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="as-last">Last Name</label>
                  <input id="as-last" type="text" maxLength={100} value={lastname} onChange={(e) => setLastname(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="as-email">Email Address</label>
                  <input id="as-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={user?.username || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input type="text" value={user?.role || ""} readOnly />
                </div>
              </div>
              <div className="form-group full save-btn-wrapper">
                <button className="save-btn" type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </>
        );
    }
  };

  return (
    <div className="admin-settings">
      <SidebarToggle />
      {isLoading && variant === "admin" && <AdminSpinner text="Loading Settings..." />}
      <div className="settings-header">
        <h2>Settings</h2>
      </div>
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-card">{renderTabContent()}</div>

      {showSpreadsheetPopup && (
        <div className="settings-modal-backdrop" onClick={() => setShowSpreadsheetPopup(false)}>
          <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="ss-popup-title" onClick={(e) => e.stopPropagation()}>
            <h4 id="ss-popup-title">Microsoft Excel / Spreadsheets</h4>
            <p>{SPREADSHEET_MESSAGE}</p>
            <button ref={okButton} type="button" className="primary-btn" onClick={() => setShowSpreadsheetPopup(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      <Alert alerts={alerts} onClose={handleAlertClose} />
    </div>
  );
};

export default AdminSettings;

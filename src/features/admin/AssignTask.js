import React, { useState, useContext, useEffect } from "react";
import { useApi } from "../../context/ApiContext";
import { ThemeContext } from "../../features/admin/ThemeContext";
import SidebarToggle from "./SidebarToggle";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import { Alert, soundManager } from "../modal/alert";
import LeadImportDashboard from "../leadImport/LeadImportDashboard";
import { Modal } from "../leadImport/UploadWizard";

// "Upload Leads" page (Admin / HR / Manager / TL). Lead importing, workbook
// tracking and import history live here ONLY. The separate "Lead Assign"
// page (features/LeadAssign/TaskManagement) is untouched: imported leads reach
// it through the existing ClientLead APIs.

const getCurrentDate = () => new Date().toISOString().split("T")[0];
const emptyLead = () => ({
  name: "",
  email: "",
  phone: "",
  education: "",
  experience: "",
  state: "",
  country: "",
  dob: getCurrentDate(),
  countryPreference: "",
});

const FIELDS = [
  ["name", "Name *", "text"],
  ["email", "Email", "email"],
  ["phone", "Phone", "tel"],
  ["education", "Education", "text"],
  ["experience", "Experience", "text"],
  ["state", "State", "text"],
  ["country", "Country", "text"],
  ["dob", "Date of birth", "date"],
  ["countryPreference", "Country preference", "text"],
];

const AssignTask = () => {
  const [alerts, setAlerts] = useState([]);
  const [showSingle, setShowSingle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadData, setLeadData] = useState(emptyLead());
  const { isLoading, variant, showLoader, hideLoader } = useLoading();
  const { theme } = useContext(ThemeContext);
  const { createSingleLeadAPI } = useApi();

  const isSidebarExpanded = localStorage.getItem("adminSidebarExpanded") === "true";

  useEffect(() => {
    showLoader("Loading assign task...", "admin");
    const timeout = setTimeout(() => hideLoader(), 400);
    return () => clearTimeout(timeout);
  }, [showLoader, hideLoader]);

  const notify = (type, title, message) => {
    setAlerts((prev) => [...prev, { id: Date.now(), type, title, message, duration: 5000 }]);
    soundManager.playSound(type === "success" ? "success" : "error");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLeadData((prev) => ({ ...prev, [name]: value }));
  };

  // Single-lead creation: unchanged behaviour (same API), now in a modal.
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!leadData.name) return notify("error", "Missing Name", "Name is required");
    try {
      setSaving(true);
      await createSingleLeadAPI(leadData);
      notify("success", "Lead Created", "Lead created successfully!");
      setLeadData(emptyLead());
      setShowSingle(false);
    } catch (err) {
      notify("error", "Lead Creation Failed", err.message || "Failed to create lead. Please check all fields.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`assign-task-container ${isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
      data-theme={theme}
      style={{ minHeight: "100vh", padding: "20px", boxSizing: "border-box" }}
    >
      {isLoading && variant === "admin" && <AdminSpinner text="Loading assign task..." />}
      <SidebarToggle />
      <div className="assign-task-content" style={{ width: "100%", alignItems: "flex-start" }}>
        <LeadImportDashboard onAddSingle={() => setShowSingle(true)} />
      </div>

      {showSingle && (
        <Modal title="Add Single Lead" onClose={() => setShowSingle(false)}>
          <form onSubmit={handleFormSubmit}>
            <div className="li-grid">
              {FIELDS.map(([key, label, type]) => (
                <label key={key} className="li-field">
                  <span>{label}</span>
                  <input className="li-input" type={type} name={key} value={leadData[key]} onChange={handleInputChange} aria-label={label} />
                </label>
              ))}
            </div>
            <div className="li-actions">
              <button type="button" className="li-btn" onClick={() => setShowSingle(false)}>
                Cancel
              </button>
              <button type="submit" className="li-btn primary" disabled={saving}>
                {saving ? "Creating…" : "Create Lead"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <Alert alerts={alerts} onClose={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))} />
    </div>
  );
};

export default AssignTask;

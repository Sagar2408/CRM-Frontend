import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SidebarToggle from "./SidebarToggle";
import {
  faSave,
  faEye,
  faEyeSlash,
  faUser,
  faEnvelope,
  faGlobe,
  faCity,
  faMapMarkerAlt,
  faBarcode,
  faUsers,
  faBriefcase,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { useApi } from "../../context/ApiContext";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import { Alert, soundManager } from "../modal/alert";
import { useNavigate } from "react-router-dom";

const ExecutiveCredentialsForm = () => {
  const [sidebarCollapsed] = useState(
    localStorage.getItem("adminSidebarExpanded") === "false"
  );
  const { createExecutive, createAdmin, createTeamLead, createManager, createHr } = useApi();
  const [showPassword, setShowPassword] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [errors, setErrors] = useState({});
  const { isLoading, variant, showLoader, hideLoader } = useLoading();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    firstname: "",
    lastname: "",
    country: "",
    city: "",
    state: "",
    postal_code: "",
    tax_id: "",
    profile_picture: null,
    role: "",
    team_id: "",  
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prevErrors) => ({ ...prevErrors, [name]: null }));
    }
  };


  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  useEffect(() => {
    showLoader("Loading Create user Page...", "admin");
  
    const timeout = setTimeout(() => {
      hideLoader();
    }, 400);
  
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    showLoader("Creating user account...", "admin");

    try {
      const formPayload = new FormData();
      if (formData.role === "Manager") {
        formPayload.append("name", formData.username);
        formPayload.append("email", formData.email);
        formPayload.append("password", formData.password);
      } else if (formData.role === "Hr") {
        formPayload.append("name", formData.username);
        formPayload.append("email", formData.email);
        formPayload.append("password", formData.password);
      } else {
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== null && value !== "") {
            formPayload.append(key, value);
          }
        });
      }

      for (let pair of formPayload.entries()) {
        console.log(`${pair[0]}:`, pair[1]);
      }

      // Role-based API call
      const role = formData.role.trim();
      switch (role) {
        case "Executive":
          await createExecutive(formPayload);
          break;
        case "TL":
          await createTeamLead(formPayload);
          break;
        case "Admin":
          await createAdmin(formPayload);
          break;
        case "Manager":
          await createManager(formPayload);
          break;
        case "Hr":
          await createHr(formPayload);
          break;
        default:
          throw new Error("Invalid role selected.");
      }

      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "success",
          title: "Account Created",
          message: `${formData.role} created successfully!`,
          duration: 5000,
        },
      ]);
      soundManager.playSound("success");

      if (role === "Executive") {
        // TEMPORARY: Create Executive no longer requires email OTP
        // verification, so there is no pending UnverifiedUser to confirm
        // on the /admin/verify page. Reset the form instead of
        // redirecting there. See apiService.js createExecutiveAPI for
        // how to restore the OTP step.
        setFormData({
          username: "",
          email: "",
          password: "",
          firstname: "",
          lastname: "",
          country: "",
          city: "",
          state: "",
          postal_code: "",
          tax_id: "",
          profile_picture: null,
          role: "",
          team_id: "",
        });
      } else {
        localStorage.setItem("executiveData", JSON.stringify({ email: formData.email }));

        setTimeout(() => {
          navigate("/admin/verify");
        }, 100); // 100ms gives browser enough time to store it
      }
      } catch (err) {
      console.error(`Failed to create ${formData.role}:`, err.message || err);
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "Creation Failed",
          message: `Error creating ${formData.role}: ${err.message || "Unknown error"}`,
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
    } finally {
      hideLoader();
    }
  };

  const handleAlertClose = (id) => {
    setAlerts(alerts.filter((alert) => alert.id !== id));
  };

  return (
    <div className={`create-executive-container ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      <div className="create-executive-content-area">
        <SidebarToggle />

        <div className="executive-form-container">
          {isLoading && variant === "admin" && (
            <AdminSpinner text="Loading Create User Page..." />
          )} 
          <div className="form-card">
            <div className="form-header">
              <h1>Create User Credentials</h1>
              <p>Add a new user to your CRM with appropriate access permissions</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="left-column">
                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="username"
                        name="username"
                        placeholder="Enter Username"
                        value={formData.username}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="firstname">First Name</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="firstname"
                        name="firstname"
                        placeholder="Enter First Name"
                        value={formData.firstname}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="country">Country</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faGlobe} className="input-icon" />
                      <input
                        type="text"
                        id="country"
                        name="country"
                        placeholder="Enter Country"
                        value={formData.country}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="state">State</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
                      <input
                        type="text"
                        id="state"
                        name="state"
                        placeholder="Enter State"
                        value={formData.state}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  {formData.role === "Manager" && (
                    <div className="form-group">
                      <label htmlFor="team_id">Team ID</label>
                      <div className="input-with-icon">
                        <FontAwesomeIcon icon={faUsers} className="input-icon" />
                        <input
                          type="text"
                          id="team_id"
                          name="team_id"
                          placeholder="Enter Team ID"
                          value={formData.team_id || ""}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="right-column">
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="Enter Email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastname">Last Name</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="lastname"
                        name="lastname"
                        placeholder="Enter Last Name"
                        value={formData.lastname}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faCity} className="input-icon" />
                      <input
                        type="text"
                        id="city"
                        name="city"
                        placeholder="Enter City"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="postal_code">Postal Code</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faBarcode} className="input-icon" />
                      <input
                        type="text"
                        id="postal_code"
                        name="postal_code"
                        placeholder="Enter Postal Code"
                        value={formData.postal_code}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="role">Role</label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faBriefcase} className="input-icon" />
                      <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="" disabled>Select Role</option>
                        <option value="Executive">Executive</option>
                        <option value="TL">Team Lead</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Hr">Hr</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label htmlFor="password">Password</label>
                  <div className="input-with-icon password-input">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      placeholder="Enter Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />
                    <button type="button" onClick={togglePasswordVisibility} className="password-toggle">
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className={`submit-button ${isLoading ? "loading" : ""}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="button-spinner"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faSave} />
                      Create User Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          <Alert alerts={alerts} onClose={handleAlertClose} />
        </div>
      </div>
    </div>
  );
};

export default ExecutiveCredentialsForm;
import React, { useState, useContext, useEffect } from "react";
import { useApi } from "../../context/ApiContext";
import { ThemeContext } from "../../features/admin/ThemeContext";
import SidebarToggle from "./SidebarToggle";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudUploadAlt, faSpinner, faUser, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import { Alert, soundManager } from "../modal/alert";

const AssignTask = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [alerts, setAlerts] = useState([]); // Replaced error and success with alerts
  const [isFormMode, setIsFormMode] = useState(false); // Toggle between file and form
  const { isLoading, variant, showLoader, hideLoader } = useLoading();
  // Helper function to get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [leadData, setLeadData] = useState({
    name: "",
    email: "",
    phone: "",
    education: "",
    experience: "",
    state: "",
    country: "",
    dob: getCurrentDate(), // Set current date as default
    countryPreference: "",
  });

  const { theme } = useContext(ThemeContext);
  const { uploadFileAPI, createSingleLeadAPI } = useApi();

  const isSidebarExpanded =
    localStorage.getItem("adminSidebarExpanded") === "true";

  // Update date to current date when component mounts or when form is reset
  useEffect(() => {
    setLeadData(prev => ({
      ...prev,
      dob: getCurrentDate()
    }));
  }, []);

  // Handle file change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    if (selectedFile && validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setAlerts([]); // Clear alerts
    } else {
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "Invalid File",
          message: "Please upload a valid CSV or Excel file",
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
      setFile(null);
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLeadData((prev) => {
      const updatedData = { ...prev, [name]: value };
      console.log("Updated leadData:", updatedData); // Debug log
      return updatedData;
    });
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!file) {
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "No File Selected",
          message: "Please select a file first",
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
      return;
    }

    try {
      setUploading(true);
      setAlerts([]);
       await uploadFileAPI(file);
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "success",
          title: "Upload Successful",
          message: "File uploaded successfully!",
          duration: 5000,
        },
      ]);
      soundManager.playSound("success");
      setFile(null);
      document.getElementById("file-upload").value = "";
    } catch (err) {
      console.error("Upload failed:", err);
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "Upload Failed",
          message: err.message || "Failed to upload file",
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
    } finally {
      setUploading(false);
    }
  };

  // Handle form submission
  const handleFormSubmit = async () => {
    console.log("Submitting leadData:", leadData); // Debug log
    if (!leadData.name) {
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "Missing Name",
          message: "Name is required",
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
      return;
    }

    try {
      setUploading(true);
      setAlerts([]);
       await createSingleLeadAPI(leadData);
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "success",
          title: "Lead Created",
          message: "Lead created successfully!",
          duration: 5000,
        },
      ]);
      soundManager.playSound("success");
      // Reset form with current date
      setLeadData({
        name: "",
        email: "",
        phone: "",
        education: "",
        experience: "",
        state: "",
        country: "",
        dob: getCurrentDate(), // Reset to current date
        countryPreference: "",
      });
    } catch (err) {
      console.error("Lead creation failed:", err);
      setAlerts([
        ...alerts,
        {
          id: Date.now(),
          type: "error",
          title: "Lead Creation Failed",
          message: err.message || "Failed to create lead. Please check all fields.",
          duration: 5000,
        },
      ]);
      soundManager.playSound("error");
    } finally {
      setUploading(false);
    }
  };

  // Handle alert close
  const handleAlertClose = (id) => {
    setAlerts(alerts.filter((alert) => alert.id !== id));
  };

  useEffect(() => {
    showLoader("Loading assign task...", "admin");
  
    const timeout = setTimeout(() => {
      hideLoader();
    }, 400);
  
    return () => clearTimeout(timeout);
  }, [showLoader, hideLoader]);
  
  // Function to set date to today (for button functionality)
  const setToday = () => {
    setLeadData(prev => ({
      ...prev,
      dob: getCurrentDate()
    }));
  };

  const gradientTextStyle = {
    background: "linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c)",
    backgroundSize: "300% 300%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    animation: "gradientShift 3s ease infinite",
  };


  const inputStyle = {
    padding: "12px 15px",
    borderRadius: "12px",
    border: theme === "dark" ? "1px solid #444" : "1px solid #ddd",
    color: theme === "dark" ? "#f0f0f0" : "#222222",
    background: theme === "dark" 
      ? "linear-gradient(135deg, rgba(60, 60, 60, 0.8), rgba(80, 80, 80, 0.6))" 
      : "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(250, 250, 250, 0.8))",
    fontSize: "14px",
    transition: "all 0.3s ease",
    backdropFilter: "blur(5px)",
  };

  return (
    <>
      <style>
        {`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          @keyframes iconPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          
          .animated-icon {
            animation: iconPulse 2s ease-in-out infinite;
          }
          
          .form-input:focus {
            outline: none;
            border: 2px solid #667eea;
            box-shadow: 0 0 15px rgba(102, 126, 234, 0.3);
            transform: translateY(-2px);
          }
          
          .form-input:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .date-input-container {
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .today-btn {
            padding: 6px 12px;
            font-size: 12px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
            white-space: nowrap;
          }

        .today-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }
            [data-theme="dark"] .form-input::placeholder {
             color: rgba(240, 240, 240, 0.7);
           }

          [data-theme="light"] .form-input::placeholder {
               color: rgba(0, 0, 0, 0.6);
          }

          .form-input::placeholder {
           transition: color 0.3s ease;
           }
            [data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1); 
            }
        `}
      </style>
      
      <div
        className={`assign-task-container ${isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
        data-theme={theme}
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        {isLoading && variant === "admin" && (
          <AdminSpinner text="Loading assign task..." />
        )}
        <SidebarToggle />
        <div className="assign-task-content" style={{ width: "100%", maxWidth: "900px" }}>

          <div
            className="background-text"
            style={{
              textAlign: "center",
              marginLeft: "-60px",
              fontWeight: "bolder",
              ...gradientTextStyle,
            }}
          >
            CRM
          </div>

          <div
            className="assign-task-glass-card"
            style={{
              backdropFilter: "blur(15px) saturate(150%)",
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, rgba(50, 50, 50, 0.4), rgba(80, 80, 80, 0.2))"
                  : "linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(240, 240, 240, 0.5))",
              borderRadius: "24px",
              boxShadow:
                theme === "dark"
                  ? "0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)"
                  : "0 10px 30px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.8)",
              border:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.2)"
                  : "1px solid rgba(0, 0, 0, 0.1)",
              maxWidth: "700px",
              boxSizing: "border-box",
              transition: "all 0.3s ease",
              marginLeft: "-10px"
            }}
          >
            <h2
              style={{
                textAlign: "center",
                marginBottom: "15px",
                fontSize: "2rem",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "15px",
                ...gradientTextStyle,
              }}
            >
              <FontAwesomeIcon 
                icon={isFormMode ? faUserPlus : faCloudUploadAlt} 
                className="animated-icon"
                style={{
                  background: "linear-gradient(45deg, #667eea, #764ba2)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              />
              {isFormMode ? "Create Single Lead" : "Upload Task File"}
            </h2>

            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <button
                onClick={() => setIsFormMode(!isFormMode)}
                style={{
                  padding: "12px 25px",
                  fontSize: "1rem",
                  borderRadius: "25px",
                  border: "none",
                  background: isFormMode
                    ? "linear-gradient(135deg, #667eea, #764ba2)"
                    : "linear-gradient(135deg, #ff6b6b, #ff8e53)",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  fontWeight: "600",
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
                }}
              >
                {isFormMode ? "Switch to File Upload" : "Switch to Form Input"}
              </button>
            </div>

            {isFormMode ? (
              <div>
                <h3 style={{
                  textAlign: "center",
                  marginBottom: "25px",
                  fontSize: "1.3rem",
                  fontWeight: "600",
                  color: theme === "dark" ? "#f0f0f0" : "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}>
                  <FontAwesomeIcon icon={faUser} style={{ color: "#667eea" }} />
                  Personal Information
                </h3>
                
                <div className="lead-form" style={{ 
                  display: "grid", 
                  width: "650px",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}>
                  {/* Left Column */}
                  <input
                    type="text"
                    name="name"
                    value={leadData.name}
                    onChange={handleInputChange}
                    placeholder="Full Name *"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="email"
                    name="email"
                    value={leadData.email}
                    onChange={handleInputChange}
                    placeholder="Email Address"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="text"
                    name="phone"
                    value={leadData.phone}
                    onChange={handleInputChange}
                    placeholder="Phone Number"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="text"
                    name="education"
                    value={leadData.education}
                    onChange={handleInputChange}
                    placeholder="Education Level"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="text"
                    name="experience"
                    value={leadData.experience}
                    onChange={handleInputChange}
                    placeholder="Years of Experience"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="text"
                    name="state"
                    value={leadData.state}
                    onChange={handleInputChange}
                    placeholder="State/Province"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  <input
                    type="text"
                    name="country"
                    value={leadData.country}
                    onChange={handleInputChange}
                    placeholder="Current Country"
                    className="form-input"
                    style={inputStyle}
                  />
                  
                  {/* Date input with "Today" button */}
                  <div className="date-input-container">
                    <input
                      type="date"
                      name="dob"
                      value={leadData.dob}
                      onChange={handleInputChange}
                      placeholder="Date of Birth"
                      className="form-input"
                      style={{...inputStyle, flex: 1}}
                    />
                    <button
                      type="button"
                      onClick={setToday}
                      className="today-btn"
                      title="Set to today's date"
                    >
                      Today
                    </button>
                  </div>
                  
                  {/* Country Preference spans both columns */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <input
                      type="text"
                      name="countryPreference"
                      value={leadData.countryPreference}
                      onChange={handleInputChange}
                      placeholder="Preferred Destination Country"
                      className="form-input"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="upload-box" style={{ marginBottom: "15px" }}>
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  accept=".csv, .xlsx, .xls"
                  disabled={uploading}
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="file-upload"
                  className="upload-label"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px dashed #667eea",
                    padding: "40px 20px",
                    cursor: "pointer",
                    borderRadius: "15px",
                    textAlign: "center",
                    background: theme === "dark" 
                      ? "linear-gradient(135deg, rgba(60, 60, 60, 0.3), rgba(80, 80, 80, 0.1))" 
                      : "linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = theme === "dark" 
                      ? "linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))" 
                      : "linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = theme === "dark" 
                      ? "linear-gradient(135deg, rgba(60, 60, 60, 0.3), rgba(80, 80, 80, 0.1))" 
                      : "linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))";
                  }}
                >
                  <FontAwesomeIcon
                    icon={uploading ? faSpinner : faCloudUploadAlt}
                    spin={uploading}
                    className={uploading ? "" : "animated-icon"}
                    style={{
                      fontSize: "3rem",
                      background: "linear-gradient(45deg, #667eea, #764ba2)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      marginBottom: "15px",
                    }}
                  />
                  <span
                    className="upload-text"
                    style={{ 
                      marginBottom: "10px", 
                      fontWeight: "600",
                      fontSize: "1.1rem",
                      color: theme === "dark" ? "#f0f0f0" : "#333",
                    }}
                  >
                    {file ? file.name : "Drag & drop or click to browse"}
                  </span>
                  {file && (
                    <span
                      className="file-size"
                      style={{
                        fontSize: "0.9rem",
                        color: theme === "dark" ? "#d1d1d1" : "#666666",
                        background: "linear-gradient(45deg, #667eea, #764ba2)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: "500",
                      }}
                    >
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  )}
                </label>
              </div>
            )}

            <button
              onClick={isFormMode ? handleFormSubmit : handleFileUpload}
              className="upload-button"
              disabled={uploading || (!isFormMode && !file)}
              style={{
                width: "100%",
                padding: "16px 20px",
                fontSize: "1.2rem",
                fontWeight: "700",
                border: "none",
                borderRadius: "15px",
                cursor: uploading || (!isFormMode && !file) ? "not-allowed" : "pointer",
                background:
                  uploading || (!isFormMode && !file)
                    ? "linear-gradient(135deg, #888, #aaa)"
                    : "linear-gradient(135deg, #667eea, #764ba2, #f093fb)",
                backgroundSize: "200% 200%",
                color: "#fff",
                boxShadow:
                  uploading || (!isFormMode && !file)
                    ? "none"
                    : "0 6px 20px rgba(102, 126, 234, 0.4)",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                animation: uploading || (!isFormMode && !file) ? "none" : "gradientShift 3s ease infinite",
              }}
              onMouseOver={(e) => {
                if (!uploading && (isFormMode || file)) {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.6)";
                }
              }}
              onMouseOut={(e) => {
                if (!uploading && (isFormMode || file)) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
                }
              }}
            >
              {uploading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Processing...
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  🚀 {isFormMode ? "Create Lead" : "Upload File"}
                </span>
              )}
            </button>
          </div>
        </div>
        <Alert alerts={alerts} onClose={handleAlertClose} />
      </div>
    </>
  );
};

export default AssignTask;


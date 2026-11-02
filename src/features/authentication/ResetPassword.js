import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../../styles/signup.css";
import { useAuth } from "../../context/AuthContext";

const ResetPassword = () => {
  const { resetPassword, loading } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  // const navigate = useNavigate();
  const location = useLocation();

  const token = new URLSearchParams(location.search).get("token");
  useEffect(() => {}, [token]);

  const handleResetPassword = (e) => {
    e.preventDefault();
    resetPassword(token, newPassword, companyCode);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        {/* Icons for Reset Password */}
        <div className="icons-container">
          <i className="fas fa-key"></i> {/* Key Icon */}
        </div>

        <h2>Reset Password</h2>
        <p>Enter your new password below.</p>
        <form onSubmit={handleResetPassword}>
          <input
            type="text"
            placeholder="Company Code"
            required
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
          />
          <input
            type="password"
            placeholder="Enter new password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
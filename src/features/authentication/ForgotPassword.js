import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/signup.css";
import { FaLock } from "react-icons/fa";

const ForgotPassword = () => {
  const { forgotPassword, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  const handleForgotPassword = (e) => {
    e.preventDefault();
    forgotPassword(email, companyCode);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <FaLock className="auth-icon" /> {/* Lock Icon */}
        <h2>Forgot Password</h2>
        <p>Enter your email to receive a password reset link.</p>
        <form onSubmit={handleForgotPassword}>
          <input
            type="text"
            placeholder="Company Code"
            required
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
          />
          <input
            type="email"
            placeholder="Enter your email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          <p className="login-link">
            Remembered your password? <a href="/login">Login here</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
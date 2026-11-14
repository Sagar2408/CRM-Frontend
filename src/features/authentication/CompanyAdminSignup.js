import "../../styles/signup.css"; // login/signup card layout (was only loaded by the removed ForgotPassword page)
import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerCompanyAdmin } from "../../services/companyAdminAuth";

const CompanyAdminSignup = () => {
  const navigate = useNavigate();
  const [companyCode, setCompanyCode] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      setLoading(true);
      try {
        await registerCompanyAdmin({
          companyCode: companyCode.trim(),
          invitationToken: invitationToken.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        });
        toast.success("Your admin account is ready! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } catch (error) {
        toast.error(error.message || "Signup failed");
      } finally {
        setLoading(false);
      }
    },
    [companyCode, invitationToken, email, password, confirmPassword, navigate]
  );

  return (
    <div className="main-container">
      <div className="container">
        <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeButton />

        <div className="right-half" style={{ width: "100%" }}>
          <div className="login-form">
            <div className="create">Company Admin First-Time Registration</div>
            <p className="small-text">
              Already have an account?{" "}
              <Link to="/login" style={{ color: "black" }}>
                Login
              </Link>
            </p>
            <p style={{ paddingTop: "4px", fontSize: "0.85em", color: "#666" }}>
              Use the Company Code, your invited email address and the one-time Invitation Token
              your Master Admin gave you, then choose your own password. Nobody else ever sees or sets it.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Company Code"
                required
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
              />
              <input
                type="text"
                placeholder="Invitation Token"
                required
                autoComplete="off"
                value={invitationToken}
                onChange={(e) => setInvitationToken(e.target.value)}
              />
              <input
                type="email"
                placeholder="Registered Admin Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="New Password (min 8 characters)"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm Password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? "Registering..." : "Register Admin Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyAdminSignup;

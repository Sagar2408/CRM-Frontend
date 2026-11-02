import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { signupCompanyAdmin } from "../../services/companyAdminAuth";

const CompanyAdminSignup = () => {
  const navigate = useNavigate();
  const [companyCode, setCompanyCode] = useState("");
  const [adminSignupToken, setAdminSignupToken] = useState("");
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

      setLoading(true);
      try {
        await signupCompanyAdmin({
          companyCode,
          adminSignupToken,
          email,
          password,
          confirmPassword,
        });
        toast.success("Admin account created! Redirecting to login...");
        setTimeout(() => navigate("/admin/login"), 2000);
      } catch (error) {
        toast.error(error.message || "Signup failed");
      } finally {
        setLoading(false);
      }
    },
    [companyCode, adminSignupToken, email, password, confirmPassword, navigate]
  );

  return (
    <div className="main-container">
      <div className="container">
        <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeButton />

        <div className="right-half" style={{ width: "100%" }}>
          <div className="login-form">
            <div className="create">Create Your Company Admin Account</div>
            <p className="small-text">
              Already have an account?{" "}
              <Link to="/admin/login" style={{ color: "black" }}>
                Login
              </Link>
            </p>
            <p style={{ paddingTop: "4px", fontSize: "0.85em", color: "#666" }}>
              Use the Company Code and Admin Registration Token your Master Admin / Sales
              contact gave you. This can only be done once per company.
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
                placeholder="Admin Registration Token"
                required
                value={adminSignupToken}
                onChange={(e) => setAdminSignupToken(e.target.value)}
              />
              <input
                type="email"
                placeholder="Admin Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm Password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Admin Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyAdminSignup;

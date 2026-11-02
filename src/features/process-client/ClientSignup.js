import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // ✅ import useNavigate
import { useProcess } from "../../context/ProcessAuthContext";

const ClientSignup = () => {
  const { signup } = useProcess();
  const navigate = useNavigate(); // ✅ hook for programmatic navigation

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");


  const handleSignup = async () => {
    try {
      await signup(fullName, email, password, "processperson", companyCode);
      alert("Signup successful!");

      // ✅ Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/process/client/login");
      }, 2000);
    } catch (error) {
      alert(error.message);
    }
  };
  return (
    <div className="process-auth-wrapper">
      <div className="process-auth-card">
        <h2>Create your account</h2>
        <p>Sign up to join the community of book lovers.</p>

        <input
          type="text"
          placeholder="Company Code"
          value={companyCode}
          onChange={(e) => setCompanyCode(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter your name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="process-primary-btn" onClick={handleSignup}>
          Sign up
        </button>

        <p className="process-footer-text">
          Already have an account? <Link to="/process/client/login">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default ClientSignup;
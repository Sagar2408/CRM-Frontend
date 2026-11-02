import React, { useState } from "react";
import { useNavigate,useLocation } from "react-router-dom"; // ✅ import useNavigate
import { useProcess } from "../../context/ProcessAuthContext";
import { ToastContainer } from "react-toastify";

const CustomerLogin = () => {
  const { login } = useProcess();
  const navigate = useNavigate(); // ✅ initialize navigate hook
  const location=useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const from = location.state?.from?.pathname || "/customer/client/dashboard";
  const handleLogin = async () => {
    try {
      await login(email, password, companyCode);
      localStorage.setItem("userType", "customer");
  
    setTimeout(() => {
      navigate(from, { replace: true });
    }, 2000);   
     // navigate("/customer/client/dashboard");
      
    } catch (error) {
      alert(error.message);
    }
  };


  return (
    <div className="process-auth-wrapper">
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar closeButton />
      <div className="process-auth-card">
        <h2>Welcome back!</h2>
        <p>Log in to your account to continue exchanging books and discovering new editions.</p>

        <input
          type="text"
          placeholder="Company Code"
          value={companyCode}
          onChange={(e) => setCompanyCode(e.target.value)}
        />
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="process-primary-btn" onClick={handleLogin}>
          Log in
        </button>

        <a href="process-forgot-password" className="process-link">Forgot password?</a>

       
      </div>
    </div>
  );
};

export default CustomerLogin;
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import "react-toastify/dist/ReactToastify.css";
import img1 from "../../assets/img1.jpg";
import img3 from "../../assets/img2.jpg";
import img4 from "../../assets/img3.jpg";

const LoginHr = ({ userType }) => {
  const { handleLoginHr } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Memoize slides to prevent recreation on every render
  const slides = useMemo(
    () => [
      { text: "Fast & Secure", img: img1 },
      { text: "User-Friendly Interface", img: img4 },
      { text: "24/7 Support", img: img3 },
    ],
    []
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [slides.length]);

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        await handleLoginHr(email, password, companyCode);

        // Navigate to HR dashboard after successful login
        navigate("/hr");
      } catch (error) {
        console.error("Login failed:", error);
      } finally {
        setLoading(false);
      }
    },
    [email, password, companyCode, handleLoginHr, navigate]
  );

  return (
    <div className="main-container">
      <div className="container">
        <ToastContainer
          position="top-right"
          autoClose={2000}
          hideProgressBar
          closeButton
        />

        <div className="left-half">
          <div className="image-wrapper">
            <img
              src={slides[currentIndex].img}
              alt="Slide"
              className="background-img"
            />

            <div className="slider-overlay">
              <div className="slider-text">
                {slides[currentIndex].text}
              </div>

              <div className="indicator-container">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    className={`indicator-line ${
                      i === currentIndex ? "active" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="right-half">
          <div className="login-form">
            <div className="create">Login to your Account</div>

            <p style={{ paddingTop: "10px" }}>
              Enter your credentials
            </p>

            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Company Code"
                required
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
              />

              <input
                type="email"
                placeholder="Email"
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

              <button type="submit" disabled={loading}>
                {loading ? "Logging in..." : "SIGN IN"}
              </button>

              <div className="text-bottom">
                <Link
                  to="/forgot-password"
                  style={{
                    color: "black",
                    marginTop: "10px",
                  }}
                >
                  Forgot Password
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginHr;
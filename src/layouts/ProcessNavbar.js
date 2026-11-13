import React, { useState,useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/process.css';
import { FaBars, FaTimes,FaBell } from 'react-icons/fa';
import { useProcess } from '../context/ProcessAuthContext';
import { useProcessService } from '../context/ProcessServiceContext';

const ProcessNavbar = ({count}) => {
  const{fetchNotifications}=useProcessService();
  const [isMobile, setIsMobile] = useState(false);


  const navigate = useNavigate();
  const { logout, user } = useProcess(); // ✅ Get `user` from context
const userRole = localStorage.getItem("userType");
  const handleLogout = async () => {
    try {
      await logout();
  
      const userType = localStorage.getItem("userType");
  
      if (userType === "customer") {
        navigate("/login");
      } else if (userType === "processperson") {
        navigate("/login");
      } else {
        // Fallback if userType is not set or unknown
        navigate("/");
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
   

useEffect(() => {
  const getNotifications = async () => {
    if (userRole === "customer") {
      try {
        await fetchNotifications(userRole);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    }
  };

  getNotifications();
}, [userRole, fetchNotifications]);

  const dashboardTitle = user?.type === 'processperson' ? 'Process Dashboard' : 'Client Dashboard';
    const [selectedRole, setSelectedRole] = useState("processperson"); 
 const handleToggle = (role) => {
    setSelectedRole(role);
    if (role === "processperson") {
      navigate("/processperson/client/all-clients");
    } else if (role === "process") {
      navigate("/process");
    }
  };
   const onToggleClick = () => {
    if (selectedRole === "process") {
      handleToggle("processperson");
    } else {
      handleToggle("process");
    }
  };
  
  return (
    <nav className="process-navbar">
      <h2 className="process-navbar-logo">{dashboardTitle}</h2>

      <ul
        className={isMobile ? "process-nav-links-mobile" : "process-nav-links"}
        onClick={() => setIsMobile(false)}
      >
        {user?.type === "customer" && (
          <li><Link to="/customer/client/dashboard">Dashboard</Link></li>
          
        )}
{user?.type === "customer" && (
        <li><Link to="/customer/client/upload">Upload</Link></li>
        )}
         {/* ✅ Only show this link to processperson */}
          {user?.type === 'processperson' && (
            <li><Link to="/processperson/client/all-clients">Clients</Link></li>
          )}
          {user?.type === 'customer' && (
            <li><Link to="/customer/client/settings">Settings</Link></li>
          )}
        
          {/* <li><Link to="/process/client/settings">Settings</Link></li> */}
           {user?.type === 'processperson' && (
            <div className="role-switch-wrapper1">
  <div className="switch-label1">Process Dashboard</div>
  <div className="role-switch-container" onClick={onToggleClick}>
    <div
      className={`switch-slider ${
        selectedRole === "process" ? "left" : "right"
      }`}
    ></div>
  </div>
</div>
    )}
     {user?.type === 'customer' && (
    <li><Link to="/customer/client/notifications"><li style={{ position: "relative" }}>
  <FaBell style={{ color: 'white', fontSize: '20px', cursor: "pointer" }} />
  {count > 0 && (
    <span
      style={{
        position: "absolute",
        top: "-5px",
        right: "-5px",
        backgroundColor: "red",
        color: "white",
        borderRadius: "50%",
        padding: "0px 4px",
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      {count}
    </span>
  )}
</li>
</Link></li>    )}
        <li><button className="process-logout-btn" onClick={handleLogout}>Logout</button></li>
      </ul>

      <button
        className="process-mobile-menu-icon"
        onClick={() => setIsMobile(!isMobile)}
      >
        {isMobile ? <FaTimes /> : <FaBars />}
      </button>
    </nav>
  );
};

export default ProcessNavbar;
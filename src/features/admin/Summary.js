import React, { useState, useEffect } from "react";
import { FaUserPlus, FaTimesCircle, FaClipboardCheck, FaUsers } from "react-icons/fa";
import { useApi } from "../../context/ApiContext";
import { useNavigate } from "react-router-dom";
import "../../styles/admin.css";

const Summary = () => {
  const [activeBox, setActiveBox] = useState(null);
  const navigate = useNavigate();

  const handleBoxClick = (index) => {
    setActiveBox(activeBox === index ? null : index);
  
    // Determine status
    let status = "";
    switch (index) {
      case 0:
        status = "New";
        break;
      case 1:
        status = "Follow-Up";
        break;
      case 2:
        status = "Converted";
        break;
      case 3:
        status = "Closed";
        break;
      default:
        status = "";
    }
  
    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem("user"));
  
    if (!user || !user.role) {
      console.error("User role not found in localStorage");
      return;
    }
  
// Build path based on role
let basePath = "";
switch (user.role.toLowerCase()) {

   case "hr":
    basePath = "/hr/executive-assignments";
    break;
     case "admin":
    basePath = "/admin/executive-assignments";
    break;
  case "manager":
    basePath = "/manager/executive-assignments";
    break;
 
  default:
    console.error("Unknown role:", user.role);
    return;
}

// Navigate with status filter
navigate(basePath, {
  state: { filterStatus: status }
});
};

  const { dealFunnel, getDealFunnel } = useApi();

  useEffect(() => {
    const fetchData = async () => {
      try {
        await getDealFunnel();
      } catch (error) {
        console.error("Error fetching fresh leads:", error);
      }
    };

    fetchData();
  }, [getDealFunnel]);

  const summaryItems = [
    {
      icon: <FaUserPlus className="box-icon" />,
      title: <div>{dealFunnel?.statusCounts?.New || 0}</div>,
      subtitle: "Fresh Leads"
    },
    {
      icon: <FaClipboardCheck className="box-icon" />,
      title: <div>{dealFunnel?.statusCounts?.["Follow-Up"] || 0}</div>,
      subtitle: "Follow-up"
    },
    {
      icon: <FaUsers className="box-icon" />,
      title: <div>{dealFunnel?.statusCounts?.Converted || 0}</div>,
      subtitle: "Converted"
    },
    {
      icon: <FaTimesCircle className="box-icon" />,
      title: <div>{dealFunnel?.statusCounts?.Closed || 0}</div>,
      subtitle: "Closed"
    }
  ];

  return (
    <div className="summary">
      {summaryItems.map((item, index) => (
        <div
          key={index}
          className={`box box-hover-${index} ${activeBox === index ? "active" : ""}`}
          onClick={() => handleBoxClick(index)}
        >
          <div className="box-content">
            <div className="admin-card-icon">{item.icon}</div>
            <div>
              <h3 className={`box-title title-${index}`}>{item.title}</h3>
              <small>{item.subtitle}</small>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Summary;
import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import axios from "axios";
import "../../styles/calendar.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AdminCalendar = () => {
  const [holidays, setHolidays] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    async function fetchHolidays() {
      try {
        const getToken = () => localStorage.getItem("token");
        const res = await axios.get(
          `${API_BASE_URL}/holidays?year=${year}&month=${month}`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );
        console.log(res);
        setHolidays(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch holidays", err);
      }
    }

    fetchHolidays();
  }, [currentDate]);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`; // e.g. "2025-08-03"
  };

  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const d = formatDate(date);
      //const localDate = date.toLocaleDateString("en-CA"); // Format: YYYY-MM-DD

      const holiday = holidays.find((h) => h.date === d);
      if (holiday?.name === "Sunday") return "sunday";
      if (holiday) return "holiday";
    }
    return null;
  };

  const toggleCalendar = () => {
    setIsExpanded(!isExpanded);
  };

  const onDayClick = (date) => {
    //const iso = date.toISOString().split("T")[0];
    const d = formatDate(date);
    const found = holidays.find((h) => h.date === d);
    setSelectedDayInfo(found || { date: d, name: "No holiday" });
  };

  return (
    <div className="calendar-wrapper">
      <div className="toggle-wrapper">
        <div className="date-button" onClick={toggleCalendar}>
          📅 {new Date().toDateString()}
        </div>
      </div>

      <div className={`calendar-container ${isExpanded ? "expanded" : ""}`}>
        <div className="calendar-box">
          <Calendar
            value={currentDate}
            onActiveStartDateChange={({ activeStartDate }) =>
              setCurrentDate(activeStartDate)
            }
            onClickDay={onDayClick}
            tileClassName={tileClassName}
          />
          {selectedDayInfo && (
            <div className="selected-info">
              <strong>{selectedDayInfo.date}</strong>: {selectedDayInfo.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
import React, { useEffect, useState } from "react";
import { FaCoffee, FaBriefcase } from "react-icons/fa";
import { useApi } from "../../context/ApiContext";

const ExecutiveActi = ({ selectedExecutiveId, executiveName }) => {
  const { fetchExecutiveDashboardData } = useApi();
  const [activityData, setActivityData] = useState({
    workTime: 0,
    breakTime: 0,
  });

  const FULL_DAY_SECONDS = 8 * 3600;

  const convertTime = (seconds) => {
    if (seconds > 0) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    return "0h 0m";
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allData = await fetchExecutiveDashboardData();
        let workTime = 0;
        let breakTime = 0;

        if (selectedExecutiveId) {
          // Fetch data for a specific executive
          const executiveData = allData.find(
            (exec) => exec.ExecutiveId === selectedExecutiveId
          );

          if (executiveData) {
            workTime = executiveData.workTime || 0;
            breakTime = executiveData.breakTime || 0;
          }
        } else {
          // Aggregate data for all executives
          allData.forEach((exec) => {
            workTime += exec.workTime || 0;
            breakTime += exec.breakTime || 0;
          });
        }

        setActivityData({
          workTime,
          breakTime,
        });
      } catch (error) {
        console.error("Error fetching activity data:", error);
        setActivityData({ workTime: 0, breakTime: 0 });
      }
    };

    fetchData();
  }, [selectedExecutiveId,fetchExecutiveDashboardData]);

  const activitiesRaw = [
    { name: "Break Time", value: activityData.breakTime, icon: <FaCoffee />, color: "#8b5cf6" },
    { name: "Work Time", value: activityData.workTime, icon: <FaBriefcase />, color: "#6d28d9" },
  ];

  const activities = activitiesRaw.map((activity) => ({
    ...activity,
    formattedValue: convertTime(activity.value),
    percentage: Math.min(Math.round((activity.value / FULL_DAY_SECONDS) * 100), 100),
  }));

  return (
    <div className="exec-activity">
      <h2 className="exec-section-title">
        Executive Behaviour:{" "}
        <span className="executive-name">
          {executiveName || "Loading..."}
        </span>
      </h2>

      {activities.map((activity, index) => (
        <div key={index} className="activity-item">
          <div className="activity-label">
            <span className="activity-icon">{activity.icon}</span>
            <span className="activity-name">{activity.name}</span>
            <span className="activity-percentage">{activity.formattedValue}</span>
          </div>
          <div className="activity-progress">
            <div
              className="progress-fill"
              style={{
                width: `${activity.percentage}%`,
                backgroundColor: activity.color,
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExecutiveActi;
import React, { useEffect, useState, useCallback } from "react";
import { FunnelChart, Funnel, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import io from "socket.io-client";
import { useApi } from "../../context/ApiContext";

// CSP-regression fix: this was hardcoded to "http://localhost:5000",
// which only ever worked in local dev and never in any other
// deployment. Derive the Socket.IO target from the same
// REACT_APP_API_BASE_URL every other service in this app already uses
// (apiService.js, executiveService.js, companyService.js), stripping
// its trailing /api path — Socket.IO connects to the bare origin, not
// a REST path.
const SOCKET_ORIGIN = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/api\/?$/, "");

const DealFunnel = ({ executiveName }) => {
  const { fetchDealFunnelData, fetchAssignedLeads } = useApi();
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      let statusCounts, totalLeads;

      if (executiveName) {
        // Fetch leads for the specific executive
        const leads = await fetchAssignedLeads(executiveName);
        totalLeads = leads.length;
        statusCounts = {
          New: 0,
          Assigned: 0,
          "Follow-Up": 0,
          Meeting: 0,
          Converted: 0,
          Closed: 0,
        };

        // Calculate status counts from leads
        leads.forEach((lead) => {
          if (statusCounts.hasOwnProperty(lead.status)) {
            statusCounts[lead.status]++;
          }
        });
      } else {
        // Fetch deal funnel data for all executives
        const response = await fetchDealFunnelData();
        statusCounts = response.statusCounts;
        totalLeads = response.totalLeads;
      }

      // Define the desired sequence of statuses
      const desiredSequence = ["New", "Assigned", "Follow-Up", "Meeting", "Converted", "Closed"];

      // Transform data into chart format
      const transformed = desiredSequence.map((status) => ({
        name: status,
        value: statusCounts[status] || 0,
      }));

      // Enrich with percentages
      const enriched = transformed.map((item) => ({
        ...item,
        percent: totalLeads ? ((item.value / totalLeads) * 100).toFixed(1) + "%" : "N/A",
      }));

      // Sort by value in descending order (highest to lowest)
      const sortedData = enriched.sort((a, b) => b.value - a.value);

      setData(sortedData);
    } catch (err) {
      console.error("Error fetching deal funnel data:", err);
    }
  }, [executiveName, fetchDealFunnelData, fetchAssignedLeads]);

  useEffect(() => {
    const socket = io(SOCKET_ORIGIN);
    socket.on("lead_status_update", fetchData);

    // Initial load
    fetchData();

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  return (
    <motion.div
      className="chart-container"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="chart">
        <h2 className="exec-section-title">
          🚀 Lead Funnel {executiveName ? `- ${executiveName}` : ""}
        </h2>
        <ResponsiveContainer width={300} height={220}>
          <FunnelChart>
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const { name, value, percent } = payload[0].payload;
                return (
                  <div
                    style={{
                      background: "#1e293b",
                      padding: "10px",
                      borderRadius: "6px",
                      color: "#fff",
                    }}
                  >
                    <b>{name}</b>
                    <br />
                    Count: {value === 0 ? "N/A" : value}
                    <br />
                    Percentage: {percent}
                  </div>
                );
              }}
            />
            <Funnel
              dataKey="value"
              data={data}
              isAnimationActive
              fill="url(#colorFunnel)"
              stroke="white"
              animationDuration={1200}
            />
            <defs>
              <linearGradient id="colorFunnel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6EE7B7" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </FunnelChart>
        </ResponsiveContainer>

        <p style={{ marginTop: "10px" }}>
          <b>Total Leads:</b>{" "}
          {data.reduce((sum, d) => sum + d.value, 0) === 0
            ? "N/A"
            : data.reduce((sum, d) => sum + d.value, 0)}
        </p>
      </div>

      <div className="chart-data">
        {data.map((item, idx) => (
          <motion.p
            key={idx}
            className="chart-row"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="chart-label">
              <span
                className="dot"
                style={{ backgroundColor: getStatusColor(item.name) }}
              />
              <b>{item.name}:</b>
            </span>
            <div className="chart-values-container">
              <div className="chart-value">{item.value === 0 ? "N/A" : item.value}</div>
              <div className="chart-percent">{item.percent}</div>
            </div>
          </motion.p>
        ))}
      </div>
    </motion.div>
  );
};

const getStatusColor = (status) => {
  const colors = {
    New: "#3498db",
    Assigned: "#f39c12",
    "Follow-Up": "#9b59b6",
    Meeting: "#8e44ad", // Added color for Meeting
    Converted: "#2ecc71",
    Closed: "#34495e",
    Rejected: "#e74c3c",
  };
  return colors[status] || "#95a5a6";
};

export default DealFunnel;
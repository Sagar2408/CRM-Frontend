import React, { useEffect, useState } from "react";
import { useApi } from "../../../context/ApiContext";
import Panel from "./Panel";

// Data: GET /processperson/performance (Customer rows grouped by process person).
// Completed = approved or rejected; Pending = still in progress.
const ProcessPersonPerformance = ({ startDate, endDate }) => {
  const { fetchProcessPersonPerformance } = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    (async () => {
      try {
        const data = await fetchProcessPersonPerformance(params);
        if (!cancelled) setRows(data);
      } catch (err) {
        console.error("Process person performance error:", err);
        if (!cancelled) setError("Could not load process person performance.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProcessPersonPerformance, startDate, endDate]);

  return (
    <Panel
      title="Process Person Performance"
      subtitle="Customers handed to each process person"
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyText="No process persons found."
    >
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Process Person</th>
              <th className="num">Assigned</th>
              <th className="num">Pending</th>
              <th className="num">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.processPersonId}>
                <td>{r.name}</td>
                <td className="num">{r.assignedLeads}</td>
                <td className="num">{r.pendingLeads}</td>
                <td className="num">{r.completedLeads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

export default ProcessPersonPerformance;

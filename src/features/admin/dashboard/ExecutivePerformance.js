import React, { useEffect, useState } from "react";
import { useApi } from "../../../context/ApiContext";
import Panel from "./Panel";

// Executive comparison. Data: GET /client-leads/executive-performance
// (ClientLead.status grouped by assigned executive, optional assignment-date range).
const ExecutivePerformance = ({ executiveId, startDate, endDate }) => {
  const { fetchExecutivePerformance } = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = {};
    if (executiveId) params.executiveId = executiveId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    (async () => {
      try {
        const data = await fetchExecutivePerformance(params);
        if (!cancelled) setRows(data);
      } catch (err) {
        console.error("Executive performance error:", err);
        if (!cancelled) setError("Could not load executive performance.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchExecutivePerformance, executiveId, startDate, endDate]);

  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

  return (
    <Panel
      title="Executive Performance"
      subtitle="Leads assigned to each executive and where they stand"
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyText="No executives found."
      className="ad-span-2"
    >
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Executive</th>
              <th className="num">Assigned Leads</th>
              <th className="num">Pending</th>
              <th className="num">Converted</th>
              <th className="num">Closed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.executiveId}>
                <td>{r.name}</td>
                <td className="num">{r.totalAssigned}</td>
                <td className="num">{r.pending}</td>
                <td className="num">{r.converted}</td>
                <td className="num">{r.closed}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{sum("totalAssigned")}</td>
                <td className="num">{sum("pending")}</td>
                <td className="num">{sum("converted")}</td>
                <td className="num">{sum("closed")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Panel>
  );
};

export default ExecutivePerformance;

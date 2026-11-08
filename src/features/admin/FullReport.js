import React, { useEffect, useState } from "react";
import SidebarToggle from "./SidebarToggle";
import { useApi } from "../../context/ApiContext";
import SingleReport from "./report/SingleReport";
import CompareReport from "./report/CompareReport";
import "../../styles/admin.css";
import "../../styles/adminDashboard.css";
import "../../styles/reportPage.css";

// Full Report: one executive's report, or a side-by-side comparison of up to 5.
const FullReport = () => {
  const { fetchExecutivesAPI } = useApi();
  const [tab, setTab] = useState("single");
  const [executives, setExecutives] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const load = async () => {
    setStatus("loading");
    try {
      const list = await fetchExecutivesAPI();
      setExecutives(Array.isArray(list) ? list : []);
      setStatus("ready");
    } catch (err) {
      console.error("Executives error:", err);
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchExecutivesAPI]);

  return (
    <div className="rp-page">
      <SidebarToggle />
      <header className="rp-header">
        <div>
          <h1 className="rp-title">Full Report</h1>
          <p className="rp-sub">Lead performance by executive</p>
        </div>
        <div className="rp-tabs" role="tablist" aria-label="Report type">
          {[
            ["single", "Executive report"],
            ["compare", "Compare executives"],
          ].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {status === "loading" ? (
        <div className="ad-state" role="status">Loading executives…</div>
      ) : status === "error" ? (
        <div className="rp-error" role="alert">
          Could not load the executive list. <button type="button" onClick={load}>Retry</button>
        </div>
      ) : executives.length === 0 ? (
        <div className="rp-empty"><h3>No executives found</h3><p>Add executives to start generating reports.</p></div>
      ) : tab === "single" ? (
        <SingleReport executives={executives} />
      ) : (
        <CompareReport executives={executives} />
      )}
    </div>
  );
};

export default FullReport;

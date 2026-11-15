
import React, { useState, useEffect } from "react";
import "../styles/followup.css";
import { useLocation } from "react-router-dom";
import ProcessClientDetails from "../features/follow-ups/ProcessClientDetails";
import ProcessClientTable from "../features/follow-ups/ProcessClientTable";


const ProcessFollowUpRoutes = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.state?.activeTab || "All Follow Ups"
  );
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  return (
    <div className="follow-app-container">
      {/* <SidebarandNavbar /> */}
      <div className="follow-main-content">
        <h1 className="pp-page__title" style={{ margin: "4px 4px 12px" }}>Follow-ups</h1>
        <ProcessClientDetails selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
        <div className="followup-tabs">
          {["All Follow Ups", "Document collection", "Payment follow-up","Visa filing"].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
   <ProcessClientTable filter={activeTab} onSelectClient={setSelectedClient} />
      </div>
    
    </div>
  );
};

export default ProcessFollowUpRoutes;
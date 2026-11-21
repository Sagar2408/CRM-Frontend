import React from "react";
import "../styles/client.css";
import ClientOverview from "../features/client-details/ClientOverview";
import ClientDetailsOverview from "../features/follow-ups/ClientDetailsOverview";
import { Routes, Route, useLocation } from "react-router-dom";
import LegacyFollowUpRedirect from "../features/process-followup/LegacyFollowUpRedirect";
const ClientRoutes = () => {
  const location = useLocation(); // ✅ import & use the hook properly

  return (
    <div className="client-app-container">
      {/* <SideandNavbar /> */}
      <div className="client-main-content">
        {/* ✅ Only ONE Routes block, properly keyed to force remount */}
        <Routes location={location} key={location.pathname}>
          <Route path=":clientId" element={<ClientOverview />} />
          <Route path=":clientId/details" element={<ClientDetailsOverview />} />
          {/* Old Process Person follow-up links land on the new screen (/process/follow-up/:customerId). */}
          <Route path="/processperson/:clientId/:id" element={<LegacyFollowUpRedirect />} />
          <Route path="/details/:clientId/:id" element={<LegacyFollowUpRedirect />} />
        </Routes>
      </div>
    </div>
  );
};

export default ClientRoutes;
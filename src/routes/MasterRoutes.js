import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MasterShell from "../features/masteruser/center/MasterShell";
import ControlCenterDashboard from "../features/masteruser/center/ControlCenterDashboard";
import CompaniesPage from "../features/masteruser/center/CompaniesPage";
import CompanyDetails from "../features/masteruser/center/CompanyDetails";
import PromotionsPage from "../features/masteruser/center/PromotionsPage";
import SubscriptionPlansPage from "../features/masteruser/center/SubscriptionPlansPage";
import SupportQueries from "../features/masteruser/SupportQueries";

// Every Master page shares one shell (header, navigation, logout).
const MasterRoutes = () => (
  <Routes>
    <Route element={<MasterShell />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ControlCenterDashboard />} />
      <Route path="companies" element={<CompaniesPage />} />
      <Route path="companies/new" element={<CompanyDetails />} />
      <Route path="companies/:id" element={<CompanyDetails />} />
      <Route path="promotions" element={<PromotionsPage />} />
      <Route path="subscription-plans" element={<SubscriptionPlansPage />} />
      <Route path="support" element={<SupportQueries />} />
    </Route>
  </Routes>
);

export default MasterRoutes;
